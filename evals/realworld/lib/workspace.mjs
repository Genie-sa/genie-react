import { access, cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { freePort, start, waitForHttp } from '../../lib/process.mjs'
import { readEditedSources } from './specs.mjs'

const COPIED_ENTRIES = [
  'index.html',
  'package.json',
  'tsconfig.json',
  'vite.config.ts',
  'src',
  'mock-api',
]
const SERVER_READY_TIMEOUT_MS = 60_000
const DISCOVERY_FILE = join('.genie', 'bridge.json')
const VITE_CACHE_DIR = '.vite'

/**
 * @typedef {import('./specs.mjs').Edit} Edit
 * @typedef {{ name: string, dir: string, url: string, port: number, stop: () => Promise<void>, log: () => string }} RunningVariant
 */

/**
 * Copies the app into `variantsDir/name` (inside the app, so dependencies resolve from its node_modules) and applies edits.
 * `warmCacheFrom` seeds Vite's dependency cache from a variant that already optimised them, which avoids a mid-load reload.
 * @param {{ appDir: string, variantsDir: string, name: string, edits: Edit[], warmCacheFrom?: string }} options
 */
export async function createVariant({ appDir, variantsDir, name, edits, warmCacheFrom }) {
  const dir = join(variantsDir, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  for (const entry of COPIED_ENTRIES) {
    await cp(join(appDir, entry), join(dir, entry), { recursive: true })
  }
  if (warmCacheFrom && (await exists(join(warmCacheFrom, VITE_CACHE_DIR)))) {
    await cp(join(warmCacheFrom, VITE_CACHE_DIR), join(dir, VITE_CACHE_DIR), { recursive: true })
  }
  for (const [file, contents] of await readEditedSources(dir, edits)) {
    await writeFile(join(dir, file), contents)
  }
  return dir
}

/**
 * @param {string} path
 */
async function exists(path) {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Starts the variant's Vite dev server on a free port and waits until its Genie hub has published discovery.
 * @param {{ name: string, dir: string, viteBin: string, runtimeDir: string }} options
 * @returns {Promise<RunningVariant>}
 */
export async function startVariant({ name, dir, viteBin, runtimeDir }) {
  const port = await freePort()
  const server = start(process.execPath, [viteBin, '--port', String(port), '--strictPort'], {
    cwd: dir,
    env: {
      ...process.env,
      DASHBOARD_PORT: String(port),
      XDG_RUNTIME_DIR: runtimeDir,
      VITE_CONFIG_NATIVE_IGNORE_WARNING: 'true',
      BROWSER: 'none',
    },
  })
  const url = `http://127.0.0.1:${port}`
  try {
    await waitForHttp(`${url}/`, {
      timeoutMs: SERVER_READY_TIMEOUT_MS,
      isAlive: () => !server.exited(),
      describe: server.log,
    })
    const deadline = Date.now() + SERVER_READY_TIMEOUT_MS
    while (!(await exists(join(dir, DISCOVERY_FILE)))) {
      if (Date.now() > deadline)
        throw new Error(`Genie hub for ${name} never published ${DISCOVERY_FILE}\n${server.log()}`)
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  } catch (error) {
    await server.stop()
    throw error
  }
  return { name, dir, url, port, stop: server.stop, log: server.log }
}
