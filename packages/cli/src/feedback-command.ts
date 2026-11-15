import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { lstatSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ensurePrivateDirectory,
  genieUserDirectory,
  isOwnedByCurrentUser,
} from 'genie-react/hub/token'
import { renderFailure, writeEnvelope } from './cli-output'
import { agentFailure } from './failure-format'
import {
  FEEDBACK_KINDS,
  FEEDBACK_LABEL,
  FEEDBACK_REPOSITORY,
  GENIE_TOOL_FAMILIES,
  isFeedbackKind,
  isFeedbackReason,
  isGenieToolName,
} from './feedback-options'
import {
  buildReport,
  collectDiagnostics,
  type FeedbackReport,
  renderBody,
  SIGNATURE_ROW,
  scrubContextFor,
} from './feedback-report'
import { isRecord } from './guards'
import { genieCommand } from './package-manager'
import { CLI_OUTPUT_SCHEMA_VERSION } from './schema-version'

export interface FeedbackCommandOptions {
  message?: string
  title?: string
  kind?: string
  reason?: string
  tool?: string
  submit: boolean
  draft?: string
  allowDuplicate: boolean
  cliVersion: string
  maxBytes?: number
  cwd?: string
  stdin?: NodeJS.ReadableStream & { isTTY?: boolean }
}

interface Issue {
  title: string
  body: string
  signature?: string
}

/** A saved preview: exactly what the user was shown, so submitting it never rebuilds the report. */
interface Draft extends Issue {
  id: string
}

type FallbackCause =
  | 'gh_missing'
  | 'gh_unauthenticated'
  | 'offline'
  | 'rate_limited'
  | 'timeout'
  | 'gh_failed'

type GhResult =
  | { kind: 'exited'; code: number; stdout: string; stderr: string }
  | { kind: 'missing' }
  | { kind: 'timeout' }

const REPOSITORY_URL = `https://github.com/${FEEDBACK_REPOSITORY}`
/** Pins github.com so a GH_HOST pointing at GitHub Enterprise never receives the report. */
const GH_REPOSITORY = `github.com/${FEEDBACK_REPOSITORY}`
const ISSUE_URL = new RegExp(`^${REPOSITORY_URL.replaceAll('.', '\\.')}/issues/(\\d+)$`)
const SIGNATURE = /^geniesig[0-9a-f]{12}$/
const GH_TIMEOUT_MS = 30_000
const GH_OUTPUT_LIMIT = 1_000_000
/** gh's documented exit status for "authentication required". */
const GH_AUTH_REQUIRED = 4
/** Browsers and GitHub reject much longer new-issue links. */
const NEW_ISSUE_URL_LIMIT = 8_000
/** Input beyond this is discarded before scrubbing; the message is cut far below it anyway. */
const INPUT_LIMIT_BYTES = 64 * 1024
const DRAFT_LIMIT_BYTES = 256 * 1024
const RETAINED_DRAFTS = 20
const PRIVATE_FILE_MODE = 0o600
const DRAFT_ID = /^fb_[0-9a-f-]{36}$/
const DRAFT_FILE = /^fb_[0-9a-f-]{36}\.(?:json|md)$/

const PUBLIC_NOTICE = `The issue is public on ${FEEDBACK_REPOSITORY} and posted from the GitHub account gh is signed in to.`

const RATE_LIMITED = /rate limit|HTTP 429|abuse detection/i
const OFFLINE =
  /error connecting to|could not resolve|no such host|dial tcp|connection refused|network is unreachable|i\/o timeout|TLS handshake|ECONNRESET|ETIMEDOUT/i
const SIGNED_OUT = /gh auth login|not logged in|authentication required|HTTP 401|Bad credentials/i
const LABEL_REJECTED = /could not add label|label[^\n]*not found|not found[^\n]*label/i

class FeedbackInputError extends Error {}

/** `genie-react feedback`: previews by default; only `--submit` runs gh, and nothing else ever leaves the machine. */
export async function runFeedbackCommand(options: FeedbackCommandOptions): Promise<number> {
  try {
    if (options.draft !== undefined) {
      const draft = readDraft(options)
      return await submit(draft, draft.id, options)
    }
    const report = await composeReport(options)
    const draft = saveDraft(report)
    return options.submit
      ? await submit(draft ?? issueOf(report), draft?.id, options)
      : preview(report, draft, options)
  } catch (error) {
    if (!(error instanceof FeedbackInputError)) throw error
    process.stdout.write(
      `${renderFailure(
        agentFailure('invalid_input', error.message, {
          userActionRequired: true,
          next: genieCommand(['feedback', '--help']),
        }),
        options.maxBytes,
      )}\n`,
    )
    return 1
  }
}

