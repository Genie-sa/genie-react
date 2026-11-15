#!/usr/bin/env node
// Genie beside agent-browser in a real browser: the real agent-browser CLI drives a Vite demo app while the built Genie CLI reads it, covering the shared session, snapshot refs, and agent-browser's React DevTools hook next to Genie's.
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const cliEntry = join(root, 'packages/cli/dist/cli.js')
const COMMAND_TIMEOUT_MS = 60_000

const APP_SOURCE = `
import { createElement as h, useState } from 'react'
import { createRoot } from 'react-dom/client'
function SaveButton({ onSave }) {
  return h('button', { onClick: onSave }, 'Save')
}
function CoveredButton() {
  return h('button', null, 'Covered')
}
function Overlay() {
  return h('div', { 'aria-hidden': true, style: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)' } })
}
function FooterButton() {
  return h('button', null, 'Footer action')
}
function Counter() {
  const [count, setCount] = useState(0)
  return h('main', null,
    h('h1', null, 'Count ' + count),
    h(SaveButton, { onSave: () => setCount(count + 1) }),
    h('section', { style: { position: 'relative', display: 'inline-block', marginLeft: 16 } }, h(CoveredButton), h(Overlay)),
    h('div', { style: { height: 3000 } }),
    h(FooterButton))
}
createRoot(document.getElementById('root')).render(h(Counter))
`

if (!(await agentBrowserVersion())) {
  process.stderr.write(
    'agent-browser is not installed. Install it with `npm i -g agent-browser && agent-browser install`, then rerun.\n',
  )
  process.exit(1)
}

// agent-browser keeps its daemon sockets under XDG_RUNTIME_DIR, so a short private directory isolates every session this check opens from other agents on the machine; Genie keeps its hub token there too.
const runtimeDir = await mkdtemp(join(process.platform === 'win32' ? tmpdir() : '/tmp', 'gab-'))
const namespace = `genie-e2e-${randomUUID().slice(0, 8)}`
const BASE_ENV = {
  ...Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) =>
        !key.startsWith('GENIE_') &&
        !key.startsWith('AGENT_BROWSER_') &&
        key !== 'CLAUDE_CODE_SESSION_ID' &&
        key !== 'CODEX_THREAD_ID',
    ),
  ),
  XDG_RUNTIME_DIR: runtimeDir,
  AGENT_BROWSER_NAMESPACE: namespace,
}
process.env.XDG_RUNTIME_DIR = runtimeDir

const require = createRequire(join(root, 'apps/router-demo/package.json'))
const { createServer } = await import(require.resolve('vite'))
const { genie: geniePlugin } = await import(
  new URL('../packages/genie-react/dist/vite.js', import.meta.url)
)

const fixtureRoot = await mkdtemp(join(root, 'apps/router-demo/.genie-agent-browser-'))
const openedSessions = new Set()
const results = []
let server

