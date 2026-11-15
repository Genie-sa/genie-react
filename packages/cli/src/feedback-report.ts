import { createHash } from 'node:crypto'
import { existsSync, readFileSync, realpathSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import type { FailureReason } from './failure'
import { type FeedbackKind, MESSAGE_LIMIT, TITLE_LIMIT } from './feedback-options'
import { isRecord } from './guards'
import { detectPackageManager } from './package-manager'

export interface FeedbackDiagnostics {
  cliVersion: string
  runtimeVersion?: string
  node: string
  platform: string
  arch: string
  packageManager: string
  framework: string
  reactVersion?: string
}

export interface FeedbackInput {
  kind: FeedbackKind
  message: string
  title?: string
  reason?: FailureReason
  tool?: string
  /** The message was already cut while it was read from stdin. */
  messageTruncated?: boolean
}

export type RedactionRule =
  | 'private_key'
  | 'url_credentials'
  | 'url_query'
  | 'invalid_url'
  | 'jwt'
  | 'bearer_token'
  | 'api_key'
  | 'secret_assignment'
  | 'email'
  | 'project_path'
  | 'home_path'
  | 'high_entropy'

export interface FeedbackReport {
  kind: FeedbackKind
  title: string
  message: string
  failure?: { reason: FailureReason; tool?: string }
  signature?: string
  diagnostics: FeedbackDiagnostics
  redactions: Partial<Record<RedactionRule, number>>
  truncated: { title: boolean; message: boolean }
}

/** Absolute paths the scrubber replaces; any other `/Users/<name>` or `/home/<name>` prefix is replaced too. */
export interface ScrubContext {
  home: string
  projectRoots: readonly string[]
}

const VERSION = /^[0-9A-Za-z][0-9A-Za-z.+-]{0,40}$/

/** Nearest-package.json markers, most specific first: a React Native or Next app also lists generic bundlers. */
const FRAMEWORK_MARKERS: ReadonlyArray<readonly [dependency: string, framework: string]> = [
  ['expo', 'expo'],
  ['react-native', 'react-native'],
  ['next', 'nextjs'],
  ['@tanstack/react-start', 'tanstack-start'],
  ['@react-router/dev', 'react-router'],
  ['@remix-run/dev', 'remix'],
  ['vite', 'vite'],
  ['react-scripts', 'create-react-app'],
  ['@rspack/core', 'rspack'],
  ['webpack', 'webpack'],
  ['parcel', 'parcel'],
]

const KIND_TITLES: Record<FeedbackKind, string> = {
  bug: 'Bug',
  friction: 'Friction',
  idea: 'Idea',
  docs: 'Docs',
}

/** Only fixed vocabularies and version strings: nothing here can carry the project's code, names or data. */
export function collectDiagnostics(cwd: string, cliVersion: string): FeedbackDiagnostics {
  const runtimeVersion = installedVersion(cwd, 'genie-react')
  const reactVersion = installedVersion(cwd, 'react')
  return {
    cliVersion: VERSION.test(cliVersion) ? cliVersion : 'unknown',
    ...(runtimeVersion ? { runtimeVersion } : {}),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    packageManager: detectPackageManager(cwd),
    framework: detectFramework(cwd),
    ...(reactVersion ? { reactVersion } : {}),
  }
}

function detectFramework(cwd: string): string {
  const manifest = nearestManifest(cwd)
  if (!manifest) return 'unknown'
  const dependencies = new Set(
    ['dependencies', 'devDependencies', 'peerDependencies'].flatMap((section) => {
      const entries = manifest[section]
      return isRecord(entries) ? Object.keys(entries) : []
    }),
  )
  return FRAMEWORK_MARKERS.find(([dependency]) => dependencies.has(dependency))?.[1] ?? 'unknown'
}

function nearestManifest(cwd: string): Record<string, unknown> | undefined {
  for (const directory of ancestors(cwd)) {
    const path = join(directory, 'package.json')
    if (!existsSync(path)) continue
    const parsed = readJson(path)
    return isRecord(parsed) ? parsed : undefined
  }
  return undefined
}

function installedVersion(cwd: string, name: string): string | undefined {
  for (const directory of ancestors(cwd)) {
    const path = join(directory, 'node_modules', name, 'package.json')
    if (!existsSync(path)) continue
    const parsed = readJson(path)
    const version = isRecord(parsed) ? parsed.version : undefined
    return typeof version === 'string' && VERSION.test(version) ? version : undefined
  }
  return undefined
}

function* ancestors(start: string): Generator<string> {
  let directory = start
  while (true) {
    yield directory
    const parent = dirname(directory)
    if (parent === directory) return
    directory = parent
  }
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

/** The working directory, its package root and its git root, each also as its resolved real path. */
export function scrubContextFor(cwd: string): ScrubContext {
  const roots = [cwd, rootContaining(cwd, 'package.json'), rootContaining(cwd, '.git')].filter(
    (root): root is string => root !== undefined,
  )
  return {
    home: homedir(),
    projectRoots: [...new Set(roots.flatMap((root) => [root, realPath(root)]))],
  }
}

function rootContaining(cwd: string, marker: string): string | undefined {
  for (const directory of ancestors(cwd)) {
    if (existsSync(join(directory, marker))) return directory
  }
  return undefined
}

function realPath(path: string): string {
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

type Counts = Map<RedactionRule, number>

interface Rule {
  rule: RedactionRule
  pattern: RegExp
  replace: (match: string, ...groups: string[]) => string
}

const fixed = (replacement: string) => (): string => replacement

/** Every pattern starts its runs behind a lookbehind and bounds nested repeats, so 64 KB of adversarial input scrubs in linear time. */
const SECRET_RULES: readonly Rule[] = [
  {
    rule: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]*/g,
    replace: fixed('[redacted jwt]'),
  },
  {
    rule: 'bearer_token',
    pattern: /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replace: (_match, scheme) => `${scheme} [redacted]`,
  },
  {
    rule: 'api_key',
    pattern:
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}|[rs]k_(?:live|test)_[A-Za-z0-9]{10,}|xox[abposr]-[A-Za-z0-9-]{10,}|(?:AKIA|ASIA)[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{35}|glpat-[A-Za-z0-9_-]{20,}|npm_[A-Za-z0-9]{36}|hf_[A-Za-z0-9]{30,})/g,
    replace: fixed('[redacted token]'),
  },
  {
    rule: 'secret_assignment',
    pattern:
      /(?<![A-Za-z0-9_-])([A-Za-z0-9_-]{0,40}(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|credential|authorization|access[_-]?key|private[_-]?key|session[_-]?id|cookie)[A-Za-z0-9_-]{0,40})(["']?\s*[:=]\s*["']?)(?!\[redacted|Bearer\b|Basic\b)([^\s"'&,;]{4,})/gi,
    replace: (_match, key, separator) => `${key}${separator}[redacted]`,
  },
  {
    rule: 'email',
    pattern:
      /(?<![A-Za-z0-9._%+-])[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
    replace: fixed('[redacted email]'),
  },
]

const PRIVATE_KEY =
  /-----BEGIN [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY(?: BLOCK)?-----|$)/g
const URL_PATTERN = /(?<![a-z0-9+.-])[a-z][a-z0-9+.-]*:\/\/[^\s<>"'`]+/gi
const TRAILING_PUNCTUATION = /[.,;:!?)\]}]+$/
const OTHER_HOMES = /(?<![\w.-])(?:\/Users|\/home)\/[^/\s'"`<>]+|\b[A-Za-z]:\\Users\\[^\\\s'"`<>]+/g
const TOKEN_LIKE = /(?<![A-Za-z0-9+=_-])[A-Za-z0-9+=_-]{32,}(?![A-Za-z0-9+=_-])/g

/** Replaces paths, URL credentials and queries, and secret-shaped values; every replacement is counted so the report can say what was removed. */
export function scrub(text: string, context: ScrubContext, counts: Counts): string {
  const count = (rule: RedactionRule): void => {
    counts.set(rule, (counts.get(rule) ?? 0) + 1)
  }
  let result = text.replace(PRIVATE_KEY, () => {
    count('private_key')
    return '[redacted private key]'
  })
  result = result.replace(URL_PATTERN, (match) => {
    const trailing = TRAILING_PUNCTUATION.exec(match)?.[0] ?? ''
    return `${scrubUrl(match.slice(0, match.length - trailing.length), count)}${trailing}`
  })
  for (const { rule, pattern, replace } of SECRET_RULES) {
    result = result.replace(pattern, (match, ...groups: string[]) => {
      count(rule)
      return replace(match, ...groups)
    })
  }
  for (const [path, placeholder, rule] of knownPaths(context)) {
    result = result.replace(pathPattern(path), () => {
      count(rule)
      return placeholder
    })
  }
  result = result.replace(OTHER_HOMES, () => {
    count('home_path')
    return '<home>'
  })
  return result.replace(TOKEN_LIKE, (match) => {
    if (!looksRandom(match)) return match
    count('high_entropy')
    return '[redacted]'
  })
}

function scrubUrl(raw: string, count: (rule: RedactionRule) => void): string {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    count('invalid_url')
    return '[redacted url]'
  }
  const credentials = url.username !== '' || url.password !== ''
  const query = url.search !== '' || url.hash !== ''
  if (!credentials && !query) return raw
  if (credentials) count('url_credentials')
  if (query) count('url_query')
  url.username = ''
  url.password = ''
  url.search = ''
  url.hash = ''
  return url.href
}

