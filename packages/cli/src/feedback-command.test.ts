import * as childProcess from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PassThrough } from 'node:stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runFeedbackCommand } from './feedback-command'

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>()
  return { ...actual, spawn: vi.fn(actual.spawn) }
})

interface GhResponse {
  code?: number
  stdout?: string
  stderr?: string
}

/** Responses per gh subcommand (`list`, `create`); the nth call gets the nth entry, the last one repeating. */
type Scenario = Partial<Record<'list' | 'create', GhResponse[]>>

interface GhCall {
  argv: string[]
  stdin: string
  promptDisabled?: string
}

const ISSUE = 'https://github.com/Genie-sa/genie-react/issues/321'

const FAKE_GH = `#!${process.execPath}
const fs = require('node:fs')
const scenario = JSON.parse(fs.readFileSync(process.env.FAKE_GH_SCENARIO, 'utf8'))
const log = process.env.FAKE_GH_LOG
let stdin = ''
process.stdin.setEncoding('utf8')
process.stdin.on('data', (chunk) => { stdin += chunk })
process.stdin.on('end', () => {
  const argv = process.argv.slice(2)
  const previous = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').split('\\n').filter(Boolean) : []
  const same = previous.filter((line) => JSON.parse(line).argv[1] === argv[1]).length
  fs.appendFileSync(log, JSON.stringify({ argv, stdin, promptDisabled: process.env.GH_PROMPT_DISABLED }) + '\\n')
  const responses = scenario[argv[1]] ?? [{ code: 1, stderr: 'unexpected gh call' }]
  const response = responses[Math.min(same, responses.length - 1)]
  process.stdout.write(response.stdout ?? '')
  process.stderr.write(response.stderr ?? '')
  process.exitCode = response.code ?? 0
})
`

let workspace: string
let stdout: string[]

function install(scenario: Scenario): void {
  writeFileSync(join(workspace, 'scenario.json'), JSON.stringify(scenario))
  const gh = join(workspace, 'bin', 'gh')
  writeFileSync(gh, FAKE_GH)
  chmodSync(gh, 0o755)
}

function ghCalls(): GhCall[] {
  const log = join(workspace, 'gh.log')
  if (!existsSync(log)) return []
  return readFileSync(log, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as GhCall)
}

function piped(text: string): PassThrough {
  const stream = new PassThrough()
  stream.end(text)
  return stream
}

async function feedback(options: Partial<Parameters<typeof runFeedbackCommand>[0]> = {}) {
  stdout.length = 0
  const code = await runFeedbackCommand({
    submit: false,
    allowDuplicate: false,
    cliVersion: '0.19.0',
    cwd: workspace,
    ...options,
  })
  expect(stdout).toHaveLength(1)
  return { code, result: JSON.parse(stdout[0] ?? '') }
}

beforeEach(() => {
  workspace = mkdtempSync(join(tmpdir(), 'genie-feedback-'))
  for (const directory of ['bin', 'runtime']) {
    childProcess.execFileSync('mkdir', [join(workspace, directory)])
  }
  vi.mocked(childProcess.spawn).mockClear()
  vi.stubEnv('PATH', join(workspace, 'bin'))
  vi.stubEnv('XDG_RUNTIME_DIR', join(workspace, 'runtime'))
  vi.stubEnv('FAKE_GH_SCENARIO', join(workspace, 'scenario.json'))
  vi.stubEnv('FAKE_GH_LOG', join(workspace, 'gh.log'))
  stdout = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk))
    return true
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  rmSync(workspace, { recursive: true, force: true })
})