try {
  await mkdir(join(fixtureRoot, '.git'))
  await writeFile(
    join(fixtureRoot, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(join(fixtureRoot, 'main.js'), APP_SOURCE)
  server = await createServer({
    configFile: false,
    root: fixtureRoot,
    cacheDir: join(fixtureRoot, '.vite-cache'),
    optimizeDeps: { include: ['react', 'react-dom/client'] },
    logLevel: 'silent',
    plugins: [geniePlugin()],
    server: { host: '127.0.0.1', port: 0, strictPort: true },
  })
  await server.listen()
  const appUrl = `http://127.0.0.1:${server.httpServer.address().port}/`
  await warmUp(appUrl)

  await step('one agent-browser session and no names: status finds that tab', async () => {
    await browser('alpha', ['open', appUrl])
    const status = await until(
      () => genie(['status'], { agent: 'agent-solo' }),
      (result) => result.json?.ready === true,
    )
    assert.equal(logicalOf(status.json, status.json.sessionId), await tabIdentity('alpha'))
  })

  await step(
    'two agent-browser tabs and no target: the failure names both sessions, not a guess',
    async () => {
      await browser('beta', ['open', appUrl])
      await until(
        () => genie(['status'], { agent: 'agent-solo' }),
        (result) => result.json?.sessions?.filter((session) => session.ready).length === 2,
      )
      const result = await call('react_get_tree', { depth: 2 }, { agent: 'agent-newcomer' })
      assert.equal(result.json?.details?.hubCode, 'SESSION_AMBIGUOUS', render(result))
      assert.deepEqual(result.json.details.agentBrowser, { sessions: ['alpha', 'beta'] })
      assert.match(result.json.message, /agent-browser sessions alpha and beta/)
    },
  )

  await step(
    '--session takes the agent-browser session name, without _genie in the URL',
    async () => {
      const status = await genie(['status', '--session', 'alpha', '--wait', '15000'], {
        agent: 'agent-alpha',
      })
      assert.equal(status.code, 0, render(status))
      assert.deepEqual(status.json.sessionSelector.agentBrowser, {
        session: 'alpha',
        via: 'selector',
        logicalSessionId: await tabIdentity('alpha'),
      })
      assert.equal(logicalOf(status.json, status.json.sessionId), await tabIdentity('alpha'))
    },
  )

  await step('AGENT_BROWSER_SESSION alone targets that session, with no Genie flag', async () => {
    const status = await genie(['status', '--wait', '15000'], {
      agent: 'agent-beta',
      env: { AGENT_BROWSER_SESSION: 'beta' },
    })
    assert.equal(status.code, 0, render(status))
    assert.equal(status.json.sessionSelector.source, 'agent-browser')
    assert.equal(logicalOf(status.json, status.json.sessionId), await tabIdentity('beta'))
  })

  await step('two agents in two sessions at once each read only their own tab', async () => {
    const [alpha, beta] = await Promise.all(
      [
        ['agent-alpha', { session: 'alpha' }],
        ['agent-beta', { env: { AGENT_BROWSER_SESSION: 'beta' } }],
      ].map(([agent, target]) =>
        call('react_clear_renders', { component: 'Counter' }, { agent, ...target }),
      ),
    )
    assert.equal(alpha.code, 0, render(alpha))
    assert.equal(beta.code, 0, render(beta))
    await clickButton('alpha', 'Save')
    await call(
      'react_quiesce',
      { idleMs: 300, timeoutMs: 10_000 },
      { agent: 'agent-alpha', session: 'alpha' },
    )
    const [alphaCauses, betaCauses] = await Promise.all([
      call(
        'react_render_causes',
        { component: 'Counter' },
        { agent: 'agent-alpha', session: 'alpha' },
      ),
      call(
        'react_render_causes',
        { component: 'Counter' },
        {
          agent: 'agent-beta',
          env: { AGENT_BROWSER_SESSION: 'beta' },
        },
      ),
    ])
    assert.equal(alphaCauses.json.events.length, 1, render(alphaCauses))
    assert.equal(alphaCauses.json.events[0].causes[0]?.kind, 'state')
    assert.equal(betaCauses.json.events.length, 0, render(betaCauses))
  })

  await step(
    'a newcomer gets the only unclaimed tab agent-browser shows, never a claimed one',
    async () => {
      await browser('spare', ['open', appUrl])
      await browser('spare', ['tab', 'new', appUrl])
      await until(
        () => genie(['status'], { agent: 'agent-solo' }),
        (result) => result.json?.sessions?.filter((session) => session.ready).length === 4,
      )
      const result = await call('react_get_tree', { depth: 2 }, { agent: 'agent-gamma' })
      assert.equal(result.code, 0, render(result))
      const picked = result.diagnostics.find((line) => line.reason === 'agent-browser')
      assert.equal(picked?.data?.session, 'spare', render(result))
      assert.equal(picked.data.logicalSessionId, await tabIdentity('spare'))
    },
  )

  await step(
    'with only claimed tabs in agent-browser, a newcomer keeps the hub default tab',
    async () => {
      const result = await call('react_get_tree', { depth: 2 }, { agent: 'agent-delta' })
      assert.equal(result.code, 0, render(result))
      assert.ok(!result.diagnostics.some((line) => line.reason === 'agent-browser'), render(result))
      const status = await genie(['status'], { agent: 'agent-delta' })
      const chosen = logicalOf(status.json, status.json.sessionId)
      assert.ok(chosen, render(status))
      for (const session of ['alpha', 'beta', 'spare']) {
        assert.notEqual(chosen, await tabIdentity(session), `agent-delta landed on ${session}`)
      }
    },
  )

  await step(
    'a session showing no Genie page fails with the reason and the command to fix it',
    async () => {
      await browser('spare', ['tab', 'new', 'about:blank'])
      const result = await call(
        'react_get_tree',
        { depth: 2 },
        { agent: 'agent-gamma', session: 'spare' },
      )
      assert.equal(result.json?.reason, 'unknown_session', render(result))
      assert.deepEqual(result.json.details.agentBrowser, { session: 'spare', cause: 'no-genie' })
      assert.match(result.json.message, /agent-browser --session spare open <app-url>/)
      const fallback = await call(
        'react_get_tree',
        { depth: 2 },
        {
          agent: 'agent-delta',
          env: { AGENT_BROWSER_SESSION: 'spare' },
        },
      )
      assert.equal(fallback.code, 0, render(fallback))
      assert.ok(
        fallback.diagnostics.some(
          (line) => line.reason === 'agent-browser' && line.data?.cause === 'no-genie',
        ),
        render(fallback),
      )
      const missing = await call(
        'react_get_tree',
        { depth: 2 },
        { agent: 'agent-alpha', session: 'nobody' },
      )
      assert.deepEqual(missing.json?.details?.agentBrowser, {
        session: 'nobody',
        cause: 'not-running',
      })
    },
  )

  await step(
    'a snapshot ref resolves to its component: plain, covered, below the fold, after a scroll',
    async () => {
      const refs = await snapshotRefs('alpha')
      const owner = async (name) => {
        const result = await call(
          'react_component_for_dom',
          { ref: refs[name] },
          { agent: 'agent-alpha', session: 'alpha' },
        )
        assert.equal(result.code, 0, render(result))
        return result.json.components.map((component) => component.name)
      }
      assert.deepEqual(await owner('Save'), ['SaveButton'])
      assert.deepEqual(await owner('Covered'), ['CoveredButton'])
      assert.deepEqual(await owner('Footer action'), ['FooterButton'])
      await browser('alpha', ['scroll', 'down', '600'])
      assert.deepEqual(await owner('Save'), ['SaveButton'])
      assert.deepEqual(await owner('Footer action'), ['FooterButton'])
      const stale = await call(
        'react_component_for_dom',
        { ref: '@e999' },
        { agent: 'agent-alpha', session: 'alpha' },
      )
      assert.equal(stale.json?.reason, 'invalid_input', render(stale))
      assert.match(stale.json.message, /agent-browser --session alpha snapshot -i/)
    },
  )

  await step('agent-browser --enable react-devtools and Genie share one page', async () => {
    await browser('hooks', ['--enable', 'react-devtools', 'open', appUrl])
    const status = await genie(['status', '--session', 'hooks', '--wait', '15000'], {
      agent: 'agent-hooks',
    })
    assert.equal(status.code, 0, render(status))

    const { tree } = await browser('hooks', ['react', 'tree'])
    for (const name of ['Counter', 'SaveButton', 'CoveredButton', 'FooterButton']) {
      assert.match(tree, new RegExp(` ${name}\\b`), tree)
    }
    const genieTree = await call(
      'react_get_tree',
      { depth: 6 },
      { agent: 'agent-hooks', session: 'hooks' },
    )
    assert.deepEqual(namesIn(genieTree.json.nodes), [
      'Counter',
      'SaveButton',
      'CoveredButton',
      'Overlay',
      'FooterButton',
    ])

    const evidence = async (agent, session) => {
      await call('react_clear_renders', { component: 'Counter' }, { agent, session })
      await clickButton(session, 'Save')
      await call('react_quiesce', { idleMs: 300, timeoutMs: 10_000 }, { agent, session })
      const causes = await call('react_render_causes', { component: 'Counter' }, { agent, session })
      assert.equal(causes.code, 0, render(causes))
      return causes.json.events.map((event) => ({
        component: event.componentName,
        necessity: event.necessity,
        causes: event.causes.map((cause) => [cause.kind, cause.evidence, cause.name]),
      }))
    }
    const withBothHooks = await evidence('agent-hooks', 'hooks')
    assert.equal(withBothHooks.length, 1)
    assert.deepEqual(withBothHooks, await evidence('agent-alpha', 'alpha'))

    await browser('hooks', ['react', 'renders', 'start'])
    await clickButton('hooks', 'Save')
    const { report } = await browser('hooks', ['react', 'renders', 'stop'])
    assert.match(report, /\| Counter\s+\|\s+\d+\s+\|\s+0\s+\|\s+1\s+\|/, report)
    assert.deepEqual(await evidence('agent-hooks', 'hooks'), withBothHooks)
    const { errors } = await browser('hooks', ['errors'])
    assert.deepEqual(errors ?? [], [])
  })

  await step(
    'an explicit _genie name wins over an agent-browser session of the same name',
    async () => {
      await browser('spare', ['open', `${appUrl}?_genie=alpha`])
      const named = await genie(['status', '--session', 'alpha', '--wait', '15000'], {
        agent: 'agent-gamma',
      })
      assert.equal(named.code, 0, render(named))
      assert.equal(named.json.sessionSelector.agentBrowser, undefined)
      assert.equal(logicalOf(named.json, named.json.sessionId), await tabIdentity('spare'))
    },
  )
} finally {
  for (const session of openedSessions) {
    await run('agent-browser', ['--session', session, 'close'], BASE_ENV).catch(() => undefined)
  }
  await server?.close()
  await rm(fixtureRoot, { recursive: true, force: true })
  await rm(runtimeDir, { recursive: true, force: true })
}

const failed = results.filter((result) => !result.ok)
for (const result of results) {
  process.stdout.write(`${result.ok ? '✓' : '✗'} ${result.name} (${result.ms} ms)\n`)
  if (!result.ok) process.stdout.write(`  ${result.error.replaceAll('\n', '\n  ')}\n`)
}
process.stdout.write(
  `${results.length - failed.length}/${results.length} agent-browser checks passed with ${await agentBrowserVersion()}\n`,
)
process.exitCode = failed.length === 0 ? 0 : 1

async function step(name, check) {
  const started = Date.now()
  try {
    await check()
    results.push({ name, ok: true, ms: Date.now() - started })
  } catch (error) {
    results.push({
      name,
      ok: false,
      ms: Date.now() - started,
      error: String(error?.stack ?? error),
    })
  }
}

/** `cwd` defaults to the fixture app, where Genie discovers its hub. */
function run(command, args, env, cwd = fixtureRoot) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      { env, timeout: COMMAND_TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024, cwd },
      (error, stdout, stderr) =>
        resolve({
          code: error ? (typeof error.code === 'number' ? error.code : 1) : 0,
          stdout,
          stderr,
        }),
    )
  })
}