async function composeReport(options: FeedbackCommandOptions): Promise<FeedbackReport> {
  if (options.allowDuplicate && !options.submit) {
    throw new FeedbackInputError('--allow-duplicate applies to --submit only.')
  }
  if (options.message === undefined) {
    throw new FeedbackInputError(
      'Provide the report text with --message, or pass --message - and pipe it on stdin.',
    )
  }
  const kind = options.kind ?? 'bug'
  if (!isFeedbackKind(kind)) {
    throw new FeedbackInputError(`--kind must be one of ${FEEDBACK_KINDS.join(', ')}.`)
  }
  if (options.reason !== undefined && !isFeedbackReason(options.reason)) {
    throw new FeedbackInputError(
      '--reason must be the reason of a Genie failure, such as operational_failure or tool_error; feedback --help lists every accepted value.',
    )
  }
  if (options.tool !== undefined && !isGenieToolName(options.tool)) {
    throw new FeedbackInputError(
      `--tool must name a built-in Genie tool (${GENIE_TOOL_FAMILIES.map((family) => `${family}_*`).join(', ')}). App tools are not accepted, so their names stay private; describe the tool in the message instead.`,
    )
  }
  if (options.title !== undefined && options.title.trim() === '') {
    throw new FeedbackInputError(
      '--title must not be empty; omit it to use the first line of the message.',
    )
  }
  const { text, truncated } =
    options.message === '-'
      ? await readMessage(options.stdin ?? process.stdin)
      : boundedMessage(Buffer.from(options.message))
  if (text.trim() === '') {
    throw new FeedbackInputError(
      'The feedback message is empty. Describe what happened, what you expected, and how to reproduce it.',
    )
  }
  const cwd = options.cwd ?? process.cwd()
  return buildReport(
    {
      kind,
      message: text,
      title: options.title,
      reason: options.reason,
      tool: options.tool,
      messageTruncated: truncated,
    },
    collectDiagnostics(cwd, options.cliVersion),
    scrubContextFor(cwd),
  )
}

function boundedMessage(input: Buffer): { text: string; truncated: boolean } {
  if (input.length <= INPUT_LIMIT_BYTES) return { text: input.toString('utf8'), truncated: false }
  return {
    text: input
      .subarray(0, INPUT_LIMIT_BYTES)
      .toString('utf8')
      .replace(/\uFFFD+$/, ''),
    truncated: true,
  }
}

function readMessage(
  stdin: NodeJS.ReadableStream & { isTTY?: boolean },
): Promise<{ text: string; truncated: boolean }> {
  if (stdin.isTTY) {
    return Promise.reject(
      new FeedbackInputError(
        '--message - reads the report from stdin, but stdin is a terminal. Pipe the text in, or pass it as --message <text>.',
      ),
    )
  }
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let bytes = 0
    const finish = (): void => {
      stdin.removeListener('data', onData)
      stdin.pause()
      resolve(boundedMessage(Buffer.concat(chunks)))
    }
    const onData = (chunk: Buffer | string): void => {
      const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk
      chunks.push(buffer)
      bytes += buffer.length
      if (bytes > INPUT_LIMIT_BYTES) finish()
    }
    stdin.on('data', onData)
    stdin.once('end', finish)
    stdin.once('error', finish)
  })
}

function issueOf(report: FeedbackReport): Issue {
  return {
    title: report.title,
    body: renderBody(report),
    ...(report.signature ? { signature: report.signature } : {}),
  }
}

function preview(
  report: FeedbackReport,
  draft: Draft | undefined,
  options: FeedbackCommandOptions,
): number {
  const issue = draft ?? issueOf(report)
  writeEnvelope(
    envelope({
      status: 'ok',
      reason: 'feedback_preview',
      message: `Preview only; nothing was sent. ${PUBLIC_NOTICE} Show data.issue to the user and ${
        draft
          ? 'run next only after they agree.'
          : 'rerun this command with --submit only after they agree.'
      }`,
      userActionRequired: true,
      data: {
        sent: false,
        destination: {
          repository: FEEDBACK_REPOSITORY,
          url: `${REPOSITORY_URL}/issues`,
          visibility: 'public',
          author: 'the GitHub account gh is signed in to',
        },
        issue: { title: issue.title, body: issue.body, labels: [FEEDBACK_LABEL] },
        diagnostics: report.diagnostics,
        ...(report.failure ? { failure: report.failure } : {}),
        ...(report.signature ? { signature: report.signature } : {}),
        redactions: report.redactions,
        truncated: report.truncated,
        ...(draft ? { draft: { id: draft.id, path: draftPath(draft.id) } } : {}),
      },
      ...(draft ? { next: submitCommand(draft.id, false) } : {}),
    }),
    options.maxBytes,
  )
  return 0
}