describe('preview', () => {
  it('runs no process and makes no network request', async () => {
    install({ create: [{ stdout: `${ISSUE}\n` }] })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)

    const { code, result } = await feedback({
      message: 'render causes are empty',
      reason: 'tool_error',
    })

    expect(code).toBe(0)
    expect(childProcess.spawn).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(ghCalls()).toEqual([])
    expect(result).toMatchObject({
      status: 'ok',
      reason: 'feedback_preview',
      userActionRequired: true,
      data: {
        sent: false,
        destination: { repository: 'Genie-sa/genie-react', visibility: 'public' },
        issue: { labels: ['agent-feedback'] },
      },
    })
    expect(result.message).toContain('nothing was sent')
    expect(result.message).toContain('public')
    expect(result.message).toContain('GitHub account')
  })

  it('saves a private draft whose submit command carries only its CLI-minted ID', async () => {
    const { result } = await feedback({
      message: '$(touch pwned) `id` ; rm -rf ~',
      title: "'; echo hi",
    })

    const { id, path } = result.data.draft
    expect(id).toMatch(/^fb_[0-9a-f-]{36}$/)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    expect(result.next.argv.slice(-3)).toEqual(['--submit', '--draft', id])
    expect(result.next.command).not.toMatch(/touch|echo|rm -rf/)
  })

  it('reads the message from piped stdin', async () => {
    const { result } = await feedback({ message: '-', stdin: piped('from a pipe\nsecond line') })
    expect(result.data.issue.title).toBe('Bug: from a pipe')
    expect(result.data.issue.body).toContain('from a pipe\nsecond line')
  })

  it('refuses --message - on a terminal instead of waiting for input', async () => {
    const terminal = Object.assign(new PassThrough(), { isTTY: true })
    const { code, result } = await feedback({ message: '-', stdin: terminal })
    expect(code).toBe(1)
    expect(result).toMatchObject({ status: 'error', reason: 'invalid_input' })
    expect(result.message).toContain('stdin is a terminal')
  })

  it('stops reading stdin at its byte limit and reports the cut', async () => {
    const { result } = await feedback({ message: '-', stdin: piped('x'.repeat(200_000)) })
    expect(result.data.truncated.message).toBe(true)
  })

  it('never includes environment variables or files from the project', async () => {
    vi.stubEnv('ACME_API_TOKEN', 'env-secret-value-123')
    writeFileSync(
      join(workspace, 'package.json'),
      JSON.stringify({ name: 'acme-internal', dependencies: { next: '*' } }),
    )
    writeFileSync(join(workspace, 'secret.ts'), 'export const key = "file-secret-value"')

    const { result } = await feedback({ message: 'plain report' })

    expect(stdout[0]).not.toMatch(/env-secret-value|acme-internal|file-secret-value/)
    expect(result.data.diagnostics.framework).toBe('nextjs')
  })

  it.each([
    [{ message: undefined }, '--message'],
    [{ message: '   \n ' }, 'empty'],
    [{ message: '-', stdin: piped('') }, 'empty'],
    [{ message: 'x', kind: 'rant-secret' }, '--kind must be one of bug, friction, idea, docs'],
    [{ message: 'x', reason: 'made_up_secret' }, '--reason'],
    [{ message: 'x', tool: 'app_acme_refund' }, 'App tools are not accepted'],
    [{ message: 'x', tool: 'react_get_tree;rm' }, '--tool'],
    [{ message: 'x', title: '  ' }, '--title'],
    [{ message: 'x', allowDuplicate: true }, '--allow-duplicate applies to --submit only'],
    [{ draft: 'fb_00000000-0000-0000-0000-000000000000' }, '--draft applies to --submit only'],
    [
      { submit: true, draft: 'fb_00000000-0000-0000-0000-000000000000', message: 'x' },
      'does not accept',
    ],
    [{ submit: true, draft: '../../etc/passwd' }, 'data.draft.id'],
    [{ submit: true, draft: 'fb_00000000-0000-0000-0000-000000000000' }, 'No saved feedback draft'],
  ])('rejects %o without echoing it', async (options, expected) => {
    install({})
    const { code, result } = await feedback(options)
    expect(code).toBe(1)
    expect(result).toMatchObject({
      status: 'error',
      reason: 'invalid_input',
      userActionRequired: true,
      next: { argv: expect.arrayContaining(['feedback', '--help']) },
    })
    expect(result.message).toContain(expected)
    expect(stdout[0]).not.toMatch(/secret|acme|passwd|;rm/)
    expect(ghCalls()).toEqual([])
  })
})