async function agentBrowserVersion() {
  const { code, stdout } = await run('agent-browser', ['--version'], process.env, root)
  return code === 0 ? stdout.trim() : null
}

/** One agent-browser command in this check's namespace; resolves its `data`. */
async function browser(session, args) {
  openedSessions.add(session)
  const { stdout, stderr } = await run(
    'agent-browser',
    ['--session', session, '--json', ...args],
    BASE_ENV,
  )
  const reply = JSON.parse(stdout)
  assert.equal(
    reply.success,
    true,
    `agent-browser ${args.join(' ')} failed: ${reply.error ?? stderr}`,
  )
  return reply.data
}

/** One Genie CLI process, as an agent's shell runs it. */
async function genie(args, { agent, env = {} }) {
  const result = await run(process.execPath, [cliEntry, ...args, '--json'], {
    ...BASE_ENV,
    GENIE_AGENT: agent,
    ...env,
  })
  let json
  try {
    json = JSON.parse(result.stdout)
  } catch {
    json = undefined
  }
  const diagnostics = result.stderr
    .split('\n')
    .filter(Boolean)
    .flatMap((line) => {
      try {
        return [JSON.parse(line)]
      } catch {
        return []
      }
    })
  return { ...result, json, diagnostics, args }
}

function call(tool, args, { session, ...options }) {
  return genie(
    ['call', tool, JSON.stringify(args), ...(session ? ['--session', session] : [])],
    options,
  )
}

