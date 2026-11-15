#!/usr/bin/env node
// CI guard for CLI latency. Shared runners are too noisy for millisecond budgets, so this fails on what is stable: files and bytes loaded per command, hub round trips per command, the lag between the last stdout byte and exit, and wall time only against loose ceilings relative to `node -e 0` on the same runner. `node scripts/benchmark-cli.mjs` measures the full picture.
import { mkdtemp, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { cleanEnv, defaultCli, median, probed, root, timed } from './cli-bench-support.mjs'

const RUNS = 9
const KiB = 1024
const BATCH = JSON.stringify([{ tool: 'app_echo' }, { tool: 'app_echo', args: { n: 2 } }])

// Budgets sit just above the current build: a new eagerly loaded dependency or an unbundled package trips the file or byte limit, a new handshake trips the round-trip count.
const COMMANDS = [
  { name: '--version', argv: ['--version'], files: 4, bytes: 80 * KiB, roundTrips: 0, floors: 3 },
  { name: '--help', argv: ['--help'], files: 4, bytes: 80 * KiB, roundTrips: 0, floors: 3 },
  { name: 'status', argv: ['status'], files: 6, bytes: 540 * KiB, roundTrips: 1, floors: 7 },
  { name: 'tools', argv: ['tools'], files: 6, bytes: 540 * KiB, roundTrips: 0, floors: 7 },
  {
    name: 'call',
    argv: ['call', 'app_echo', '{}'],
    files: 6,
    bytes: 540 * KiB,
    roundTrips: 1,
    floors: 7,
  },
  { name: 'batch', argv: ['batch', BATCH], files: 6, bytes: 540 * KiB, roundTrips: 2, floors: 7 },
]
const EXIT_LAG_MS = 50
const CEILING_MARGIN_MS = 100

const { createStandaloneBridge } = await import(join(root, 'packages/genie-react/dist/hub.js'))
const { decodeFrame, encodeMessage } = await import(
  join(root, 'packages/genie-react/dist/protocol.js')
)
const { WebSocket } = createRequire(join(root, 'packages/genie-react/package.json'))('ws')

async function startHub() {
  const handle = createStandaloneBridge()
  const { url } = await handle.listen()
  const app = new WebSocket(`${url}?role=app`)
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
        result: { echoed: request.args },
      }),
    )
  })
  app.send(
    encodeMessage({
      kind: 'app/hello',
      protocol: 1,
      sessionId: 'startup-guard',
      app: { name: 'Startup guard' },
      capabilities: ['app'],
      tools: [
        { name: 'app_echo', title: 'Echo', description: 'Echoes its arguments', group: 'app' },
      ],
    }),
  )
  app.send(encodeMessage({ kind: 'app/ready', sessionId: 'startup-guard' }))
  const deadline = Date.now() + 10_000
  while (!handle.bridge.getStatus().ready) {
    if (Date.now() > deadline) throw new Error('The scripted app session never became ready')
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  const close = () => {
    app.close()
    return handle.close()
  }
  return { url, token: handle.bridge.agentToken, close }
}

const relativeUrl = (url) => url.replace(`file://${root}`, '')

async function check(command, cwd, env) {
  const failures = []
  const loaded = await probed(process.execPath, defaultCli, command.argv, {
    cwd,
    env,
    modules: true,
  })
  if (loaded.code !== 0)
    throw new Error(`${command.name} exited ${loaded.code}: ${loaded.stdout}${loaded.stderr}`)
  const { modules, phases, compileCacheDir } = loaded.report
  const bytes = modules.reduce((sum, module) => sum + module.bytes, 0)
  const foreign = modules.filter(({ url }) => !url.includes('/packages/cli/dist/'))
  const roundTrips = phases.filter(([phase]) => phase === 'call:sent').length
  if (modules.length > command.files) {
    failures.push(
      `loads ${modules.length} files, budget ${command.files}: ${modules.map(({ url }) => relativeUrl(url)).join(', ')}`,
    )
  }
  if (bytes > command.bytes)
    failures.push(`loads ${Math.round(bytes / KiB)} KiB, budget ${command.bytes / KiB} KiB`)
  if (foreign.length > 0) {
    failures.push(
      `loads files outside the CLI bundle: ${foreign.map(({ url }) => relativeUrl(url)).join(', ')}`,
    )
  }
  if (roundTrips !== command.roundTrips)
    failures.push(`makes ${roundTrips} hub round trips, expected ${command.roundTrips}`)
  if (!/[\\/]compile-cache[\\/]/.test(compileCacheDir ?? '')) {
    failures.push('runs without the compile cache')
  }

  const walls = []
  const exitLags = []
  for (let run = 0; run < RUNS; run++) {
    const sample = await probed(process.execPath, defaultCli, command.argv, { cwd, env })
    walls.push(sample.ms)
    exitLags.push(sample.report.exitAt - (sample.report.stdout.lastWriteAt ?? sample.report.exitAt))
  }
  const exitLag = median(exitLags)
  if (exitLag > EXIT_LAG_MS) {
    failures.push(
      `takes ${exitLag.toFixed(1)} ms from its last stdout byte to exit, budget ${EXIT_LAG_MS} ms: something keeps the event loop alive`,
    )
  }
  return { failures, files: modules.length, bytes, roundTrips, wall: median(walls), exitLag }
}

