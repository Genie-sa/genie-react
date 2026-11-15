import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { createStandaloneBridge } from '../packages/genie-react/dist/hub.js'
import { decodeFrame, encodeMessage } from '../packages/genie-react/dist/protocol.js'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('..', import.meta.url))
const cli = join(root, 'packages/cli/dist/cli.js')
const require = createRequire(join(root, 'packages/cli/package.json'))
const { WebSocket } = require('ws')
const fixture = await mkdtemp(join(tmpdir(), 'genie-json-cli-'))
const cleanups = []
const env = {
  ...process.env,
  GENIE_BRIDGE_URL: '',
  GENIE_BRIDGE_TOKEN: '',
  GENIE_SESSION: '',
  GENIE_SKILL_DIR: '',
  NO_COLOR: '1',
}
let checks = 0

function lines(text) {
  if (text === '') return []
  assert(text.endsWith('\n'), 'JSONL must end with a newline')
  assert(!text.includes('\u001b'), 'Output contains terminal control codes')
  return text
    .slice(0, -1)
    .split('\n')
    .map((line) => JSON.parse(line))
}
async function exec(argv, { code = 0, cwd = fixture, environment = env } = {}) {
  let result
  try {
    result = {
      ...(await execute(process.execPath, [cli, ...argv], {
        cwd,
        env: environment,
        timeout: 15000,
        maxBuffer: 2000000,
      })),
      code: 0,
    }
  } catch (error) {
    assert.equal(typeof error.code, 'number', 'CLI subprocess failed to complete')
    result = error
  }
  assert.equal(result.code, code, `${argv.join(' ')}: ${result.stdout}\n${result.stderr}`)
  assert(!result.stdout.includes('\u001b') && !result.stderr.includes('\u001b'), 'ANSI escape')
  return result
}
/** A JSON transcript: `--json` is appended, so every document checked here is the unchanged JSON contract. */
async function run(
  argv,
  { code = 0, cwd = fixture, jsonl = false, diagnostics = false, extraEnv = {} } = {},
) {
  const machine = argv.includes('--ndjson') || argv.includes('--json')
  const result = await exec(machine ? argv : [...argv, '--json'], {
    code,
    cwd,
    environment: { ...env, ...extraEnv },
  })
  const records = lines(result.stdout)
  const diagnosticRecords = lines(result.stderr)
  if (!diagnostics) assert.equal(diagnosticRecords.length, 0, 'Unexpected stderr')
  if (!jsonl) assert.equal(records.length, 1, 'Finite command must return exactly one JSON value')
  checks++
  return {
    value: jsonl ? records : records[0],
    stdout: result.stdout,
    diagnostics: diagnosticRecords,
  }
}
async function until(predicate) {
  const deadline = Date.now() + 10000
  while (!predicate()) {
    assert(Date.now() < deadline, 'Timed out waiting for CLI state')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
}

try {
  const { value: help } = await run(['--help'])
  assert.equal(help.status, 'ok')
  assert.deepEqual((await run([])).value, help)
  assert.equal(help.commands.length, 10)
  for (const { name } of help.commands) {
    const { value } = await run([name, '--help'])
    assert.equal(value.command, name)
    assert(value.options.json)
    assert.equal(value.options['max-bytes'].default, 102400)
    assert(Array.isArray(value.arguments))
    if (name === 'tools') assert.equal(value.options.wait.default, 12000)
    if (name === 'capture') assert.equal(value.options.output.required, true)
  }
  const version = (await run(['--version'])).value
  assert.equal(typeof version.version, 'string')
  assert.deepEqual((await run(['--version', '--json'])).value, version)
  const legacy = () => ({ ...env, GENIE_OUTPUT: 'json' })
  for (const argv of [['--help'], ['call', '--help'], ['--version'], ['doctor'], ['call']]) {
    const code = argv[0] === 'doctor' || (argv[0] === 'call' && argv.length === 1) ? 1 : 0
    assert.equal(
      (await exec(argv, { code, environment: legacy() })).stdout,
      (await exec([...argv, '--json'], { code })).stdout,
      `GENIE_OUTPUT=json must print exactly what --json prints for ${argv.join(' ')}`,
    )
  }
  for (const argv of [
    ['secret-token-command'],
    ['__proto__'],
    ['--secret-token-flag'],
    ['--url'],
    ['status', '--port', '1234'],
    ['status', 'secret-token-extra'],
    ['call'],
    ['call', 'app_echo', '{"secret-token":'],
    ['batch', '{"secret-token":'],
    ['batch', '[]', '--json', '--ndjson'],
    ['capture', 'export'],
    ['capture', 'export', 'id', '--section', 'secret-token-section'],
    ['feedback'],
    ['feedback', '--message', 'x', '--kind', 'secret-token-kind'],
    ['feedback', '--message', 'x', '--tool', 'app_secret-token'],
    ['feedback', '--submit', '--draft', 'secret-token-draft'],
  ]) {
    const result = await run(argv, { code: 1 })
    assert.equal(result.value.status, 'error')
    assert.equal(typeof result.value.reason, 'string')
    assert.equal(typeof result.value.userActionRequired, 'boolean')
    assert(!result.stdout.includes('secret-token'), 'Invalid input was echoed')
  }
  const feedbackEnv = { extraEnv: { XDG_RUNTIME_DIR: fixture, PATH: join(fixture, 'no-gh') } }
  const feedbackPreview = (
    await run(
      ['feedback', '--message', 'crash in $(whoami)', '--reason', 'tool_error'],
      feedbackEnv,
    )
  ).value
  assert.equal(feedbackPreview.reason, 'feedback_preview')
  assert.equal(feedbackPreview.data.sent, false)
  assert.deepEqual(feedbackPreview.next.argv.slice(-3), [
    '--submit',
    '--draft',
    feedbackPreview.data.draft.id,
  ])
  const feedbackFallback = (
    await run(['feedback', '--submit', '--draft', feedbackPreview.data.draft.id], {
      ...feedbackEnv,
      code: 1,
    })
  ).value
  assert.equal(feedbackFallback.status, 'action_required')
  assert.equal(feedbackFallback.data.cause, 'gh_missing')
  assert.equal(feedbackFallback.data.issue.body, feedbackPreview.data.issue.body)
  assert(
    feedbackFallback.data.newIssueUrl.startsWith(
      'https://github.com/Genie-sa/genie-react/issues/new?',
    ),
  )
  const failedDoctor = (await run(['doctor'], { code: 1 })).value
  assert.equal(failedDoctor.status, 'error')
  assert.equal(failedDoctor.reason, 'checks_failed')
  assert.equal(failedDoctor.userActionRequired, true)
  const cappedHelp = await run(['tools', '--help', '--max-bytes', '512'])
  assert.equal(cappedHelp.value.status, 'truncated')
  assert(Buffer.byteLength(cappedHelp.stdout) <= 512)

  await writeFile(
    join(fixture, 'package.json'),
    JSON.stringify({ private: true, devDependencies: { vite: '*' } }),
  )
  await writeFile(join(fixture, 'vite.config.ts'), 'export default { plugins: [] }\n')
  const preview = (await run(['init', '--dry-run'])).value
  assert.equal(preview.data.dryRun, true)
  assert(!JSON.stringify(preview).includes('export default'))
  assert.equal(
    await readFile(join(fixture, 'vite.config.ts'), 'utf8'),
    'export default { plugins: [] }\n',
  )
  const linked = await run(['link', root])
  assert.equal(linked.value.status, 'ok')
  const applied = (await run(['init', '--yes'])).value
  assert.equal(applied.data.dryRun, false)
  assert(applied.data.artifacts.some((artifact) => artifact.status === 'applied'))
  const doctor = await run(['doctor'])
  assert(Array.isArray(doctor.value.checks))

  const bridge = createStandaloneBridge()
  cleanups.push(() => bridge.close())
  const { url } = await bridge.listen()
  env.GENIE_BRIDGE_TOKEN = bridge.bridge.agentToken
  const app = new WebSocket(`${url}?role=app`)
  cleanups.push(() => app.close())
  await new Promise((resolve, reject) => {
    app.once('open', resolve)
    app.once('error', reject)
  })
  app.on('message', (raw) => {
    const request = decodeFrame(raw.toString())
    if (request.kind !== 'bridge/request') return
    app.send(
      encodeMessage({
        kind: 'app/response',
        id: request.id,
        ok: true,
        result:
          request.tool === 'app_large'
            ? { body: '界'.repeat(request.args?.size ?? 30000) }
            : { value: 'line one\nline two', empty: [], count: 0, missing: null },
      }),
    )
  })
  app.send(
    encodeMessage({
      kind: 'app/hello',
      protocol: 1,
      sessionId: 'json-cli-test',
      app: { name: 'JSON fixture' },
      capabilities: ['app'],
      tools: ['app_echo', 'app_large'].map((name) => ({
        name,
        title: name,
        description: 'JSON output fixture',
        group: 'app',
      })),
    }),
  )
  app.send(encodeMessage({ kind: 'app/ready', sessionId: 'json-cli-test' }))
  await until(() => bridge.bridge.getStatus().ready)
  for (const argv of [
    ['status'],
    ['tools'],
    ['tools', 'app'],
    ['tools', 'app_echo'],
    ['call', 'app_echo', '{}'],
  ]) {
    const explicit = await run([...argv, '--url', url])
    const legacyOutput = await exec([...argv, '--url', url], { environment: legacy() })
    if (argv[0] === 'call' || argv[0] === 'tools')
      assert.equal(legacyOutput.stdout, explicit.stdout)
  }
  const verbose = await run(['status', '--url', url, '--verbose'], { diagnostics: true })
  assert(verbose.diagnostics.length > 0)
  const large = await run(['call', 'app_large', '{}', '--url', url])
  assert(Buffer.byteLength(large.stdout) > 65536)
  assert.equal(large.value.body.length, 30000)
  const capped = await run(['call', 'app_large', '{"size":100000}', '--url', url])
  assert.equal(capped.value.status, 'truncated')
  assert(Buffer.byteLength(capped.stdout) <= 102400)
  assert.equal(
    JSON.parse(await readFile(capped.value.outputPath, 'utf8')).body.length,
    100000,
    'an oversized call must spill its complete result',
  )
  assert(capped.value.suggestions.some((suggestion) => suggestion.argv.includes('--max-bytes')))
  const rows = (
    await run(['call', 'app_echo', '{}', '--fields', 'count,missing', '--url', url], {
      jsonl: true,
    })
  ).value
  assert.deepEqual(rows, [{ count: 0, missing: null }])
  const unverified = await run(['call', 'app_echo', '{}', '--fields', 'unknown', '--url', url], {
    jsonl: true,
    diagnostics: true,
  })
  assert.equal(unverified.stdout, '')
  assert.equal(unverified.diagnostics[0].reason, 'fields_unverified')
  const batchArgs = ['batch', '[{"tool":"app_echo"},{"tool":"app_echo"}]', '--url', url]
  assert.equal((await run([...batchArgs, '--ndjson'], { jsonl: true })).value.length, 2)
  assert.equal((await run(batchArgs)).value.length, 2)
  assert.equal(
    lines((await exec(batchArgs, { environment: legacy() })).stdout).length,
    2,
    'GENIE_OUTPUT=json keeps the JSONL batch default',
  )

  const hubDir = join(fixture, 'hub')
  await mkdir(hubDir)
  const child = spawn(process.execPath, [cli, 'hub', '--json'], {
    cwd: hubDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let hubStdout = ''
  let hubStderr = ''
  child.stdout.on('data', (chunk) => {
    hubStdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    hubStderr += chunk
  })
  const exit = new Promise((resolve, reject) => {
    child.once('close', resolve)
    child.once('error', reject)
  })
  cleanups.push(async () => {
    if (child.exitCode === null) child.kill('SIGTERM')
    await exit
  })
  await until(() => hubStdout.includes('\n'))
  const ready = lines(hubStdout)[0]
  assert.equal(ready.event, 'ready')
  assert.equal((await run(['hub'], { cwd: hubDir })).value.event, 'reused')
  child.kill('SIGINT')
  await until(() => child.exitCode !== null)
  assert.equal(await exit, 0)
  assert.deepEqual(
    lines(hubStdout).map((event) => event.event),
    ['ready', 'stopped'],
  )
  assert.equal(hubStderr, '')
  await assert.rejects(readFile(join(hubDir, '.genie/bridge.json')), { code: 'ENOENT' })
  checks++

  const occupied = createServer((socket) => socket.destroy())
  await new Promise((resolve) => occupied.listen(0, '127.0.0.1', resolve))
  cleanups.push(() => new Promise((resolve) => occupied.close(resolve)))
  const failedHub = await run(['hub', '--port', String(occupied.address().port)], {
    code: 1,
    cwd: hubDir,
  })
  assert.equal(failedHub.value.reason, 'port_busy')
  const disconnected = await run(
    ['status', '--url', `ws://127.0.0.1:${ready.data.port}/__genie/ws`, '--connect-timeout', '100'],
    { code: 1 },
  )
  assert.equal(disconnected.value.status, 'error')

  const textHelp = (await exec(['--help'])).stdout
  assert(textHelp.startsWith('genie-react: '), 'help is text by default')
  assert.equal((await exec([])).stdout, textHelp)
  for (const { name } of help.commands) {
    const commandHelp = (await exec([name, '--help'])).stdout
    assert(commandHelp.startsWith(`${name}: `) && commandHelp.includes('  --json  '))
  }
  assert.equal((await exec(['--version'])).stdout, `${version.version}\n`)
  for (const argv of [
    ['secret-token-command'],
    ['--secret-token-flag'],
    ['call'],
    ['status', 'secret-token-extra'],
  ]) {
    const { stdout } = await exec(argv, { code: 1 })
    const [first, second] = stdout.split('\n')
    assert.match(first, /^error invalid_input: /, `${argv.join(' ')} must lead with its reason`)
    assert.match(second, /^next: \$ /)
    assert(!stdout.includes('secret-token'), 'Invalid input was echoed')
  }
  const badFormat = await exec(['status'], {
    code: 1,
    environment: { ...env, GENIE_OUTPUT: 'xml' },
  })
  assert.match(badFormat.stdout, /^error invalid_input: GENIE_OUTPUT must be text or json\./)
  assert.equal(
    (await exec(['call', 'app_echo', '{}', '--url', url])).stdout,
    'value: "line one\\nline two"\nempty: []\ncount: 0\nmissing: null\n',
  )
  const textCapped = await exec(['call', 'app_large', '{"size":100000}', '--url', url])
  assert.match(textCapped.stdout, /^truncated max_bytes: /)
  assert(Buffer.byteLength(textCapped.stdout) <= 102400)
  const spilled = /^outputPath: (.+\.txt)$/m.exec(textCapped.stdout)?.[1]
  assert(spilled, 'a text truncation names its spill file')
  assert.equal(
    await readFile(spilled, 'utf8'),
    `body: "${'界'.repeat(100000)}"\n`,
    'a text spill holds the complete text result',
  )
  assert.match(textCapped.stdout, /^ {4}\$ .* --max-bytes \d+$/m)
  assert.equal(
    (await exec(['call', 'app_echo', '{}', '--fields', 'count,missing', '--url', url])).stdout,
    '[1]:\n  - {count:0,missing:null}\n',
  )
  const textUnverified = await exec(['call', 'app_echo', '{}', '--fields', 'unknown', '--url', url])
  assert.equal(textUnverified.stdout, '')
  assert.match(textUnverified.stderr, /^! fields_unverified: /)
  const textBatch = (await exec(batchArgs)).stdout
  assert.deepEqual(
    textBatch.split('\n').filter((line) => line.startsWith('[')),
    ['[1/2] app_echo ok', '[2/2] app_echo ok'],
  )
  const textVerbose = await exec(['status', '--url', url, '--verbose'])
  const diagnosticLines = textVerbose.stderr.trimEnd().split('\n')
  assert(diagnosticLines.length > 0 && diagnosticLines.every((line) => line.startsWith('! ')))
  assert.match(
    (await exec(['doctor'], { cwd: hubDir, code: 1 })).stdout,
    /^error checks_failed: [^\n]+\nchecks\[\d+\] /,
  )
  const textHub = spawn(process.execPath, [cli, 'hub'], {
    cwd: hubDir,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let textHubStdout = ''
  textHub.stdout.on('data', (chunk) => {
    textHubStdout += chunk
  })
  const textHubExit = new Promise((resolve, reject) => {
    textHub.once('close', resolve)
    textHub.once('error', reject)
  })
  cleanups.push(async () => {
    if (textHub.exitCode === null) textHub.kill('SIGTERM')
    await textHubExit
  })
  await until(() => textHubStdout.includes('\n'))
  assert.match(textHubStdout, /^ok hub_ready: The local hub is available\.\n/)
  textHub.kill('SIGINT')
  assert.equal(await textHubExit, 0)
  assert.match(textHubStdout, /\nok hub_stopped: Stopped the local hub\.\n/)
  checks += 2
} finally {
  for (const cleanup of cleanups.reverse()) await cleanup()
  await rm(fixture, { recursive: true, force: true })
}

console.log(JSON.stringify({ status: 'passed', check: 'CLI JSON and text transcripts', checks }))
