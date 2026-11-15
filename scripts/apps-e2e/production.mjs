import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { extname, join, relative } from 'node:path'
import { PageErrors } from './browser.mjs'
import { check, delay, freePort, runToCompletion, waitForHttp } from './harness.mjs'
import { binary, discoverySnapshot } from './servers.mjs'

const RUNTIME_MARKERS = ['__GENIE_REACT_AGENT__', '/__genie/', '[genie]', 'bippy', 'genie-react']
const SCANNED_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.html', '.css', '.json'])
const BUILD_TIMEOUT_MS = 240_000

async function* files(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) yield* files(path)
    else if (SCANNED_EXTENSIONS.has(extname(entry.name))) yield path
  }
}

/** Lists every emitted asset carrying a string that only Genie's runtime, hub client or hook would put there. */
async function runtimeMarkers(outputDir) {
  const hits = []
  let scanned = 0
  for await (const path of files(outputDir)) {
    const name = relative(outputDir, path)
    scanned++
    const text = await readFile(path, 'utf8')
    for (const marker of RUNTIME_MARKERS) {
      const at = text.indexOf(marker)
      if (at !== -1)
        hits.push({ file: name, marker, excerpt: text.slice(Math.max(0, at - 60), at + 60) })
    }
  }
  check(scanned > 0, `no build output found under ${outputDir}`)
  return { scanned, hits }
}

async function assertNoRuntimeMarkers(outputDir) {
  const { scanned, hits } = await runtimeMarkers(outputDir)
  check(hits.length === 0, 'production output still carries Genie runtime code', hits)
  return scanned
}

async function assertDiscoveryUntouched(appDir, before) {
  const after = await discoverySnapshot(appDir)
  check(after === before, 'a production server published a Genie hub discovery file', {
    before,
    after,
  })
}

/** Loads the production page and fails if anything requests a Genie path, opens a WebSocket, or installs Genie's globals. */
async function assertPageExcludesGenie(browser, url, readySelector) {
  const context = await browser.newContext()
  try {
    const page = await context.newPage()
    const errors = new PageErrors()
    errors.attach(page)
    const traffic = []
    page.on('request', (request) => traffic.push(request.url()))
    page.on('websocket', (socket) => traffic.push(socket.url()))
    const target = new URL(url)
    target.searchParams.set('_genie', 'apps-e2e-production')
    await page.goto(target.href, { waitUntil: 'load' })
    await page.locator(readySelector).first().waitFor({ timeout: 15_000 })
    await delay(1_500)
    const reachedForHub = traffic.filter(
      (entry) => entry.includes('__genie') || entry.startsWith('ws') || /:4390\b/.test(entry),
    )
    check(reachedForHub.length === 0, 'production page tried to reach a Genie hub', reachedForHub)
    const globals = await page.evaluate(() => ({
      agent: '__GENIE_REACT_AGENT__' in window,
      devtoolsHook: '__REACT_DEVTOOLS_GLOBAL_HOOK__' in window,
      genieScript: [...document.scripts].some((script) => script.src.includes('__genie')),
    }))
    check(
      !globals.agent && !globals.devtoolsHook && !globals.genieScript,
      'production page installed Genie globals or its hook',
      globals,
    )
    errors.assertClean('production page')
    return traffic.length
  } finally {
    await context.close()
  }
}

export async function assertViteProductionExcludesGenie(
  { processes, appDir, browser, log },
  { readySelector },
) {
  const outputDir = await mkdtemp(join(tmpdir(), 'genie-apps-e2e-build-'))
  const vite = binary(appDir, 'vite', 'bin/vite.js')
  try {
    await runToCompletion(
      'vite build',
      process.execPath,
      [vite, 'build', '--outDir', outputDir, '--emptyOutDir'],
      {
        cwd: appDir,
        env: { NODE_ENV: 'production' },
        timeoutMs: BUILD_TIMEOUT_MS,
      },
    )
    const scanned = await assertNoRuntimeMarkers(outputDir)
    const discovery = await discoverySnapshot(appDir)
    const port = await freePort()
    const preview = processes.start(
      'vite preview',
      process.execPath,
      [
        vite,
        'preview',
        '--outDir',
        outputDir,
        '--host',
        '127.0.0.1',
        '--port',
        String(port),
        '--strictPort',
      ],
      { cwd: appDir },
    )
    const url = `http://127.0.0.1:${port}/`
    await waitForHttp(preview, url)
    const requests = await assertPageExcludesGenie(browser, url, readySelector)
    await assertDiscoveryUntouched(appDir, discovery)
    log(
      `  ✓ production: ${scanned} assets carry no runtime marker; ${requests} requests, none to a hub`,
    )
  } finally {
    await rm(outputDir, { recursive: true, force: true })
  }
}

