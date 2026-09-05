#!/usr/bin/env node
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const runtimeRequire = createRequire(join(root, 'packages/genie-react/package.json'))
const demoRequire = createRequire(join(root, 'apps/vite-demo/package.json'))
const { createServer } = await import(runtimeRequire.resolve('vite'))
const fixture = await mkdtemp(join(root, '.runtime-benchmark-'))
let server
let browser
try {
  await writeFile(
    join(fixture, 'index.html'),
    '<div id="root"></div><script type="module" src="/main.js"></script>',
  )
  await writeFile(
    join(fixture, 'main.js'),
    `
const mode = new URLSearchParams(location.search).get('mode');
let tracker;
if (mode !== 'disabled') {
  await import('/@fs/${root}/packages/genie-react/src/collectors/react/hook.ts');
  tracker = await import('/@fs/${root}/packages/genie-react/src/collectors/react/render-tracker.ts');
}
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { flushSync } = await import('react-dom');
const count = 500;
function Row({ value, index }) { return React.createElement('span', null, index + ':' + value); }
function App({ value }) { return React.createElement('div', null, Array.from({ length: count }, (_, index) => React.createElement(Row, { key: index, index, value }))); }
const root = createRoot(document.getElementById('root'));
let value = 0;
const update = () => flushSync(() => root.render(React.createElement(App, { value: ++value })));
update();
if (mode === 'paused') tracker.stopRenderTracking();
window.runBenchmark = () => {
  tracker?.clearRenders();
  for (let i = 0; i < 20; i++) update();
  const samples = [];
  for (let i = 0; i < 60; i++) { const start = performance.now(); update(); samples.push(performance.now() - start); }
  return { samples, text: document.querySelector('span').textContent, expectedText: '0:' + value, rows: document.querySelectorAll('span').length, count, budget: tracker?.getRenderObservationConfig(), skippedFibers: tracker?.getSkippedCommitFiberCount(), commits: tracker?.getCommitCount() };
};
`,
  )
  server = await createServer({
    configFile: false,
    root: fixture,
    logLevel: 'error',
    resolve: {
      alias: [
        { find: /^react$/, replacement: runtimeRequire.resolve('react') },
        { find: /^react-dom\/client$/, replacement: demoRequire.resolve('react-dom/client') },
        { find: /^react-dom$/, replacement: demoRequire.resolve('react-dom') },
      ],
    },
    server: { host: '127.0.0.1', port: 0, fs: { allow: [root] } },
  })
  await server.listen()
  const address = server.httpServer.address()
  if (!address || typeof address === 'string') throw new Error('Missing Vite port')
  browser = await chromium.launch({ headless: true })
  const results = []
  // Alternate order to reduce one-directional warmup/thermal bias. Each run has a fresh document.
  for (const modes of [
    ['disabled', 'active', 'paused'],
    ['paused', 'active', 'disabled'],
    ['active', 'disabled', 'paused'],
  ]) {
    for (const mode of modes) {
      const page = await browser.newPage()
      const pageErrors = []
      page.on('pageerror', (error) => pageErrors.push(error))
      await page.goto(`http://127.0.0.1:${address.port}/?mode=${mode}`)
      await page.waitForFunction(() => typeof window.runBenchmark === 'function')
      const result = await page.evaluate(() => window.runBenchmark())
      if (pageErrors.length > 0) throw pageErrors[0]
      if (result.text !== result.expectedText || result.rows !== result.count)
        throw new Error('Fixture rendered incorrectly')
      results.push({ mode, ...result })
      await page.close()
    }
  }
  const percentile = (values, fraction) =>
    [...values].sort((a, b) => a - b)[Math.ceil(values.length * fraction) - 1]
  const summary = ['disabled', 'active', 'paused'].map((mode) => {
    const runs = results.filter((result) => result.mode === mode)
    const samples = runs.flatMap((run) => run.samples)
    return {
      mode,
      medianMs: percentile(samples, 0.5),
      p95Ms: percentile(samples, 0.95),
      runs: runs.map(({ samples, ...run }) => ({ ...run, medianMs: percentile(samples, 0.5) })),
    }
  })
  console.log(
    JSON.stringify(
      {
        fixture:
          'React development build, 500 keyed sibling rows; 20 warmup + 60 synchronous updates × 3 fresh documents per mode',
        browser: browser.version(),
        react: runtimeRequire('react/package.json').version,
        platform: process.platform,
        architecture: process.arch,
        summary,
        results,
      },
      null,
      2,
    ),
  )
} finally {
  await browser?.close()
  await server?.close()
  await rm(fixture, { recursive: true, force: true })
}
