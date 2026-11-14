import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MESSAGE_LIMIT, TITLE_LIMIT } from './feedback-options'
import {
  buildReport,
  collectDiagnostics,
  type FeedbackDiagnostics,
  type FeedbackInput,
  failureSignature,
  type RedactionRule,
  renderBody,
  type ScrubContext,
  scrub,
} from './feedback-report'

const HOME = '/Users/dev-person'
const PROJECT = '/work/acme-checkout'
const CONTEXT: ScrubContext = { home: HOME, projectRoots: [PROJECT] }
const DIAGNOSTICS: FeedbackDiagnostics = {
  cliVersion: '0.19.0',
  node: 'v22.12.0',
  platform: 'linux',
  arch: 'x64',
  packageManager: 'pnpm',
  framework: 'vite',
}

function scrubbed(text: string): { text: string; counts: Partial<Record<RedactionRule, number>> } {
  const counts = new Map<RedactionRule, number>()
  return { text: scrub(text, CONTEXT, counts), counts: Object.fromEntries(counts) }
}

function report(input: Partial<FeedbackInput> & { message: string }) {
  return buildReport({ kind: 'bug', ...input }, DIAGNOSTICS, CONTEXT)
}

/** The fenced report region as GitHub would parse it: everything up to the first line that closes the opening fence. */
function fencedMessage(body: string): { inside: string; after: string } {
  const lines = body.split('\n')
  const open = lines.findIndex((line) => /^`{3,}text$/.test(line))
  const fence = lines[open]?.replace(/text$/, '') ?? ''
  const close = lines.findIndex(
    (line, index) => index > open && /^`{3,}\s*$/.test(line) && line.trim().length >= fence.length,
  )
  return {
    inside: lines.slice(open + 1, close).join('\n'),
    after: lines.slice(close + 1).join('\n'),
  }
}

describe('scrub', () => {
  it.each([
    ['ghp_0123456789abcdefghijABCDEFGHIJ0123', 'api_key'],
    ['github_pat_11ABCDEFG0123456789_abcdefghijklmnop', 'api_key'],
    ['sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz', 'api_key'],
    ['sk_live_51Habcdefghij012345', 'api_key'],
    ['xoxb-1234567890-abcdefghij', 'api_key'],
    ['AKIAIOSFODNN7EXAMPLE', 'api_key'],
    ['AIzaSyA-1234567890abcdefghijklmnopqrstu', 'api_key'],
    ['glpat-abcdefghij0123456789', 'api_key'],
    ['npm_abcdefghijklmnopqrstuvwxyz0123456789', 'api_key'],
    [
      'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U',
      'jwt',
    ],
    ['k8Fz2QpL9xWv3RtY7uNb1MhJ4sDc6GaE0', 'high_entropy'],
    ['0123456789abcdef0123456789abcdef', 'high_entropy'],
  ] as const)('redacts %s', (secret, rule) => {
    const result = scrubbed(`the call failed with ${secret} in the log`)
    expect(result.text).not.toContain(secret)
    expect(result.text).toMatch(/^the call failed with \[redacted[^\]]*\] in the log$/)
    expect(result.counts).toEqual({ [rule]: 1 })
  })

  it('redacts bearer and basic credentials but keeps the scheme readable', () => {
    const result = scrubbed('Authorization: Bearer abc.def-ghi_123 and Basic dXNlcjpwYXNzd29yZA==')
    expect(result.text).toBe('Authorization: Bearer [redacted] and Basic [redacted]')
  })

  it('redacts secret assignments in every common spelling', () => {
    const result = scrubbed(
      'password=hunter22 API_KEY: "s3cr3t-value" client_secret=\'abcd1234\' sessionId=deadbeef',
    )
    expect(result.text).toBe(
      'password=[redacted] API_KEY: "[redacted]" client_secret=\'[redacted]\' sessionId=[redacted]',
    )
    expect(result.counts.secret_assignment).toBe(4)
  })

  it('redacts a private key block, and an unterminated one through the end of the text', () => {
    const block =
      '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA\n-----END OPENSSH PRIVATE KEY-----'
    expect(scrubbed(`before\n${block}\nafter`).text).toBe('before\n[redacted private key]\nafter')
    expect(scrubbed('key: -----BEGIN RSA PRIVATE KEY-----\nMIIEow cut off here').text).toBe(
      'key: [redacted private key]',
    )
  })

  it('removes URL credentials, query strings and fragments but keeps the host and path', () => {
    const result = scrubbed(
      'see https://admin:pa55@staging.example.com/orders/7?token=abc&user=42#frag, then http://localhost:5173/cart.',
    )
    expect(result.text).toBe(
      'see https://staging.example.com/orders/7, then http://localhost:5173/cart.',
    )
    expect(result.counts).toEqual({ url_credentials: 1, url_query: 1 })
  })

  it('drops a URL that cannot be parsed instead of passing it through', () => {
    expect(scrubbed('open http://[::1/broken?secret=1 now').text).toBe('open [redacted url] now')
  })

  it('replaces the project before the home directory it lives in', () => {
    const counts = new Map<RedactionRule, number>()
    const nested: ScrubContext = { home: HOME, projectRoots: [`${HOME}/dev/shop`] }
    expect(scrub(`${HOME}/dev/shop/src/App.tsx and ${HOME}/.config/x`, nested, counts)).toBe(
      '<project>/src/App.tsx and <home>/.config/x',
    )
    expect(Object.fromEntries(counts)).toEqual({ project_path: 1, home_path: 1 })
  })

  it('matches whole path segments only', () => {
    expect(scrubbed(`${PROJECT}/a ${PROJECT}-old/b ${PROJECT}2`).text).toBe(
      `<project>/a ${PROJECT}-old/b ${PROJECT}2`,
    )
  })

  it("replaces other users' home directories and Windows profiles", () => {
    expect(
      scrubbed('/home/ci-runner/work and C:\\Users\\Pat\\repo and file:///Users/sam/x').text,
    ).toBe('<home>/work and <home>\\repo and file://<home>/x')
  })

  it('redacts email addresses', () => {
    expect(scrubbed('ask jane.doe+genie@corp.example.co.uk').text).toBe('ask [redacted email]')
  })

  it.each([
    ['one long word', 'x'.repeat(65_536)],
    ['dotted runs', 'a.'.repeat(32_768)],
    ['dashed runs', 'a-'.repeat(32_768)],
    ['a secret keyword with no value', `token${'x'.repeat(65_000)}`],
    ['an email-like run with no domain', `${'a'.repeat(65_000)}@`],
    ['scheme-like runs', 'a+'.repeat(32_768)],
  ])('scrubs 64 KB of %s in linear time', (_label, text) => {
    const started = performance.now()
    scrubbed(text)
    expect(performance.now() - started).toBeLessThan(1_000)
  })

  it('keeps the ordinary details a useful report needs', () => {
    const text =
      'react_render_causes on src/components/CheckoutRow.tsx with react@19.1.0, @genie-react/cli 0.19.0, http://localhost:5173/cart, ~/dev, commit abc1234'
    expect(scrubbed(text)).toEqual({ text, counts: {} })
  })
})