const NEXT_BUILD_COPY = ['app', 'instrumentation.ts', 'package.json', 'tsconfig.json']

/** A copy of the Next app beside the original whose config extends the app's own and skips type-checking, which never changes emitted JavaScript; Next reads that flag only from its config file. */
async function nextBuildCopy(appDir) {
  const copyDir = join(appDir, `.genie-apps-e2e-build-${process.pid}`)
  await rm(copyDir, { recursive: true, force: true })
  await mkdir(copyDir)
  for (const entry of NEXT_BUILD_COPY)
    await cp(join(appDir, entry), join(copyDir, entry), { recursive: true })
  await symlink(join(appDir, 'node_modules'), join(copyDir, 'node_modules'), 'dir')
  await writeFile(
    join(copyDir, 'next.config.ts'),
    `import type { NextConfig } from 'next'
import base from '../next.config'

const config: NextConfig = { ...base, typescript: { ...base.typescript, ignoreBuildErrors: true } }

export default config
`,
  )
  return { copyDir, remove: () => rm(copyDir, { recursive: true, force: true }) }
}

export async function assertNextProductionExcludesGenie(
  { processes, appDir, browser, log, knownDefect },
  { readySelector },
) {
  await knownDefect('KD-10', () =>
    runToCompletion(
      'tsc --noEmit',
      process.execPath,
      [binary(appDir, 'typescript', 'bin/tsc'), '--noEmit', '-p', '.'],
      {
        cwd: appDir,
        timeoutMs: BUILD_TIMEOUT_MS,
      },
    ),
  )
  const { copyDir, remove } = await nextBuildCopy(appDir)
  try {
    const next = binary(appDir, 'next', 'dist/bin/next')
    const env = { NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' }
    await runToCompletion('next build', process.execPath, [next, 'build'], {
      cwd: copyDir,
      env,
      timeoutMs: BUILD_TIMEOUT_MS,
    })
    const { scanned, hits } = await runtimeMarkers(join(copyDir, '.next/static'))
    const discovery = await discoverySnapshot(appDir)
    const port = await freePort()
    const server = processes.start(
      'next start',
      process.execPath,
      [next, 'start', '--hostname', '127.0.0.1', '--port', String(port)],
      { cwd: copyDir, env },
    )
    const url = `http://127.0.0.1:${port}/`
    await waitForHttp(server, url)
    const requests = await assertPageExcludesGenie(browser, url, readySelector)
    await knownDefect('KD-11', async () => {
      const files = [...new Set(hits.map((hit) => hit.file))]
      const served = await Promise.all(
        files.map(
          async (file) =>
            `${file} → HTTP ${(await fetch(new URL(`_next/static/${file}`, url))).status}`,
        ),
      )
      check(
        hits.length === 0,
        `the Next production output ships Genie runtime code: ${served.join('; ')}`,
      )
    })
    check(
      !server.output.includes('[genie]'),
      'next start logged Genie hub activity',
      server.output.slice(-2_000),
    )
    await assertDiscoveryUntouched(appDir, discovery)
    check(
      (await discoverySnapshot(copyDir)) === null,
      'next start published a Genie hub discovery file',
    )
    await processes.stop(server)
    log(`  ✓ production: ${scanned} client assets scanned; ${requests} requests, none to a hub`)
  } finally {
    await remove()
  }
}
