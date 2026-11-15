#!/usr/bin/env node
// Drives the built CLI's verify command against a real Vite app in Chromium: one scenario per false-pass row the release covers, each asserting the verdict is never pass when the claim is false, plus clean scenarios that must pass.
//   node scripts/check-verify-e2e.mjs            run every scenario
//   node scripts/check-verify-e2e.mjs --record   also re-record the verify text fixtures in packages/cli/fixtures/output
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(join(root, 'apps/router-demo/package.json'))
const { createServer } = await import(require.resolve('vite'))
const react = (await import(require.resolve('@vitejs/plugin-react'))).default
const { genie } = await import(new URL('../packages/genie-react/dist/vite.js', import.meta.url))
const SESSION = 'verify-e2e'
const RECORD = process.argv.includes('--record')
const fixture = await mkdtemp(join(root, 'apps/router-demo/.genie-verify-'))
const results = []
let server
let browser

const badgeSource = `import { memo } from 'react'
export const StatusBadge = memo(function StatusBadge({ appearance }) {
  return <span data-tone={appearance.tone}>Pager on call</span>
})
`

const searchSource = (fixed, marker = '') => `import { useState } from 'react'
import { StatusBadge } from './StatusBadge.jsx'
const stableAppearance = { tone: 'success' }
export function ResultCount({ query }) {
  return <output>{query.length} results${marker}</output>
}
export function SearchScreen() {
  const [query, setQuery] = useState('')
  return (
    <section>
      <button type="button" onClick={() => setQuery(query + 'c')}>type</button>
      <ResultCount query={query} />
      <StatusBadge appearance={${fixed ? 'stableAppearance' : "{ tone: 'success' }"}} />
    </section>
  )
}
`

const scenarioSource = `import { Component, memo, StrictMode, useEffect, useState } from 'react'
export const DebouncedBadge = memo(function DebouncedBadge({ results }) {
  return <span>{results.label}</span>
})
export function DebouncedSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState({ label: 'idle' })
  useEffect(() => {
    if (!query) return
    const timer = setTimeout(() => setResults({ label: 'results for ' + query }), 300)
    return () => clearTimeout(timer)
  }, [query])
  return <section><button type="button" onClick={() => setQuery(query + 'c')}>debounced type</button><DebouncedBadge results={results} /></section>
}
export function OrderRow({ id, version }) {
  return <li>{id}:{version}</li>
}
export function OrdersTable() {
  const [version, setVersion] = useState(0)
  const rows = []
  for (let id = 0; id < 1500; id += 1) rows.push(<OrderRow key={id} id={id} version={version} />)
  return <section><button type="button" onClick={() => setVersion(version + 1)}>bump orders</button><ul>{rows}</ul></section>
}
export const KeyedRow = memo(function KeyedRow() {
  return <span>keyed</span>
})
export function KeyedList() {
  const [count, setCount] = useState(0)
  return <section><button type="button" onClick={() => setCount(count + 1)}>rekey</button><KeyedRow key={count} /></section>
}
let broken = false
function Thrower() {
  if (broken) throw new Error('save failed')
  return <span>saved</span>
}
class SaveBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    if (!this.state.failed) return this.props.children
    return <button type="button" onClick={() => { broken = false; this.setState({ failed: false }) }}>retry save</button>
  }
}
export function SaveForm() {
  const [, setAttempt] = useState(0)
  return <section><button type="button" onClick={() => { broken = true; setAttempt((attempt) => attempt + 1) }}>save</button><SaveBoundary><Thrower /></SaveBoundary></section>
}
export function Poller() {
  const [mode, setMode] = useState('idle')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (mode === 'idle' || (mode === 'once' && tick > 0)) return
    const timer = setTimeout(() => setTick((value) => value + 1), 700)
    return () => clearTimeout(timer)
  }, [mode, tick])
  return <section><button type="button" onClick={() => setMode('loop')}>start polling</button><button type="button" onClick={() => setMode('once')}>poll once</button><span>tick {tick}</span></section>
}
export function Modal() {
  useEffect(() => {}, [])
  return <dialog open>modal</dialog>
}
export function ModalHost() {
  const [open, setOpen] = useState(false)
  return <section><button type="button" onClick={() => setOpen(true)}>open modal</button>{open ? <StrictMode><Modal /></StrictMode> : null}</section>
}
`