describe('submit', () => {
  it('files exactly the previewed draft through gh, with argv values and the body on stdin', async () => {
    install({ create: [{ stdout: `Creating issue in Genie-sa/genie-react\n\n${ISSUE}\n` }] })
    const title = '$(touch pwned) `id`; rm -rf ~ && echo "x" | cat'
    const { result: previewed } = await feedback({
      message: 'line one\n$(whoami) && `id`\n--label hack',
      title,
      reason: 'operational_failure',
    })

    const { code, result } = await feedback({
      submit: true,
      allowDuplicate: true,
      draft: previewed.data.draft.id,
    })

    expect(code).toBe(0)
    expect(result).toMatchObject({
      status: 'ok',
      reason: 'feedback_submitted',
      userActionRequired: false,
      data: { sent: true, issue: { number: 321, url: ISSUE }, labelRequested: true },
    })
    expect(result.message).toContain('public')
    expect(result.message).toContain('GitHub account')
    const [call] = ghCalls()
    expect(call?.argv).toEqual([
      'issue',
      'create',
      '--repo',
      'github.com/Genie-sa/genie-react',
      `--title=${previewed.data.issue.title}`,
      '--body-file',
      '-',
      '--label=agent-feedback',
    ])
    expect(call?.stdin).toBe(previewed.data.issue.body)
    expect(call?.promptDisabled).toBe('1')
    expect(existsSync(join(workspace, 'pwned'))).toBe(false)
    expect(vi.mocked(childProcess.spawn).mock.calls[0]?.[2]).toMatchObject({ shell: false })
    expect(existsSync(previewed.data.draft.path)).toBe(false)
  })

  it('files a one-step report without a duplicate search when no failure reason is given', async () => {
    install({ create: [{ stdout: `${ISSUE}\n` }] })
    const { code } = await feedback({ submit: true, message: 'docs are unclear', kind: 'docs' })
    expect(code).toBe(0)
    expect(ghCalls().map((call) => call.argv[1])).toEqual(['create'])
  })

  it('retries without the label when the repository does not have it', async () => {
    install({
      create: [
        { code: 1, stderr: "could not add label: 'agent-feedback' not found\n" },
        { stdout: `${ISSUE}\n` },
      ],
    })
    const { code, result } = await feedback({ submit: true, message: 'x' })
    expect(code).toBe(0)
    expect(result.data).toMatchObject({ sent: true, labelRequested: false })
    const calls = ghCalls()
    expect(calls).toHaveLength(2)
    expect(calls[0]?.argv).toContain('--label=agent-feedback')
    expect(calls[1]?.argv.some((arg) => arg.startsWith('--label'))).toBe(false)
  })

  it('does not retry an unrelated failure, which could file the issue twice', async () => {
    install({ create: [{ code: 1, stderr: 'GraphQL: something failed (createIssue)\n' }] })
    const { code, result } = await feedback({ submit: true, message: 'x' })
    expect(code).toBe(1)
    expect(result.data.cause).toBe('gh_failed')
    expect(ghCalls()).toHaveLength(1)
  })

  it('reports success without a URL when gh prints none', async () => {
    install({ create: [{ stdout: 'done\n' }] })
    const { code, result } = await feedback({ submit: true, message: 'x' })
    expect(code).toBe(0)
    expect(result.data).toMatchObject({ sent: true, issue: null })
  })

  describe('when gh cannot file it', () => {
    it.each([
      [
        'gh_unauthenticated',
        { code: 4, stderr: 'To get started with GitHub CLI, please run:  gh auth login\n' },
      ],
      [
        'gh_unauthenticated',
        { code: 1, stderr: 'HTTP 401: Bad credentials (https://api.github.com/graphql)\n' },
      ],
      [
        'offline',
        { code: 1, stderr: 'error connecting to api.github.com\ncheck your internet connection\n' },
      ],
      ['rate_limited', { code: 1, stderr: 'GraphQL: API rate limit exceeded for user ID 1.\n' }],
      [
        'gh_failed',
        {
          code: 2,
          stderr:
            `\u001b[31mpanic: runtime error\u001b[0m ghp_${'A'.repeat(36)} /Users/someone/private\n`.repeat(
              50,
            ),
        },
      ],
    ] as const)(
      'falls back to a saved report and a prefilled link (%s)',
      async (cause, response) => {
        install({ create: [response] })
        const { code, result } = await feedback({
          submit: true,
          message: 'the tree is empty',
          reason: 'tool_error',
        })

        expect(code).toBe(1)
        expect(result).toMatchObject({
          status: 'action_required',
          reason: 'feedback_not_sent',
          userActionRequired: true,
          data: { sent: false, cause, linkShortened: false },
        })
        expect(result.message).toMatch(/^Nothing was sent/)
        expect(result.message).toContain('public')
        expect(result.next.argv).toEqual(
          expect.arrayContaining(['feedback', '--submit', '--draft']),
        )
        expect(stdout[0]).not.toMatch(/panic|ghp_|someone|\\u001b/)
        const link = new URL(result.data.newIssueUrl)
        expect(`${link.origin}${link.pathname}`).toBe(
          'https://github.com/Genie-sa/genie-react/issues/new',
        )
        expect(link.searchParams.get('title')).toBe(result.data.issue.title)
        expect(link.searchParams.get('body')).toBe(result.data.issue.body)
        expect(readFileSync(result.data.reportPath, 'utf8')).toContain(result.data.issue.body)
        expect(statSync(result.data.reportPath).mode & 0o777).toBe(0o600)
      },
    )

    it('falls back when gh is not installed', async () => {
      const { code, result } = await feedback({ submit: true, message: 'x', reason: 'tool_error' })
      expect(code).toBe(1)
      expect(result.data.cause).toBe('gh_missing')
      expect(result.data.newIssueUrl).toMatch(
        /^https:\/\/github\.com\/Genie-sa\/genie-react\/issues\/new\?/,
      )
    })

    it('shortens a long report to fit the prefilled link and marks the cut', async () => {
      const words = Array.from({ length: 1500 }, (_, index) => `step ${index} & détail`).join(' ')
      const { result } = await feedback({ submit: true, message: words })
      expect(result.data.linkShortened).toBe(true)
      expect(result.data.newIssueUrl.length).toBeLessThanOrEqual(8_000)
      expect(new URL(result.data.newIssueUrl).searchParams.get('body')).toMatch(
        /_The report was shortened to fit a prefilled new-issue link\._$/,
      )
      expect(result.message).toContain('data.reportPath')
      expect(readFileSync(result.data.reportPath, 'utf8')).toContain(result.data.issue.body)
    })
  })

  describe('duplicate detection', () => {
    async function signature(): Promise<string> {
      const { result } = await feedback({
        message: 'x',
        reason: 'tool_error',
        tool: 'react_get_tree',
      })
      return result.data.signature
    }

    it('returns the open issue with the same signature instead of filing another', async () => {
      const sig = await signature()
      install({
        list: [
          {
            stdout: JSON.stringify([
              {
                number: 9,
                url: 'https://github.com/Genie-sa/genie-react/issues/9',
                body: `| Signature | \`${sig}\` |`,
              },
            ]),
          },
        ],
        create: [{ stdout: `${ISSUE}\n` }],
      })

      const { code, result } = await feedback({
        submit: true,
        message: 'same failure again',
        reason: 'tool_error',
        tool: 'react_get_tree',
      })

      expect(code).toBe(0)
      expect(result).toMatchObject({
        reason: 'feedback_duplicate',
        userActionRequired: true,
        data: {
          sent: false,
          duplicate: { number: 9, url: 'https://github.com/Genie-sa/genie-react/issues/9' },
        },
      })
      expect(result.next.argv).toEqual(expect.arrayContaining(['--draft', '--allow-duplicate']))
      const calls = ghCalls()
      expect(calls.map((call) => call.argv[1])).toEqual(['list'])
      expect(calls[0]?.argv).toEqual(
        expect.arrayContaining([
          '--repo',
          'github.com/Genie-sa/genie-react',
          `--search=${sig} in:body`,
        ]),
      )
    })

    it('files anyway when search hits only mention the signature or point elsewhere', async () => {
      const sig = await signature()
      install({
        list: [
          {
            stdout: JSON.stringify([
              {
                number: 1,
                url: 'https://github.com/Genie-sa/genie-react/issues/1',
                body: `see ${sig} here`,
              },
              {
                number: 2,
                url: 'https://github.com/evil/repo/issues/2',
                body: `| Signature | \`${sig}\` |`,
              },
              {
                number: 3,
                url: 'https://github.com/Genie-sa/genie-react/issues/4',
                body: `| Signature | \`${sig}\` |`,
              },
              'not an issue',
            ]),
          },
        ],
        create: [{ stdout: `${ISSUE}\n` }],
      })
      const { result } = await feedback({
        submit: true,
        message: 'x',
        reason: 'tool_error',
        tool: 'react_get_tree',
      })
      expect(result.reason).toBe('feedback_submitted')
      expect(ghCalls().map((call) => call.argv[1])).toEqual(['list', 'create'])
    })

    it('files anyway when the search itself fails', async () => {
      install({ list: [{ code: 1, stderr: 'HTTP 502\n' }], create: [{ stdout: `${ISSUE}\n` }] })
      const { result } = await feedback({ submit: true, message: 'x', reason: 'busy' })
      expect(result.reason).toBe('feedback_submitted')
    })

    it('stops at the search when gh is signed out', async () => {
      install({ list: [{ code: 4 }], create: [{ stdout: `${ISSUE}\n` }] })
      const { result } = await feedback({ submit: true, message: 'x', reason: 'busy' })
      expect(result.data.cause).toBe('gh_unauthenticated')
      expect(ghCalls().map((call) => call.argv[1])).toEqual(['list'])
    })

    it('skips the search with --allow-duplicate', async () => {
      install({ create: [{ stdout: `${ISSUE}\n` }] })
      await feedback({ submit: true, allowDuplicate: true, message: 'x', reason: 'busy' })
      expect(ghCalls().map((call) => call.argv[1])).toEqual(['create'])
    })
  })
})