/** The cache lives in the private per-user Genie directory, Node's own switches still win, and an unusable directory never fails a command. */
async function checkCompileCache(cwd) {
  const failures = []
  const runtime = await mkdtemp(join(tmpdir(), 'genie-cli-cache-'))
  const userDirectory = join(runtime, `genie-react-${process.getuid?.() ?? 'user'}`)
  const version = async (extra) => {
    const run = await timed(process.execPath, [defaultCli, '--version'], {
      cwd,
      env: cleanEnv({ XDG_RUNTIME_DIR: runtime, ...extra }),
    })
    if (run.code !== 0 || run.stderr !== '' || !/^\d+\.\d+\.\d+/.test(run.stdout)) {
      failures.push(
        `--version broke (${JSON.stringify(extra)}): exit ${run.code}, ${run.stdout}${run.stderr}`,
      )
    }
  }
  try {
    await version({ NODE_DISABLE_COMPILE_CACHE: '1' })
    if (await stat(userDirectory).catch(() => null)) {
      failures.push('NODE_DISABLE_COMPILE_CACHE=1 still created a cache directory')
    }
    await version({})
    const [versioned] = await readdir(join(userDirectory, 'compile-cache')).catch(() => [])
    const entries = versioned ? await readdir(join(userDirectory, 'compile-cache', versioned)) : []
    if (entries.length === 0) failures.push('a run left no compile cache entries')
    if (process.getuid && ((await stat(userDirectory)).mode & 0o777) !== 0o700) {
      failures.push('the cache directory is not private (0700)')
    }
    await rm(userDirectory, { recursive: true, force: true })
    await writeFile(userDirectory, 'not a directory')
    await version({})
  } finally {
    await rm(runtime, { recursive: true, force: true })
  }
  return failures
}

const cwd = await mkdtemp(join(tmpdir(), 'genie-cli-startup-'))
const hub = await startHub()
let failed = false
try {
  const env = cleanEnv({ GENIE_BRIDGE_URL: hub.url, GENIE_BRIDGE_TOKEN: hub.token })
  const floorSamples = []
  for (let run = 0; run < RUNS; run++)
    floorSamples.push((await timed(process.execPath, ['-e', '0'])).ms)
  const floor = median(floorSamples)
  console.log(`node -e 0: ${floor.toFixed(1)} ms median over ${RUNS} runs`)
  console.log('| command | files | KiB | round trips | wall median ms | ceiling ms | exit lag ms |')
  console.log('|---|---:|---:|---:|---:|---:|---:|')
  for (const command of COMMANDS) {
    const result = await check(command, cwd, env)
    const ceiling = floor * command.floors + CEILING_MARGIN_MS
    if (result.wall > ceiling) {
      result.failures.push(
        `median wall time ${result.wall.toFixed(1)} ms exceeds ${ceiling.toFixed(1)} ms (${command.floors}x node -e 0 + ${CEILING_MARGIN_MS} ms)`,
      )
    }
    console.log(
      `| ${command.name} | ${result.files} | ${Math.round(result.bytes / KiB)} | ${result.roundTrips} | ${result.wall.toFixed(1)} | ${ceiling.toFixed(1)} | ${result.exitLag.toFixed(1)} |`,
    )
    for (const failure of result.failures) {
      failed = true
      console.error(`✗ ${command.name} ${failure}`)
    }
  }
  for (const failure of await checkCompileCache(cwd)) {
    failed = true
    console.error(`✗ compile cache: ${failure}`)
  }
} finally {
  await hub.close()
  await rm(cwd, { recursive: true, force: true })
}
if (failed) {
  console.error(
    'CLI startup guard failed. Measure with `node scripts/benchmark-cli.mjs`, then fix the regression or adjust the budget in scripts/check-cli-startup.mjs with the reason.',
  )
  process.exitCode = 1
}