async function submit(
  issue: Issue,
  draftId: string | undefined,
  options: FeedbackCommandOptions,
): Promise<number> {
  const failed = (cause: FallbackCause): number => fallback(issue, draftId, cause, options)
  if (issue.signature && !options.allowDuplicate) {
    const search = await runGh([
      'issue',
      'list',
      '--repo',
      GH_REPOSITORY,
      '--state',
      'open',
      `--search=${issue.signature} in:body`,
      '--json',
      'number,url,body',
      '--limit',
      '20',
    ])
    if (search.kind === 'missing') return failed('gh_missing')
    if (search.kind === 'timeout') return failed('offline')
    if (search.code === GH_AUTH_REQUIRED) return failed('gh_unauthenticated')
    const duplicate = search.code === 0 ? findDuplicate(search.stdout, issue.signature) : undefined
    if (duplicate) return reportDuplicate(duplicate, draftId, options)
  }
  let created = await createIssue(issue, true)
  const labelRejected =
    created.kind === 'exited' && created.code !== 0 && LABEL_REJECTED.test(created.stderr)
  if (labelRejected) created = await createIssue(issue, false)
  if (created.kind !== 'exited' || created.code !== 0) return failed(fallbackCause(created))
  if (draftId) removeDraft(draftId)
  const url = created.stdout
    .split('\n')
    .map((line) => line.trim())
    .findLast((line) => ISSUE_URL.test(line))
  const number = url ? Number(ISSUE_URL.exec(url)?.[1]) : undefined
  writeEnvelope(
    envelope({
      status: 'ok',
      reason: 'feedback_submitted',
      message: url
        ? `Filed ${url}. ${PUBLIC_NOTICE}`
        : `gh reported the issue as filed but printed no issue URL; find it at ${REPOSITORY_URL}/issues. ${PUBLIC_NOTICE}`,
      userActionRequired: false,
      data: {
        sent: true,
        issue: url ? { number, url } : null,
        labelRequested: !labelRejected,
      },
    }),
    options.maxBytes,
  )
  return 0
}

function createIssue(issue: Issue, withLabel: boolean): Promise<GhResult> {
  return runGh(
    [
      'issue',
      'create',
      '--repo',
      GH_REPOSITORY,
      `--title=${issue.title}`,
      '--body-file',
      '-',
      ...(withLabel ? [`--label=${FEEDBACK_LABEL}`] : []),
    ],
    issue.body,
  )
}

/** Search hits are only candidates: an issue counts as a duplicate when its diagnostics table carries the exact signature row. */
function findDuplicate(
  stdout: string,
  signature: string,
): { number: number; url: string } | undefined {
  let parsed: unknown
  try {
    parsed = JSON.parse(stdout)
  } catch {
    return undefined
  }
  if (!Array.isArray(parsed)) return undefined
  const row = SIGNATURE_ROW(signature)
  for (const issue of parsed) {
    if (!isRecord(issue)) continue
    const { number, url, body } = issue
    if (
      typeof number === 'number' &&
      Number.isSafeInteger(number) &&
      typeof url === 'string' &&
      ISSUE_URL.exec(url)?.[1] === String(number) &&
      typeof body === 'string' &&
      body.split(/\r?\n/).some((line) => line.trim() === row)
    ) {
      return { number, url }
    }
  }
  return undefined
}

function reportDuplicate(
  duplicate: { number: number; url: string },
  draftId: string | undefined,
  options: FeedbackCommandOptions,
): number {
  writeEnvelope(
    envelope({
      status: 'ok',
      reason: 'feedback_duplicate',
      message: `Nothing was sent: open issue #${duplicate.number} already reports this failure signature. Show ${duplicate.url} to the user; if theirs is a different problem, ${
        draftId ? 'run next' : 'rerun with --allow-duplicate'
      } to file a separate public issue.`,
      userActionRequired: true,
      data: { sent: false, duplicate },
      ...(draftId ? { next: submitCommand(draftId, true) } : {}),
    }),
    options.maxBytes,
  )
  return 0
}