const mainSource = `import { createRoot } from 'react-dom/client'
import { Genie } from 'genie-react'
import { SearchScreen } from './Search.jsx'
import { DebouncedSearch, KeyedList, ModalHost, OrdersTable, Poller, SaveForm } from './Scenarios.jsx'
createRoot(document.getElementById('root')).render(
  <main>
    <SearchScreen />
    <DebouncedSearch />
    <KeyedList />
    <SaveForm />
    <Poller />
    <ModalHost />
    <OrdersTable />
    <Genie />
  </main>,
)
`

function runCli(args, env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [join(root, 'packages/cli/dist/cli.js'), ...args],
      { cwd: fixture, env, timeout: 120_000, maxBuffer: 4_000_000 },
      (error, stdout, stderr) => {
        const code = error ? (typeof error.code === 'number' ? error.code : 1) : 0
        resolve({ code, stdout, stderr })
      },
    )
  })
}

try {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.jsx"></script>',
  )
  await writeFile(join(fixture, 'main.jsx'), mainSource)
  await writeFile(join(fixture, 'StatusBadge.jsx'), badgeSource)
  await writeFile(join(fixture, 'Search.jsx'), searchSource(false))
  await writeFile(join(fixture, 'Scenarios.jsx'), scenarioSource)
  server = await createServer({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    plugins: [genie(), react()],
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer.address()
  assert.ok(address && typeof address !== 'string')
  const url = `http://127.0.0.1:${address.port}`
  const env = {
    ...process.env,
    GENIE_BRIDGE_URL: `ws://127.0.0.1:${address.port}/__genie/ws`,
    GENIE_SESSION: SESSION,
    GENIE_OUTPUT: '',
  }
  const json = async (args) => {
    const result = await runCli([...args, '--json'], env)
    let parsed
    try {
      parsed = JSON.parse(result.stdout)
    } catch {
      throw new Error(
        `genie-react ${args.join(' ')} printed non-JSON (exit ${result.code}): ${result.stdout}${result.stderr}`,
      )
    }
    return { ...result, json: parsed }
  }
  browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`${url}/?_genie=${SESSION}`)
  await page.getByRole('button', { name: 'type', exact: true }).waitFor()
  assert.equal(
    (await json(['call', 'devtools_wait', '{"condition":"ready","timeoutMs":15000}'])).json.ok,
    true,
  )

  const click = (name, times = 1) =>
    (async () => {
      for (let index = 0; index < times; index += 1)
        await page.getByRole('button', { name, exact: true }).click()
    })()
  const recorded = []
  async function verify(name, claims, drive, extra = []) {
    const began = await json([
      'verify',
      'begin',
      '--name',
      name,
      ...claims.flatMap((claim) => ['--claim', claim]),
      ...extra,
    ])
    if (began.json.state !== 'recording') return { began, ended: began }
    await drive?.(began.json)
    const ended = await json(['verify', 'end', began.json.verificationId])
    return { began, ended }
  }
  function expectVerdict(scenario, outcome, verdict, exitCode, check) {
    const { ended } = outcome
    assert.equal(
      ended.json.verdict,
      verdict,
      `${scenario}: verdict ${ended.json.verdict}, expected ${verdict}\n${JSON.stringify(ended.json, null, 2)}`,
    )
    assert.equal(ended.code, exitCode, `${scenario}: exit ${ended.code}, expected ${exitCode}`)
    assert.equal(
      ended.json.exitCode,
      exitCode,
      `${scenario}: exitCode field must match the process exit code`,
    )
    check?.(ended.json)
    results.push({ scenario, verdict, exitCode })
  }
  const command = (next) => next.argv.slice(next.argv.indexOf('genie-react') + 1)
  const claimReason = (document, index) =>
    document.claims[index]?.refusal?.reason ?? document.claims[index]?.inconclusive?.reason

  const badgeClaims = ['render StatusBadge max 0', 'render ResultCount min 1', 'boundaries clean']

  const broken = await verify('type in filter', badgeClaims, () => click('type', 3))
  expectVerdict('memo bug fails with exact evidence', broken, 'fail', 1, (document) => {
    assert.deepEqual(
      document.claims.map((claim) => claim.verdict),
      ['fail', 'pass', 'pass'],
    )
    assert.equal(document.claims[0].observed.semantics, 'exact')
    assert.equal(document.claims[0].observed.renders, 3)
  })
  recorded.push({
    name: 'verify-end-fail',
    argv: ['verify', 'end', '<id>'],
    exitCode: broken.ended.code,
    result: broken.ended.json,
  })

  const lock = await json([
    'verify',
    'begin',
    '--name',
    'lock check',
    '--claim',
    'render StatusBadge max 0',
  ])
  const resetAttempt = await json(['call', 'react_clear_renders', '{}'])
  assert.equal(resetAttempt.code, 1, 'a window reset during a verification must fail')
  assert.equal(resetAttempt.json.reason, 'conflict')
  assert.equal(resetAttempt.json.details.hubCode, 'VERIFICATION_ACTIVE')
  assert.deepEqual(command(resetAttempt.json.next), [
    'verify',
    'end',
    lock.json.verificationId,
    '--session',
    SESSION,
  ])
  assert.deepEqual(
    resetAttempt.json.exit,
    { code: 1, class: 'failure' },
    'the failure reports the exit code call will use',
  )
  const aborted = await json(['verify', 'abort', lock.json.verificationId])
  assert.equal(aborted.json.state, 'aborted')
  assert.equal(
    (await json(['call', 'react_clear_renders', '{}'])).code,
    0,
    'abort releases the lock',
  )
  results.push({
    scenario: 'document lock refuses a reset and abort releases it',
    verdict: 'locked',
    exitCode: resetAttempt.code,
  })

  await writeFile(join(fixture, 'Search.jsx'), searchSource(true))
  await page.waitForFunction(() => document.querySelector('[data-tone]') !== null)
  await new Promise((resolve) => setTimeout(resolve, 1_000))
  const fixed = await verify('type in filter', badgeClaims, () => click('type', 3))
  expectVerdict(
    'the edited code passes and the rerun history notes the change',
    fixed,
    'pass',
    0,
    (document) => {
      assert.equal(document.claims[0].observed.renders, 0)
      assert.equal(document.claims[0].observed.semantics, 'exact')
      assert.equal(document.ledger.attempt, 2, 'the rerun must count as the second attempt')
      assert.ok(
        ['fast-refresh', 'document-reloaded'].includes(document.ledger.codeChangedSincePrevious),
      )
      assert.equal(
        document.ledger.failsOnSameCode,
        0,
        'a fail before a code change is not a fail on the same code',
      )
    },
  )
  recorded.push({
    name: 'verify-end-pass',
    argv: ['verify', 'end', '<id>'],
    exitCode: fixed.ended.code,
    result: fixed.ended.json,
  })

  const text = await runCli(['verify', 'show', fixed.ended.json.verificationId], env)
  assert.equal(text.code, 0)
  assert.match(text.stdout.split('\n')[0], /^pass vfy_[0-9a-f-]{36} "type in filter"/)
  assert.ok(text.stdout.includes('! ui-outcome-not-observed:'), 'text must state the UI caveat')

  const idle = await verify('nothing happened', badgeClaims, undefined)
  expectVerdict('no interaction fails the positive control', idle, 'fail', 1, (document) => {
    assert.equal(claimReason(document, 0), 'no_activity')
    assert.equal(document.claims[1].verdict, 'fail')
  })
  const idleOnly = await verify('nothing happened', ['render StatusBadge max 0'], undefined)
  expectVerdict(
    'no interaction without a control is refused',
    idleOnly,
    'refused',
    4,
    (document) => {
      assert.equal(document.window.refusals[0].refusal.reason, 'no_activity')
    },
  )
  recorded.push({
    name: 'verify-end-refused',
    argv: ['verify', 'end', '<id>'],
    exitCode: idleOnly.ended.code,
    result: idleOnly.ended.json,
  })

  const late = await verify('debounced search', ['render DebouncedBadge max 0'], () =>
    click('debounced type'),
  )
  expectVerdict('a render 300 ms after the interaction is inside the window', late, 'fail', 1)

  const budget = await verify(
    'bump orders',
    ['render OrderRow max 5000'],
    () => click('bump orders'),
    [
      '--budget',
      '{"fiberLimit":50,"operationLimit":1000,"targetOperationReserve":100,"adaptive":false}',
    ],
  )
  expectVerdict('a budget that skipped the target refuses', budget, 'refused', 4, (document) => {
    assert.equal(claimReason(document, 0), 'budget_exhausted')
  })
  let attempt = budget.ended.json
  for (let rerun = 1; attempt.verdict !== 'pass'; rerun += 1) {
    assert.ok(rerun <= 5, 'following the printed fix must converge within five reruns')
    assert.equal(
      claimReason(attempt, 0),
      'budget_exhausted',
      'every rerun short of the fit must refuse, never pass',
    )
    const fix = attempt.claims[0].refusal.next
    assert.ok(
      fix?.argv.includes('--budget'),
      'the refusal must carry the begin command with the suggested budget',
    )
    const retried = await json(command(fix))
    assert.equal(retried.json.state, 'recording', 'the suggested begin command must start a window')
    await click('bump orders')
    attempt = (await json(['verify', 'end', retried.json.verificationId])).json
  }
  assert.equal(attempt.claims[0].observed.renders, 1500)
  assert.equal(attempt.claims[0].observed.semantics, 'exact')
  results.push({
    scenario: 'following the printed budget fix reaches an exact pass',
    verdict: 'pass',
    exitCode: 0,
  })

  const remount = await verify('rekey', ['render KeyedRow max 0 counting updates'], () =>
    click('rekey', 2),
  )
  expectVerdict('a key change that turns updates into mounts fails', remount, 'fail', 1)

  const renamed = await verify(
    'renamed',
    ['render StatusBadgeV2 max 0', 'render ResultCount min 1'],
    () => click('type'),
  )
  expectVerdict(
    'a renamed target is not a target that did nothing',
    renamed,
    'refused',
    4,
    (document) => {
      assert.equal(claimReason(document, 0), 'target_not_found')
    },
  )

  const reload = await verify('reload', ['render StatusBadge max 0'], async () => {
    await page.reload()
    await page.getByRole('button', { name: 'type', exact: true }).waitFor()
    await json(['call', 'devtools_wait', '{"condition":"ready","timeoutMs":15000}'])
  })
  expectVerdict('a reload in the window refuses', reload, 'refused', 4, (document) => {
    assert.equal(claimReason(document, 0), 'session_changed')
  })

  const hidden = await verify('hidden tab', ['render StatusBadge max 0'], async () => {
    await page.evaluate(() => {
      const set = (state) => {
        Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
        document.dispatchEvent(new Event('visibilitychange'))
      }
      set('hidden')
      set('visible')
    })
    await click('type')
  })
  expectVerdict('a hidden interval refuses', hidden, 'refused', 4, (document) => {
    assert.equal(claimReason(document, 0), 'document_hidden')
  })
  await page.reload()
  await page.getByRole('button', { name: 'type', exact: true }).waitFor()
  await json(['call', 'devtools_wait', '{"condition":"ready","timeoutMs":15000}'])

  const refreshed = await verify('edit during window', ['render StatusBadge max 0'], async () => {
    await writeFile(join(fixture, 'Search.jsx'), searchSource(true, ' (edited)'))
    await new Promise((resolve) => setTimeout(resolve, 1_000))
    await click('type')
  })
  expectVerdict(
    'an edit applied during the window refuses',
    refreshed,
    'refused',
    4,
    (document) => {
      assert.ok(['code_changed', 'session_changed'].includes(claimReason(document, 0)))
    },
  )

  const badge = (
    await json(['call', 'react_find_components', '{"query":"StatusBadge","exact":true}'])
  ).json.matches?.[0]
  assert.ok(badge, 'the badge must be findable for the override scenario')
  await json([
    'call',
    'react_override_props',
    JSON.stringify({ id: badge.id, props: { appearance: { tone: 'forced' } } }),
  ])
  const overridden = await verify('override', ['render StatusBadge max 0'], () => click('type'))
  expectVerdict('an active override refuses at begin', overridden, 'refused', 4, (document) => {
    assert.equal(claimReason(document, 0), 'override_active')
    assert.deepEqual(command(document.claims[0].refusal.next), [
      'call',
      'react_reset_overrides',
      '{}',
      '--session',
      SESSION,
    ])
  })
  await json(['call', 'react_reset_overrides', '{}'])

  const caught = await verify('save', ['boundaries clean', 'boundaries clean-at-end'], async () => {
    await click('save')
    await click('retry save')
  })
  expectVerdict(
    'a boundary that caught and reset in the window fails',
    caught,
    'fail',
    1,
    (document) => {
      assert.deepEqual(
        document.claims.map((claim) => claim.verdict),
        ['fail', 'pass'],
      )
    },
  )

  const looping = await verify('poll', ['effect Poller settles'], () => click('start polling'), [
    '--tail-ms',
    '2500',
  ])
  expectVerdict('an effect that keeps running after settle fails', looping, 'fail', 1)
  await page.reload()
  await page.getByRole('button', { name: 'type', exact: true }).waitFor()
  await json(['call', 'devtools_wait', '{"condition":"ready","timeoutMs":15000}'])
  const once = await verify('poll once', ['effect Poller settles'], () => click('poll once'), [
    '--quiet-ms',
    '1000',
  ])
  expectVerdict(
    'an effect that stops running passes with its horizon',
    once,
    'pass',
    0,
    (document) => {
      assert.ok(document.claims[0].caveats.includes('horizon'))
    },
  )

  const strict = await verify('open modal', ['effect Modal max 1'], () => click('open modal'))
  expectVerdict(
    'a StrictMode replay alone is inconclusive, not a fail',
    strict,
    'inconclusive',
    5,
    (document) => {
      assert.equal(claimReason(document, 0), 'strict_mode_replay')
    },
  )

  const repeat = await json(['verify', 'end', fixed.ended.json.verificationId])
  assert.deepEqual(repeat.json, fixed.ended.json, 'a repeated end returns the stored verdict')
  const lost = await json(['verify', 'end', 'vfy_00000000-0000-4000-8000-000000000000'])
  assert.equal(lost.code, 4, 'an unknown verification is refused, never passed')
  assert.equal(lost.json.window.refusals[0].refusal.reason, 'window_lost')
  const badClaim = await json([
    'verify',
    'begin',
    '--name',
    'bad',
    '--claim',
    'rendr StatusBadge max 0',
  ])
  assert.equal(badClaim.code, 2, 'a malformed claim is a usage error')
  assert.match(badClaim.json.message, /did you mean render/)
  assert.deepEqual(badClaim.json.exit, { code: 2, class: 'usage' })
  const unknownFlag = await runCli(['verify', 'begin', '--clam', 'x', '--json'], env)
  assert.equal(unknownFlag.code, 2, 'an unknown verify option is a usage error')

  assert.deepEqual(
    errors.filter((message) => !message.includes('save failed')),
    [],
    'the fixture must stay functional',
  )
  if (RECORD) {
    for (const entry of recorded) {
      await writeFile(
        join(root, 'packages/cli/fixtures/output', `${entry.name}.json`),
        `${JSON.stringify({ argv: entry.argv, exitCode: entry.exitCode, result: entry.result }, null, 2)}\n`,
      )
    }
  }
  console.log(JSON.stringify({ status: 'passed', scenarios: results }, null, 2))
} finally {
  await browser?.close()
  await server?.close()
  await rm(fixture, { recursive: true, force: true })
}
