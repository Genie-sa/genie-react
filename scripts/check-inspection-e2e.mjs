#!/usr/bin/env node
// Inspection accuracy in a real browser: a packed Vite + StyleX consumer whose source lines, hooks, contexts and styles are known by construction, read through the built CLI on React 19 (owner stacks) and React 18 (_debugSource).
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const PACKAGES = [join(ROOT, 'packages/genie-react'), join(ROOT, 'packages/cli')]
const SHARED_DEPENDENCIES = [
  'vite@8.1.0',
  '@vitejs/plugin-react@6.0.3',
  '@stylexjs/stylex@0.19.0',
  '@stylexjs/unplugin@0.19.1',
]
const PROFILES = [
  { name: 'react-19', react: '19.2.7', sourceMapConfidence: 'mapped' },
  { name: 'react-18', react: '18.3.1', sourceMapConfidence: 'served' },
]
const SESSION = 'inspection-e2e'

const STYLES = `import * as stylex from '@stylexjs/stylex'

export const styles = stylex.create({
  card: {
    borderColor: 'rgb(1, 2, 3)',
    color: { default: 'rgb(10, 11, 12)', ':hover': 'rgb(4, 5, 6)' },
    padding: 20,
  },
  featured: {
    borderColor: 'rgb(7, 8, 9)',
  },
  progress: (width) => ({ width }),
})
`

const APP = `import { createContext, useState, useTransition } from 'react'
import { Card } from './Card.jsx'

export const Currency = createContext('USD')
Currency.displayName = 'Currency'

export function Checkout() {
  const [step, setStep] = useState(1)
  const [pending] = useTransition()
  return (
    <Currency.Provider value="EUR">
      <button id="next" onClick={() => setStep((value) => value + 1)}>next</button>
      <Summary step={step} pending={pending} />
      <Card />
    </Currency.Provider>
  )
}

function Summary({ step }) {
  return <p id="summary">step {step}</p>
}
`

// The StyleX plugin reprints this file before the JSX transform without passing a source map on, so positions in it are only trustworthy once checked against the file on disk.
const CARD = `import { useContext } from 'react'
import * as stylex from '@stylexjs/stylex'
import { Currency } from './App.jsx'
import { styles } from './styles.js'

export function Card() {
  const currency = useContext(Currency)

  return (
    <div id="card" {...stylex.props(styles.card, styles.featured, styles.progress('40%'))}>

      <Label currency={currency} />
    </div>
  )
}

function Label() {
  return 'total in EUR'
}
`

const MAIN = `import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Checkout } from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Checkout />
  </StrictMode>,
)
`

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import stylex from '@stylexjs/unplugin'
import { genie } from 'genie-react/vite'