function fallbackCause(result: GhResult): FallbackCause {
  if (result.kind === 'missing') return 'gh_missing'
  if (result.kind === 'timeout') return 'timeout'
  if (result.code === GH_AUTH_REQUIRED || SIGNED_OUT.test(result.stderr)) {
    return 'gh_unauthenticated'
  }
  if (RATE_LIMITED.test(result.stderr)) return 'rate_limited'
  if (OFFLINE.test(result.stderr)) return 'offline'
  return 'gh_failed'
}

const CAUSES: Record<FallbackCause, string> = {
  gh_missing: 'Nothing was sent: the GitHub CLI (gh) is not installed or not on PATH.',
  gh_unauthenticated:
    'Nothing was sent: gh is not signed in to github.com. Sign in with gh auth login.',
  offline: 'Nothing was sent: gh could not reach GitHub. Check the network connection.',
  rate_limited: 'Nothing was sent: GitHub rate-limited the request. Wait a few minutes.',
  timeout: `The issue may have been filed: gh did not finish within ${GH_TIMEOUT_MS / 1000} seconds. Check ${REPOSITORY_URL}/issues before filing again.`,
  gh_failed: 'Nothing was sent: gh exited with an error.',
}

/** Keeps the report on disk and hands a person a prefilled link, since only they can file it now. */
function fallback(
  issue: Issue,
  draftId: string | undefined,
  cause: FallbackCause,
  options: FeedbackCommandOptions,
): number {
  const reportPath = saveMarkdown(issue, draftId ?? `fb_${randomUUID()}`)
  const link = newIssueLink(issue)
  writeEnvelope(
    envelope({
      status: 'action_required',
      reason: 'feedback_not_sent',
      message: `${CAUSES[cause]} To file it in a browser, open data.newIssueUrl${
        link.shortened ? ' and paste the full report from data.reportPath' : ''
      }; ${draftId ? 'or fix the cause and run next' : 'or fix the cause and rerun with --submit'}. ${PUBLIC_NOTICE}`,
      userActionRequired: true,
      data: {
        sent: cause === 'timeout' ? 'unknown' : false,
        cause,
        newIssueUrl: link.url,
        linkShortened: link.shortened,
        ...(reportPath ? { reportPath } : {}),
        issue: { title: issue.title, body: issue.body },
      },
      ...(draftId ? { next: submitCommand(draftId, options.allowDuplicate) } : {}),
    }),
    options.maxBytes,
  )
  return 1
}

function newIssueLink(issue: Issue): { url: string; shortened: boolean } {
  const linkFor = (body: string): string =>
    `${REPOSITORY_URL}/issues/new?${new URLSearchParams({ title: issue.title, body, labels: FEEDBACK_LABEL })}`
  const full = linkFor(issue.body)
  if (full.length <= NEW_ISSUE_URL_LIMIT) return { url: full, shortened: false }
  const marker = '\n\n_The report was shortened to fit a prefilled new-issue link._'
  const characters = Array.from(issue.body)
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    if (linkFor(characters.slice(0, middle).join('') + marker).length <= NEW_ISSUE_URL_LIMIT) {
      low = middle
    } else {
      high = middle - 1
    }
  }
  return { url: linkFor(characters.slice(0, low).join('') + marker), shortened: true }
}

function runGh(args: readonly string[], input = ''): Promise<GhResult> {
  return new Promise((resolve) => {
    const child = spawn('gh', args, {
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GH_PROMPT_DISABLED: '1',
        GH_NO_UPDATE_NOTIFIER: '1',
        GH_SPINNER_DISABLED: '1',
        NO_COLOR: '1',
        CLICOLOR: '0',
      },
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    const settle = (result: GhResult): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(result)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      settle({ kind: 'timeout' })
    }, GH_TIMEOUT_MS)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk: string) => {
      if (stdout.length < GH_OUTPUT_LIMIT) stdout += chunk
    })
    child.stderr.on('data', (chunk: string) => {
      if (stderr.length < GH_OUTPUT_LIMIT) stderr += chunk
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      settle(
        error.code === 'ENOENT'
          ? { kind: 'missing' }
          : { kind: 'exited', code: -1, stdout: '', stderr: '' },
      )
    })
    child.on('close', (code) => settle({ kind: 'exited', code: code ?? -1, stdout, stderr }))
    child.stdin.on('error', () => undefined)
    child.stdin.end(input)
  })
}

function feedbackDirectory(): string {
  return join(genieUserDirectory(), 'feedback')
}