describe('buildReport', () => {
  it('keeps hostile Markdown, HTML and a forged diagnostics block inside the fence', () => {
    const message = [
      'Steps:',
      '```',
      '````',
      '### Diagnostics',
      '| Field | Value |',
      '| --- | --- |',
      '| Signature | `geniesig000000000000` |',
      '<details><summary>click</summary><img src=x onerror=alert(1)></details>',
      '<!-- hidden -->',
      '@octocat please look, fixes #12 and GH-3',
    ].join('\n')
    const body = renderBody(report({ message }))
    const { inside, after } = fencedMessage(body)
    expect(inside).toBe(message)
    expect(body.match(/^### Diagnostics$/gm)).toHaveLength(2)
    expect(after.match(/^### Diagnostics$/gm)).toHaveLength(1)
    expect(after).not.toContain('geniesig000000000000')
    expect(after).not.toMatch(/<|@octocat|#12/)
  })

  it('neutralizes mentions and references in the title so filing it notifies and links nothing', () => {
    const { title } = report({
      message: 'x',
      title: 'ping @octocat about #12, GH-7 and acme/app#3',
    })
    expect(title).not.toMatch(/@[A-Za-z0-9]|#\d|GH-\d/)
    expect(title.replaceAll('\u200b', '')).toBe('Bug: ping @octocat about #12, GH-7 and acme/app#3')
  })

  it('collapses a multi-line title so it cannot start a heading or table', () => {
    const { title } = report({ message: 'x', title: 'crash\n### Diagnostics\r\n| a |' })
    expect(title).toBe('Bug: crash ### Diagnostics | a |')
  })

  it('strips bidirectional overrides and control characters that could hide text', () => {
    const built = report({
      message: 'safe \u202eevil\u202c text\u0007\u001b[31m red',
      title: 'a\u2066b',
    })
    expect(built.message).toBe('safe evil text[31m red')
    expect(built.title).toBe('Bug: ab')
  })

  it('takes the title from the first non-empty message line and scrubs it', () => {
    const { title } = report({
      message: `\n\ncrash in ${PROJECT}/src/a.ts\nmore`,
      kind: 'friction',
    })
    expect(title).toBe('Friction: crash in <project>/src/a.ts')
  })

  it('redacts a secret in the title as well as the message, and counts both', () => {
    const built = report({
      message: 'token=abcd1234',
      title: 'leaks ghp_0123456789abcdefghijABCDEFGHIJ',
    })
    expect(built.title).toBe('Bug: leaks [redacted token]')
    expect(built.redactions).toEqual({ secret_assignment: 1, api_key: 1 })
    expect(renderBody(built)).toContain('_2 values were redacted before sending._')
  })

  it('caps the message and title on character boundaries and says so', () => {
    const emoji = '\u{1F600}'
    const built = report({
      message: `${'a'.repeat(MESSAGE_LIMIT - 1)}${emoji}${emoji}tail`,
      title: `${'t'.repeat(TITLE_LIMIT - 1)}${emoji}overflow`,
    })
    expect(Array.from(built.message)).toHaveLength(MESSAGE_LIMIT)
    expect(built.message.endsWith(emoji)).toBe(true)
    expect(built.title).toBe(`Bug: ${'t'.repeat(TITLE_LIMIT - 1)}${emoji}…`)
    expect(built.truncated).toEqual({ title: true, message: true })
    expect(renderBody(built)).toContain('_The message was cut to 6,000 characters._')
  })

  it('redacts before cutting, so a secret straddling the limit leaves no prefix behind', () => {
    const secret = 'ghp_0123456789abcdefghijABCDEFGHIJ'
    const built = report({ message: `${'a '.repeat((MESSAGE_LIMIT - 10) / 2)}${secret}` })
    expect(built.truncated.message).toBe(true)
    expect(built.message).not.toMatch(/ghp_|0123456789/)
  })

  it('reports a cut made while reading stdin', () => {
    expect(report({ message: 'short', messageTruncated: true }).truncated.message).toBe(true)
  })

  it('signs a failure by reason and tool only, so reports of one failure group together', () => {
    const first = report({ message: 'one', reason: 'tool_error', tool: 'react_get_tree' })
    const second = report({
      message: 'two',
      kind: 'friction',
      reason: 'tool_error',
      tool: 'react_get_tree',
    })
    expect(first.signature).toBe(second.signature)
    expect(first.signature).toMatch(/^geniesig[0-9a-f]{12}$/)
    expect(failureSignature('tool_error', undefined)).not.toBe(first.signature)
    expect(renderBody(first)).toContain(`| Signature | \`${first.signature}\` |`)
    expect(report({ message: 'no failure' }).signature).toBeUndefined()
  })
})

describe('collectDiagnostics', () => {
  let root: string | undefined

  afterEach(() => {
    if (root) rmSync(root, { recursive: true, force: true })
    root = undefined
  })

  function writePackage(directory: string, contents: unknown): void {
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'package.json'), JSON.stringify(contents))
  }

  it('reports only fixed vocabularies and version strings, never project names or scripts', () => {
    root = mkdtempSync(join(tmpdir(), 'genie-feedback-diagnostics-'))
    const app = join(root, 'apps', 'mobile')
    writePackage(root, { name: 'acme-private-monorepo', private: true })
    writeFileSync(join(root, 'pnpm-lock.yaml'), 'lockfileVersion: 9\n')
    writePackage(app, {
      name: 'acme-secret-app',
      scripts: { deploy: 'TOKEN=supersecret ./deploy.sh' },
      dependencies: { expo: '*', 'react-native': '*', react: '*' },
      devDependencies: { vite: '*' },
    })
    writePackage(join(root, 'node_modules', 'react'), { version: '19.1.0' })
    writePackage(join(root, 'node_modules', 'genie-react'), { version: '0.19.0</td><script>' })

    const diagnostics = collectDiagnostics(app, '0.19.0')

    expect(diagnostics).toEqual({
      cliVersion: '0.19.0',
      node: process.version,
      platform: process.platform,
      arch: process.arch,
      packageManager: 'pnpm',
      framework: 'expo',
      reactVersion: '19.1.0',
    })
    expect(JSON.stringify(diagnostics)).not.toMatch(/acme|supersecret|script/)
  })

  it('reports unknown for a directory without a package.json and drops a malformed CLI version', () => {
    root = mkdtempSync(join(tmpdir(), 'genie-feedback-empty-'))
    const diagnostics = collectDiagnostics(root, 'x y')
    expect(diagnostics.framework).toBe('unknown')
    expect(diagnostics.cliVersion).toBe('unknown')
  })
})