export default defineConfig({
  plugins: [genie(), stylex.vite({ dev: true, debug: true, useCSSLayers: true }), react()],
})
`

const children = new Set()
let browser

function lineOf(source, snippet) {
  const lines = source.split('\n')
  const index = lines.findIndex((line) => line.includes(snippet))
  if (index === -1) throw new Error(`fixture has no line containing ${snippet}`)
  return { line: index + 1, column: lines[index].indexOf(snippet) + 1 }
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run(command, args, options = {}) {
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options })
  children.add(child)
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk) => {
    stderr += chunk
  })
  const timer = setTimeout(() => child.kill('SIGKILL'), options.timeoutMs ?? 30_000)
  return once(child, 'close').then(([code]) => {
    clearTimeout(timer)
    children.delete(child)
    return { code, stdout, stderr }
  })
}

async function freePort() {
  const server = createServer()
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const { port } = server.address()
  await new Promise((done) => server.close(done))
  return port
}

async function waitFor(label, probe, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const value = await probe()
      if (value) return value
    } catch (error) {
      lastError = error
    }
    await new Promise((done) => setTimeout(done, 200))
  }
  throw new Error(`Timed out waiting for ${label}${lastError ? `: ${lastError.message}` : ''}`)
}

async function prepareConsumer(directory) {
  await mkdir(join(directory, 'src'), { recursive: true })
  await writeFile(
    join(directory, 'package.json'),
    '{ "name": "inspection-e2e", "private": true, "type": "module" }\n',
  )
  await writeFile(
    join(directory, 'index.html'),
    '<!doctype html><html><body><div id="root"></div><script type="module" src="/src/main.jsx"></script></body></html>\n',
  )
  await writeFile(join(directory, 'vite.config.mjs'), VITE_CONFIG)
  await writeFile(join(directory, 'src/styles.js'), STYLES)
  await writeFile(join(directory, 'src/App.jsx'), APP)
  await writeFile(join(directory, 'src/Card.jsx'), CARD)
  await writeFile(join(directory, 'src/main.jsx'), MAIN)
  const tarballs = []
  for (const packageRoot of PACKAGES) {
    const packed = await run('pnpm', ['pack', '--json', '--pack-destination', directory], {
      cwd: packageRoot,
    })
    assert(packed.code === 0, `pnpm pack failed in ${packageRoot}:\n${packed.stderr}`)
    tarballs.push(resolve(JSON.parse(packed.stdout).filename))
  }
  return tarballs
}

async function install(directory, packages) {
  const installed = await run(
    'npm',
    ['install', '--ignore-scripts', '--no-audit', '--no-fund', '--package-lock=false', ...packages],
    { cwd: directory, timeoutMs: 180_000 },
  )
  assert(installed.code === 0, `npm install failed:\n${installed.stdout}\n${installed.stderr}`)
}

function cliFor(directory) {
  const entry = join(directory, 'node_modules/@genie-react/cli/dist/cli.js')
  const env = { ...process.env }
  for (const key of ['GENIE_BRIDGE_URL', 'GENIE_BRIDGE_PORT', 'GENIE_SESSION']) delete env[key]
  return async (tool, input, { expectFailure = false } = {}) => {
    const result = await run(
      process.execPath,
      [entry, 'call', tool, JSON.stringify(input), '--json', '--session', SESSION],
      { cwd: directory, env },
    )
    const parsed = JSON.parse(result.stdout)
    if (expectFailure) {
      assert(result.code !== 0, `${tool} unexpectedly succeeded: ${result.stdout}`)
      return parsed
    }
    assert(result.code === 0, `${tool} failed: ${result.stdout}\n${result.stderr}`)
    return parsed
  }
}

async function checkProfile(directory, profile) {
  const port = await freePort()
  const vite = spawn(
    process.execPath,
    [
      join(directory, 'node_modules/vite/bin/vite.js'),
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ],
    { cwd: directory, stdio: ['ignore', 'pipe', 'pipe'], detached: process.platform !== 'win32' },
  )
  children.add(vite)
  let viteLog = ''
  vite.stdout.on('data', (chunk) => {
    viteLog += chunk
  })
  vite.stderr.on('data', (chunk) => {
    viteLog += chunk
  })
  try {
    await waitFor(
      'the Vite dev server',
      async () => (await fetch(`http://127.0.0.1:${port}/`)).ok,
      30_000,
    )
    const page = await browser.newPage()
    const pageErrors = []
    page.on('pageerror', (error) => pageErrors.push(error.message))
    await page.goto(`http://127.0.0.1:${port}/?_genie=${SESSION}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.locator('#card').waitFor({ timeout: 60_000 })
    const call = cliFor(directory)
    const find = async (component) => {
      const result = await call('react_find_components', { component, exact: true })
      assert(
        result.matches.length === 1,
        `${component}: expected one match, got ${result.matches.length}`,
      )
      return result.matches[0]
    }
    await waitFor('a ready session', async () => (await find('Checkout')).id, 20_000)

    const sourceOf = (component) =>
      waitFor(
        `${component} source`,
        async () => (await find(component)).source ?? undefined,
        10_000,
      )
    for (const [component, snippet] of [
      ['Summary', '<Summary step={step} pending={pending} />'],
      ['Card', '<Card />'],
    ]) {
      const source = await sourceOf(component)
      const truth = lineOf(APP, snippet)
      assert(
        source.file.endsWith('/src/App.jsx') &&
          source.line === truth.line &&
          source.column === truth.column &&
          source.role === 'element-callsite' &&
          source.sourceMapConfidence === profile.sourceMapConfidence,
        `${profile.name} ${component}: expected src/App.jsx:${truth.line}:${truth.column} element-callsite, got ${JSON.stringify(source)}`,
      )
    }
    const label = await sourceOf('Label')
    const labelTruth = lineOf(CARD, '<Label currency={currency} />')
    assert(
      label.file.endsWith('/src/Card.jsx') &&
        (label.line === null || label.line === labelTruth.line),
      `${profile.name} Label in the StyleX-transformed file: expected line ${labelTruth.line} or null, got ${JSON.stringify(label)}`,
    )

    const checkoutId = (await find('Checkout')).id
    const inspected = await call('react_inspect_component', { id: checkoutId })
    const hookNames = inspected.hooks.map((hook) => hook.hook)
    assert(
      JSON.stringify(hookNames) === JSON.stringify(['useState', 'useTransition', 'useTransition']),
      `${profile.name} Checkout hooks: ${JSON.stringify(inspected.hooks)}`,
    )

    const { contexts } = await call('react_inspect_context', { id: (await find('Card')).id })
    assert(
      contexts.length === 1 &&
        contexts[0].value === 'EUR' &&
        contexts[0].provider?.name === 'Currency.Provider',
      `${profile.name} Card context: ${JSON.stringify(contexts)}`,
    )

    const dom = await call('react_dom_for_component', { id: (await find('Label')).id })
    assert(
      dom.total === 1 && dom.elements[0].tag === '#text' && dom.elements[0].selector === '#card',
      `${profile.name} Label DOM: ${JSON.stringify(dom)}`,
    )

    const styled = await call('stylex_inspect', { selector: '#card' })
    const [card] = styled.elements
    const styleLines = card.styleObjects.map((object) => object.line)
    const expectedLines = [lineOf(STYLES, 'card: {').line, lineOf(STYLES, 'featured: {').line]
    assert(
      styled.status.styleSrc &&
        expectedLines.every((line) => styleLines.includes(line)) &&
        card.styleObjects.every((object) => object.file?.endsWith('src/styles.js')),
      `${profile.name} StyleX objects: ${JSON.stringify(card.styleObjects)}`,
    )
    const declared = (property) =>
      card.declarations
        .filter((entry) => entry.property === property)
        .map((entry) => [entry.condition, entry.value])
    assert(
      JSON.stringify(declared('border-color')) === JSON.stringify([[null, 'rgb(7, 8, 9)']]),
      `${profile.name} StyleX merge: the later style object must win border-color, got ${JSON.stringify(declared('border-color'))}`,
    )
    assert(
      JSON.stringify(declared('color').sort()) ===
        JSON.stringify(
          [
            [':hover', 'rgb(4, 5, 6)'],
            [null, 'rgb(10, 11, 12)'],
          ].sort(),
        ),
      `${profile.name} StyleX conditional color: ${JSON.stringify(declared('color'))}`,
    )
    assert(
      card.dynamic.some((entry) => entry.value === '40%'),
      `${profile.name} StyleX dynamic values: ${JSON.stringify(card.dynamic)}`,
    )

    await call('react_override_hook_state', { id: checkoutId, stateIndex: 0, value: 40 })
    await page.locator('#summary', { hasText: 'step 40' }).waitFor()
    await page.click('#next')
    await page.locator('#summary', { hasText: 'step 41' }).waitFor()
    const reset = await call('react_reset_overrides', {})
    assert(
      reset.cleared.length === 1 && reset.cleared[0].outcome === 'superseded',
      `${profile.name} reset after app setState: ${JSON.stringify(reset)}`,
    )
    assert(
      (await page.locator('#summary').textContent()) === 'step 41',
      `${profile.name} reset rewrote app state`,
    )

    const summaryId = (await find('Summary')).id
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.locator('#card').waitFor({ timeout: 60_000 })
    await waitFor(
      'the reloaded session',
      async () => (await find('Summary')).id !== summaryId,
      20_000,
    )
    const stale = await call('react_inspect_component', { id: summaryId }, { expectFailure: true })
    assert(
      JSON.stringify(stale).includes('not found'),
      `${profile.name} stale id after reload resolved: ${JSON.stringify(stale)}`,
    )

    assert(pageErrors.length === 0, `${profile.name} page errors:\n${pageErrors.join('\n')}`)
    await page.close()
    process.stdout.write(
      `Inspection E2E passed on ${profile.name} (port ${port}): exact JSX lines, StyleX-shifted line ${label.line === null ? 'withheld' : 'verified'}, hook names, provider, text node, StyleX merge, superseded reset, stale id after reload.\n`,
    )
  } catch (error) {
    throw new Error(`${error.message}\nVite output:\n${viteLog.slice(-4000)}`)
  } finally {
    try {
      process.kill(-vite.pid, 'SIGTERM')
    } catch {
      vite.kill('SIGTERM')
    }
    await Promise.race([once(vite, 'close'), new Promise((done) => setTimeout(done, 3_000))])
    children.delete(vite)
  }
}

const directory = await mkdtemp(join(tmpdir(), 'genie-inspection-e2e-'))
try {
  const tarballs = await prepareConsumer(directory)
  browser = await chromium.launch({ headless: true })
  for (const profile of PROFILES) {
    await install(directory, [
      ...tarballs,
      ...SHARED_DEPENDENCIES,
      `react@${profile.react}`,
      `react-dom@${profile.react}`,
    ])
    await rm(join(directory, 'node_modules/.vite'), { recursive: true, force: true })
    await checkProfile(directory, profile)
  }
} finally {
  await browser?.close().catch(() => {})
  for (const child of children) child.kill('SIGKILL')
  await rm(directory, { recursive: true, force: true })
}
