// `benchmark-cli.mjs --wrappers`: installs the packed CLI with each available package manager, in a single app and in an app inside a workspace, then times each invocation from the app folder.
import { execFile } from 'node:child_process'
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { promisify } from 'node:util'
import { cleanEnv, median, percentile, root, round, timed } from './cli-bench-support.mjs'

const execute = promisify(execFile)
const YARN_BERRY = 'yarn@4.18.1'

const MANAGERS = [
  {
    name: 'npm',
    install: ['npm', 'install', '--no-audit', '--no-fund', '--ignore-scripts'],
    exec: ['npx', 'genie-react'],
  },
  { name: 'pnpm', install: ['pnpm', 'install'], exec: ['pnpm', 'exec', 'genie-react'] },
  { name: 'yarn 1', install: ['yarn', 'install'], exec: ['yarn', '--silent', 'genie-react'] },
  {
    name: 'yarn 4 (PnP)',
    install: ['yarn', 'install'],
    exec: ['yarn', 'genie-react'],
    packageManager: YARN_BERRY,
  },
  { name: 'bun', install: ['bun', 'install'], exec: ['bunx', 'genie-react'] },
]

async function run(command, args, cwd, env = cleanEnv()) {
  const { stdout } = await execute(command, args, {
    cwd,
    env,
    maxBuffer: 20_000_000,
    timeout: 300_000,
  })
  return stdout
}

async function pack(destination) {
  const tarballs = {}
  for (const [name, directory] of [
    ['genie-react', 'packages/genie-react'],
    ['@genie-react/cli', 'packages/cli'],
  ]) {
    const packed = JSON.parse(
      await run(
        'pnpm',
        ['pack', '--json', '--pack-destination', destination],
        join(root, directory),
      ),
    )
    tarballs[name] = packed.filename
  }
  return tarballs
}

/** Absolute specs, so a workspace's override and its app's dependency name the tarball identically. */
const fileSpec = (tarball) => `file:${tarball}`

/** Every manager pins genie-react to the packed tarball, so the CLI's exact-version dependency cannot pull a published copy instead. */
function pins(tarballs) {
  const pin = { 'genie-react': fileSpec(tarballs['genie-react']) }
  return { overrides: pin, resolutions: pin, pnpm: { overrides: pin } }
}

async function install(manager, base, tarballs, layout) {
  const project = join(base, `${manager.name.replace(/\W+/g, '-')}-${layout.replace(/\W+/g, '-')}`)
  const app = layout === 'monorepo' ? join(project, 'apps/web') : project
  await mkdir(app, { recursive: true })
  const devDependencies = Object.fromEntries(
    Object.entries(tarballs).map(([name, tarball]) => [name, fileSpec(tarball)]),
  )
  const projectFields = {
    private: true,
    ...(manager.packageManager ? { packageManager: manager.packageManager } : {}),
    ...pins(tarballs),
  }
  if (layout === 'monorepo') {
    await writeFile(
      join(project, 'package.json'),
      JSON.stringify({ name: 'bench-root', workspaces: ['apps/*'], ...projectFields }),
    )
    if (manager.name === 'pnpm') {
      await writeFile(join(project, 'pnpm-workspace.yaml'), "packages:\n  - 'apps/*'\n")
    }
    await writeFile(
      join(app, 'package.json'),
      JSON.stringify({ name: 'web', private: true, version: '0.0.0', devDependencies }),
    )
  } else {
    await writeFile(
      join(app, 'package.json'),
      JSON.stringify({ name: 'bench-app', version: '0.0.0', devDependencies, ...projectFields }),
    )
  }
  const env = cleanEnv({
    YARN_ENABLE_IMMUTABLE_INSTALLS: 'false',
    COREPACK_ENABLE_DOWNLOAD_PROMPT: '0',
  })
  const [command, ...args] = manager.install
  await run(command, args, project, env)
  return { app, env }
}

async function directBin(app) {
  for (let directory = app; ; directory = dirname(directory)) {
    const bin = join(directory, 'node_modules/.bin/genie-react')
    try {
      await access(bin)
      return bin
    } catch {
      if (dirname(directory) === directory) return null
    }
  }
}

async function sample(command, args, cwd, env, runs) {
  for (let warmup = 0; warmup < 2; warmup++) await timed(command, args, { cwd, env })
  const samples = []
  for (let index = 0; index < runs; index++) {
    const result = await timed(command, args, { cwd, env })
    if (result.code !== 0)
      throw new Error(
        `${command} ${args.join(' ')} exited ${result.code}: ${result.stdout}${result.stderr}`,
      )
    samples.push(result.ms)
  }
  return { median: round(median(samples)), p95: round(percentile(samples, 0.95)) }
}

export async function measureWrappers({ runs, fixture }) {
  const base = await mkdtemp(join(tmpdir(), 'genie-cli-wrappers-'))
  const discovery = JSON.parse(await readFile(join(fixture, '.genie/bridge.json'), 'utf8'))
  const { readAgentToken } = await import(join(root, 'packages/genie-react/dist/hub.js'))
  const hub = { GENIE_BRIDGE_URL: discovery.url, GENIE_BRIDGE_TOKEN: await readAgentToken(fixture) }
  const rows = []
  try {
    const tarballs = await pack(base)
    for (const manager of MANAGERS) {
      try {
        await run(manager.install[0], ['--version'], base)
      } catch {
        rows.push({ manager: manager.name, skipped: 'not installed' })
        continue
      }
      for (const layout of ['single app', 'monorepo']) {
        process.stderr.write(`wrappers: ${manager.name} ${layout}\n`)
        let installed
        try {
          installed = await install(manager, base, tarballs, layout)
        } catch (error) {
          rows.push({
            manager: manager.name,
            layout,
            skipped: `install failed: ${String(error.message).split('\n')[0]}`,
          })
          continue
        }
        const env = { ...installed.env, ...hub }
        const bin = await directBin(installed.app)
        const invocations = [[manager.exec.join(' '), manager.exec[0], manager.exec.slice(1)]]
        if (bin) invocations.unshift([relative(installed.app, bin), bin, []])
        for (const [label, command, prefix] of invocations) {
          rows.push({
            manager: manager.name,
            layout,
            invocation: label,
            version: await sample(command, [...prefix, '--version'], installed.app, env, runs),
            status: await sample(command, [...prefix, 'status'], installed.app, env, runs),
          })
        }
      }
    }
  } finally {
    await rm(base, { recursive: true, force: true })
  }
  const lines = [
    '### Invocation from the app folder',
    '',
    '| package manager | layout | invocation | `--version` median | p95 | `status` median | p95 |',
    '|---|---|---|---:|---:|---:|---:|',
    ...rows.map((row) =>
      row.skipped
        ? `| ${row.manager} | ${row.layout ?? ''} | skipped: ${row.skipped} | | | | |`
        : `| ${row.manager} | ${row.layout} | \`${row.invocation}\` | ${row.version.median} | ${row.version.p95} | ${row.status.median} | ${row.status.p95} |`,
    ),
  ]
  return { rows, markdown: lines.join('\n') }
}
