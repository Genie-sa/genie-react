import { type Dirent, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { GENIE_CLIENT_PATH, GENIE_DEFAULT_HUB_PORT, GENIE_WS_PATH } from 'genie-react/protocol'
import type { BridgeDiscovery } from './discovery'
import { isRecord } from './guards'
import { genieCommand, packageManagerCommands } from './package-manager'

export const OTHER_WEB_GUIDE = 'https://genie-react.com/docs/getting-started/install#other-bundlers'
export const HOOK_MODULE = 'genie-react/hook'
export const CLIENT_MODULE = 'genie-react/client'

export type WebBundler = 'rspack' | 'webpack' | 'esbuild' | 'parcel' | 'rollup'

/** Most specific first: Rsbuild and Create React App wrap the bundler they are listed under. */
const BUNDLER_PACKAGES: ReadonlyArray<readonly [WebBundler, readonly string[]]> = [
  ['rspack', ['@rspack/core', '@rspack/cli', '@rsbuild/core']],
  ['webpack', ['webpack', 'react-scripts']],
  ['esbuild', ['esbuild']],
  ['parcel', ['parcel', '@parcel/core']],
  ['rollup', ['rollup']],
]

export interface HubPlan {
  port: number
  /** `running-hub`: a live hub's discovery file; `package-script`: a package.json script that starts the hub; `default`: Genie's default port. */
  portSource: 'running-hub' | 'package-script' | 'default'
  start: { command: string; argv: string[] }
}

export interface ScriptTag {
  file: string
  url: string
  port: number | null
}

export interface HookImport {
  file: string
  /** The same file imports React first, so the hook installs after React initialised. */
  afterReact: boolean
}

export interface WebSetup {
  bundler: WebBundler | null
  hub: HubPlan
  scriptTags: ScriptTag[]
  hookImports: HookImport[]
  clientStarts: string[]
  /** A complete recipe is in place: the hub's script tag, or the hook plus a bundled client. */
  wired: boolean
  scanTruncated: boolean
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', 'dist', 'build', 'out', 'coverage'])
const SCANNED_FILE = /\.(?:html?|[cm]?[jt]sx?)$/i
const MAX_SCANNED_FILES = 2_000
const MAX_DEPTH = 6
const MAX_FILE_BYTES = 512 * 1024

const SCRIPT_TAG = /<script\b[^>]*?\bsrc\s*=\s*["']([^"']*\/__genie\/client\.js)["']/gi
const HOOK_IMPORT =
  /^[ \t]*(?:import\s+["']genie-react\/hook(?:-hmr)?["']|(?!\/\/)[^\n]*\brequire\(\s*["']genie-react\/hook(?:-hmr)?["']\s*\))/m
/** A type-only import is erased, so it never loads React. */
const REACT_IMPORT =
  /^[ \t]*(?:import\b(?!\s+type\b)[^'"]*["']react(?:-dom)?(?:\/[^'"]*)?["']|(?!\/\/)[^\n]*\brequire\(\s*["']react(?:-dom)?(?:\/[^'"]*)?["']\s*\))/m
const CLIENT_IMPORT = /["']genie-react\/client["']/
const CLIENT_START = /\bcreateGenieClient\s*\(/
const HUB_SCRIPT = /\b(?:genie-react|@genie-react\/cli)\s+hub\b([^&|;]*)/
const PORT_FLAG = /--port(?:=|\s+)(?:\$\{\w+:-(\d+)\}|(\d+))/

/** What a project that uses neither Vite nor Next.js has wired for Genie, read from its files without running them. */
export function inspectWebSetup(cwd: string, discovery: BridgeDiscovery | null): WebSetup {
  const manifest = readManifest(cwd)
  const scriptTags: ScriptTag[] = []
  const hookImports: HookImport[] = []
  const clientStarts: string[] = []
  const scan = scanProjectFiles(cwd)
  for (const path of scan.files) {
    const file = relative(cwd, path)
    const text = readText(path)
    for (const match of text.matchAll(SCRIPT_TAG)) {
      const url = match[1] as string
      scriptTags.push({ file, url, port: portOf(url) })
    }
    const hook = HOOK_IMPORT.exec(text)
    if (hook) {
      const react = REACT_IMPORT.exec(text)
      hookImports.push({ file, afterReact: react !== null && react.index < hook.index })
    }
    if (CLIENT_IMPORT.test(text) && CLIENT_START.test(text)) clientStarts.push(file)
  }
  return {
    bundler: detectBundler(manifest.dependencies),
    hub: planHub(cwd, manifest.scripts, discovery),
    scriptTags,
    hookImports,
    clientStarts,
    wired: scriptTags.length > 0 || (hookImports.length > 0 && clientStarts.length > 0),
    scanTruncated: scan.truncated,
  }
}

export function clientScriptUrl(port: number): string {
  return `http://127.0.0.1:${port}${GENIE_CLIENT_PATH}`
}

export function clientWebSocketUrl(port: number): string {
  return `ws://127.0.0.1:${port}${GENIE_WS_PATH}`
}

function detectBundler(dependencies: ReadonlySet<string>): WebBundler | null {
  return (
    BUNDLER_PACKAGES.find(([, packages]) => packages.some((name) => dependencies.has(name)))?.[0] ??
    null
  )
}

function planHub(
  cwd: string,
  scripts: Readonly<Record<string, string>>,
  discovery: BridgeDiscovery | null,
): HubPlan {
  const script = Object.entries(scripts).find(([, body]) => HUB_SCRIPT.test(body))
  const scriptPort = script ? scriptPortOf(script[1]) : null
  const runningPort = discovery ? portOf(discovery.url) : null
  const port = runningPort ?? scriptPort ?? GENIE_DEFAULT_HUB_PORT
  const argv = script
    ? [...packageManagerCommands(cwd).run, script[0]]
    : genieCommand(['hub', '--port', String(port)], cwd).argv
  return {
    port,
    portSource:
      runningPort !== null ? 'running-hub' : scriptPort !== null ? 'package-script' : 'default',
    start: { command: argv.join(' '), argv },
  }
}

/** The hub walks from its default port when a script passes no --port, so only an explicit port, or a shell default such as ${GENIE_HUB_PORT:-4712}, is known. */
function scriptPortOf(body: string): number | null {
  const flags = HUB_SCRIPT.exec(body)?.[1] ?? ''
  const match = PORT_FLAG.exec(flags)
  const port = Number(match?.[1] ?? match?.[2])
  return Number.isInteger(port) && port > 0 && port < 65_536 ? port : null
}

function portOf(url: string): number | null {
  try {
    const parsed = new URL(url)
    const port = Number(parsed.port)
    return parsed.port !== '' && Number.isInteger(port) ? port : null
  } catch {
    return null
  }
}

function readManifest(cwd: string): {
  dependencies: Set<string>
  scripts: Record<string, string>
} {
  let parsed: unknown
  try {
    parsed = JSON.parse(readText(join(cwd, 'package.json')))
  } catch {
    parsed = undefined
  }
  const dependencies = new Set<string>()
  const scripts: Record<string, string> = {}
  if (!isRecord(parsed)) return { dependencies, scripts }
  for (const key of ['dependencies', 'devDependencies'] as const) {
    const section = parsed[key]
    if (isRecord(section)) for (const name of Object.keys(section)) dependencies.add(name)
  }
  if (isRecord(parsed.scripts)) {
    for (const [name, body] of Object.entries(parsed.scripts)) {
      if (typeof body === 'string') scripts[name] = body
    }
  }
  return { dependencies, scripts }
}

/** Breadth-first so entry files and HTML templates near the root are read before deep source trees exhaust the bound. */
function scanProjectFiles(cwd: string): { files: string[]; truncated: boolean } {
  const files: string[] = []
  let level = [cwd]
  for (let depth = 0; depth <= MAX_DEPTH && level.length > 0; depth += 1) {
    const next: string[] = []
    for (const directory of level) {
      for (const entry of readDirectory(directory)) {
        if (entry.name.startsWith('.')) continue
        const path = join(directory, entry.name)
        if (entry.isDirectory()) {
          if (!SKIPPED_DIRECTORIES.has(entry.name)) next.push(path)
        } else if (entry.isFile() && SCANNED_FILE.test(entry.name) && isSmallFile(path)) {
          if (files.length >= MAX_SCANNED_FILES) return { files, truncated: true }
          files.push(path)
        }
      }
    }
    level = next
  }
  return { files, truncated: level.length > 0 }
}

function readDirectory(directory: string): Dirent[] {
  try {
    return readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name),
    )
  } catch {
    return []
  }
}

function isSmallFile(path: string): boolean {
  try {
    return statSync(path).size <= MAX_FILE_BYTES
  } catch {
    return false
  }
}

function readText(path: string): string {
  try {
    return readFileSync(path, 'utf8')
  } catch {
    return ''
  }
}

export interface WebSetupCheck {
  label: string
  ok: boolean
  critical: boolean
  detail?: string
}

/** Static `doctor` checks for a project on another web bundler; whether the hook really ran before React is proven only by `doctor --live`. */
export function webSetupChecks(setup: WebSetup): WebSetupCheck[] {
  const bundler = setup.bundler ?? 'web bundler'
  const checks: WebSetupCheck[] = [
    {
      label: `${bundler}: development client connects to the hub`,
      ok: setup.wired,
      critical: true,
      detail: setup.wired ? wiringSummary(setup) : missingWiring(setup),
    },
  ]
  if (setup.hookImports.length > 0) {
    const late = lateHookImports(setup)
    checks.push({
      label: `${HOOK_MODULE} is imported before React in each file that imports it`,
      ok: late.length === 0,
      critical: true,
      detail:
        late.length === 0
          ? `${setup.hookImports.map(({ file }) => file).join(', ')}; doctor --live confirms the order at runtime`
          : `${late.map(({ file }) => file).join(', ')} imports react or react-dom first; move the ${HOOK_MODULE} import above them`,
    })
  }
  for (const tag of misdirectedScriptTags(setup)) {
    checks.push({
      label: 'client script tag uses the hub port',
      ok: false,
      critical: true,
      detail: misdirectedTagFix(setup, tag),
    })
  }
  checks.push({
    label: 'hub is running',
    ok: setup.hub.portSource === 'running-hub',
    critical: false,
    detail:
      setup.hub.portSource === 'running-hub'
        ? `port ${setup.hub.port}`
        : `start it beside the dev server: ${setup.hub.start.command}`,
  })
  return checks
}

export function lateHookImports(setup: WebSetup): HookImport[] {
  return setup.hookImports.filter(({ afterReact }) => afterReact)
}

/** A script tag on another port than the known hub port loads nothing; with only the default port known, the user may run the hub elsewhere on purpose. */
export function misdirectedScriptTags(setup: WebSetup): ScriptTag[] {
  if (setup.hub.portSource === 'default') return []
  return setup.scriptTags.filter(({ port }) => port !== null && port !== setup.hub.port)
}

export function misdirectedTagFix(setup: WebSetup, tag: ScriptTag): string {
  const verb = setup.hub.portSource === 'running-hub' ? 'runs' : 'starts'
  return `${tag.file} loads ${tag.url}, but the hub ${verb} on port ${setup.hub.port}; load ${clientScriptUrl(setup.hub.port)}`
}

function wiringSummary(setup: WebSetup): string {
  const parts = setup.scriptTags.map(({ file }) => `script tag in ${file}`)
  if (setup.hookImports.length > 0 && setup.clientStarts.length > 0) {
    parts.push(
      `${HOOK_MODULE} in ${setup.hookImports.map(({ file }) => file).join(', ')}`,
      `createGenieClient in ${setup.clientStarts.join(', ')}`,
    )
  }
  return parts.join('; ')
}

export function missingWiring(setup: WebSetup): string {
  const scanned = setup.scanTruncated ? ' in the files scanned' : ''
  if (setup.clientStarts.length > 0) {
    return `createGenieClient in ${setup.clientStarts.join(', ')} but no ${HOOK_MODULE} import${scanned}; import ${HOOK_MODULE} first in the development entry, before React`
  }
  if (setup.hookImports.length > 0) {
    return `${HOOK_MODULE} in ${setup.hookImports.map(({ file }) => file).join(', ')} but no createGenieClient from ${CLIENT_MODULE}${scanned}; start one client with url ${clientWebSocketUrl(setup.hub.port)}, or use the hub's script tag instead`
  }
  return `no client found${scanned}; in development only, add <script src="${clientScriptUrl(setup.hub.port)}"></script> first in <head>, or import ${HOOK_MODULE} before React and start createGenieClient from ${CLIENT_MODULE} (${OTHER_WEB_GUIDE})`
}