function draftPath(id: string): string {
  return join(feedbackDirectory(), `${id}.json`)
}

function submitCommand(id: string, allowDuplicate: boolean) {
  return genieCommand([
    'feedback',
    '--submit',
    '--draft',
    id,
    ...(allowDuplicate ? ['--allow-duplicate'] : []),
  ])
}

function prepareDirectory(): string {
  const directory = feedbackDirectory()
  ensurePrivateDirectory(dirname(directory))
  ensurePrivateDirectory(directory)
  return directory
}

/** A draft is a private local file, never sent; without one the caller can still rerun with --submit. */
function saveDraft(report: FeedbackReport): Draft | undefined {
  const draft: Draft = { id: `fb_${randomUUID()}`, ...issueOf(report) }
  try {
    prepareDirectory()
    writeFileSync(draftPath(draft.id), `${JSON.stringify(draft)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: PRIVATE_FILE_MODE,
    })
  } catch {
    return undefined
  }
  pruneDrafts()
  return draft
}

function readDraft(options: FeedbackCommandOptions): Draft {
  const id = options.draft ?? ''
  if (!options.submit) {
    throw new FeedbackInputError(
      '--draft applies to --submit only; run feedback --submit --draft <id>.',
    )
  }
  const composed = [options.message, options.title, options.kind, options.reason, options.tool]
  if (composed.some((value) => value !== undefined)) {
    throw new FeedbackInputError(
      '--draft files a saved preview unchanged, so it does not accept --message, --title, --kind, --reason or --tool. Preview again to change the report.',
    )
  }
  if (!DRAFT_ID.test(id)) {
    throw new FeedbackInputError(
      '--draft takes the ID a feedback preview returned in data.draft.id.',
    )
  }
  const parsed = readOwnedJson(draftPath(id))
  if (
    !isRecord(parsed) ||
    parsed.id !== id ||
    typeof parsed.title !== 'string' ||
    typeof parsed.body !== 'string' ||
    (parsed.signature !== undefined &&
      (typeof parsed.signature !== 'string' || !SIGNATURE.test(parsed.signature)))
  ) {
    throw new FeedbackInputError(
      `No saved feedback draft has that ID. Drafts are deleted once filed and only the newest ${RETAINED_DRAFTS} are kept; preview the report again.`,
    )
  }
  return {
    id,
    title: parsed.title,
    body: parsed.body,
    ...(parsed.signature ? { signature: parsed.signature } : {}),
  }
}

/** Only a regular file we own: another user's planted file or a symlink must never be filed in our name. */
function readOwnedJson(path: string): unknown {
  try {
    const info = lstatSync(path)
    if (!info.isFile() || !isOwnedByCurrentUser(info.uid) || info.size > DRAFT_LIMIT_BYTES) {
      return undefined
    }
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return undefined
  }
}

function saveMarkdown(issue: Issue, id: string): string | undefined {
  const path = join(feedbackDirectory(), `${id}.md`)
  try {
    prepareDirectory()
    writeFileSync(path, `Title: ${issue.title}\n\n${issue.body}\n`, {
      encoding: 'utf8',
      mode: PRIVATE_FILE_MODE,
    })
  } catch {
    return undefined
  }
  return path
}

function removeDraft(id: string): void {
  for (const extension of ['json', 'md']) {
    rmSync(join(feedbackDirectory(), `${id}.${extension}`), { force: true })
  }
}

/** Removes only our own regular draft files beyond the newest few; anything else in the directory is left alone. */
function pruneDrafts(): void {
  const directory = feedbackDirectory()
  let names: string[]
  try {
    names = readdirSync(directory).filter((name) => DRAFT_FILE.test(name))
  } catch {
    return
  }
  const drafts = names.flatMap((name) => {
    const path = join(directory, name)
    try {
      const info = lstatSync(path)
      return info.isFile() && isOwnedByCurrentUser(info.uid)
        ? [{ path, modified: info.mtimeMs }]
        : []
    } catch {
      return []
    }
  })
  drafts.sort((left, right) => right.modified - left.modified)
  for (const stale of drafts.slice(RETAINED_DRAFTS)) rmSync(stale.path, { force: true })
}

function envelope(fields: {
  status: 'ok' | 'action_required'
  reason: string
  message: string
  userActionRequired: boolean
  data: Record<string, unknown>
  next?: { command: string; argv: string[] }
}) {
  return { schemaVersion: CLI_OUTPUT_SCHEMA_VERSION, ...fields }
}