async function tabIdentity(session) {
  const { result } = await browser(session, [
    'eval',
    `globalThis[Symbol.for('genie-react:runtime-session-identity')]?.logicalSessionId ?? null`,
  ])
  assert.ok(result, `agent-browser session ${session} shows no Genie tab`)
  return result
}

function logicalOf(status, sessionId) {
  return status.sessions?.find((session) => session.sessionId === sessionId)?.logicalSessionId
}

async function snapshotRefs(session) {
  const { refs } = await browser(session, ['snapshot', '-i'])
  return Object.fromEntries(
    Object.entries(refs)
      .filter(([, ref]) => ref.role === 'button')
      .map(([id, ref]) => [ref.name, `@${id}`]),
  )
}

async function clickButton(session, name) {
  const refs = await snapshotRefs(session)
  assert.ok(refs[name], `no ${name} button in the ${session} snapshot`)
  await browser(session, ['click', refs[name]])
}

/** Vite optimizes dependencies on the first page load and then reloads it; one throwaway load keeps that reload out of the checks. */
async function warmUp(appUrl) {
  await browser('warmup', ['open', appUrl])
  await browser('warmup', ['wait', '1500'])
  await run('agent-browser', ['--session', 'warmup', 'close'], BASE_ENV)
  openedSessions.delete('warmup')
}

/** Repeats a read until it satisfies `done`, for state the page reaches on its own shortly after a command. */
async function until(read, done, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const result = await read()
    if (done(result)) return result
    assert.ok(Date.now() < deadline, render(result))
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

/** Component names in tree order, children after their parent. */
function namesIn(nodes) {
  return (nodes ?? []).flatMap((node) => [node.name, ...namesIn(node.children)])
}

function render(result) {
  return `genie ${result.args?.join(' ')} exited ${result.code}\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
}