function knownPaths(
  context: ScrubContext,
): Array<readonly [path: string, placeholder: string, rule: RedactionRule]> {
  const home = context.home.length > 1 ? [context.home] : []
  const entries = [
    ...context.projectRoots
      .filter((root) => root.length > 1 && !home.includes(root))
      .map((root) => [root, '<project>', 'project_path'] as const),
    ...home.map((path) => [path, '<home>', 'home_path'] as const),
  ]
  const variants = entries.flatMap(([path, placeholder, rule]) =>
    [...new Set([path, path.replaceAll('\\', '/'), path.replaceAll('/', '\\')])].map(
      (variant) => [variant, placeholder, rule] as const,
    ),
  )
  return variants.sort((left, right) => right[0].length - left[0].length)
}

function pathPattern(path: string): RegExp {
  return new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9._-])`, 'gi')
}

/** Mixed-case alphanumerics with a digit, or long hex: the shape of keys and tokens rather than words or identifiers. */
function looksRandom(token: string): boolean {
  if (!/\d/.test(token)) return false
  return (/[a-z]/.test(token) && /[A-Z]/.test(token)) || /^[0-9a-f]+$/i.test(token)
}

const CONTROL_EXCEPT_NEWLINE_AND_TAB = /(?![\n\t])\p{Cc}/gu
const BIDI_CONTROLS = /\p{Bidi_Control}/gu
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b)

/** Bidirectional overrides and control characters can hide or reorder text, so neither survives. */
function stripHiddenCharacters(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(BIDI_CONTROLS, '')
    .replace(CONTROL_EXCEPT_NEWLINE_AND_TAB, '')
}

/** GitHub links `@user`, `#123` and `GH-123` in titles; a zero-width space after the sigil keeps the text readable without notifying or cross-linking. */
function neutralizeReferences(text: string): string {
  return text
    .replace(/@(?=[A-Za-z0-9])/g, `@${ZERO_WIDTH_SPACE}`)
    .replace(/#(?=\d)/g, `#${ZERO_WIDTH_SPACE}`)
    .replace(/\bGH-(?=\d)/gi, (match) => `${match}${ZERO_WIDTH_SPACE}`)
}

function cut(text: string, limit: number): { text: string; truncated: boolean } {
  const characters = Array.from(text)
  return characters.length <= limit
    ? { text, truncated: false }
    : { text: characters.slice(0, limit).join('').trimEnd(), truncated: true }
}

export function failureSignature(reason: FailureReason, tool: string | undefined): string {
  const digest = createHash('sha256')
    .update(`${reason}:${tool ?? ''}`)
    .digest('hex')
  return `geniesig${digest.slice(0, 12)}`
}

export function buildReport(
  input: FeedbackInput,
  diagnostics: FeedbackDiagnostics,
  context: ScrubContext,
): FeedbackReport {
  const counts: Counts = new Map()
  const message = cut(
    scrub(stripHiddenCharacters(input.message), context, counts).trim(),
    MESSAGE_LIMIT,
  )
  const suppliedTitle =
    input.title === undefined ? undefined : scrub(singleLine(input.title), context, counts)
  const title = cut(
    neutralizeReferences(suppliedTitle || singleLine(message.text.split('\n').find(Boolean) ?? '')),
    TITLE_LIMIT,
  )
  const titleText = title.text || 'Feedback from genie-react feedback'
  return {
    kind: input.kind,
    title: `${KIND_TITLES[input.kind]}: ${title.truncated ? `${titleText}…` : titleText}`,
    message: message.text,
    ...(input.reason
      ? { failure: { reason: input.reason, ...(input.tool ? { tool: input.tool } : {}) } }
      : {}),
    ...(input.reason ? { signature: failureSignature(input.reason, input.tool) } : {}),
    diagnostics,
    redactions: Object.fromEntries(counts),
    truncated: {
      title: title.truncated,
      message: message.truncated || input.messageTruncated === true,
    },
  }
}

function singleLine(text: string): string {
  return stripHiddenCharacters(text).replace(/\s+/g, ' ').trim()
}

/** The message sits in a fence longer than any backtick run inside it, so no Markdown, HTML, mention or reference in it renders. */
function fenced(text: string): string {
  const longestRun = Math.max(0, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = '`'.repeat(Math.max(3, longestRun + 1))
  return `${fence}text\n${text}\n${fence}`
}

export const SIGNATURE_ROW = (signature: string): string => `| Signature | \`${signature}\` |`

export function renderBody(report: FeedbackReport): string {
  const redacted = Object.values(report.redactions).reduce((total, count) => total + count, 0)
  const notes = [
    redacted > 0
      ? `${redacted} value${redacted === 1 ? ' was' : 's were'} redacted before sending.`
      : undefined,
    report.truncated.message
      ? `The message was cut to ${MESSAGE_LIMIT.toLocaleString('en-US')} characters.`
      : undefined,
  ].filter((note) => note !== undefined)
  const { diagnostics, failure } = report
  const rows: Array<readonly [string, string | undefined]> = [
    ['Kind', report.kind],
    ['Failure reason', failure?.reason],
    ['Tool', failure?.tool],
    ['CLI', `@genie-react/cli ${diagnostics.cliVersion}`],
    ['Runtime', diagnostics.runtimeVersion && `genie-react ${diagnostics.runtimeVersion}`],
    ['Node', diagnostics.node],
    ['OS', `${diagnostics.platform} ${diagnostics.arch}`],
    ['Package manager', diagnostics.packageManager],
    ['Framework', diagnostics.framework],
    ['React', diagnostics.reactVersion],
  ]
  return [
    '### Report',
    '',
    fenced(report.message),
    ...(notes.length > 0 ? ['', ...notes.map((note) => `_${note}_`)] : []),
    '',
    '### Diagnostics',
    '',
    '| Field | Value |',
    '| --- | --- |',
    ...rows.flatMap(([label, value]) => (value ? [`| ${label} | \`${value}\` |`] : [])),
    ...(report.signature ? [SIGNATURE_ROW(report.signature)] : []),
    '',
    '_Sent with `genie-react feedback`, which attaches only the diagnostics above and redacts paths, URL queries, emails and secret-like values from the message._',
  ].join('\n')
}
