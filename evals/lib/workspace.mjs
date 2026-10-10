import { existsSync } from 'node:fs'
import { cp, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { release, track } from './cleanup.mjs'
import { freePort, run, start, waitForHttp } from './process.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const FIXTURE_ROOT = join(REPO_ROOT, 'evals/fixture-app')
const FIXTURE_MODULES = join(FIXTURE_ROOT, 'node_modules')
const PACKED_PACKAGES = [join(REPO_ROOT, 'packages/genie-react'), join(REPO_ROOT, 'packages/cli')]
const COPY_EXCLUDES = new Set(['node_modules', '.genie', '.vite', 'dist'])
const GIT_OPTIONS = [
  '-c',
  'user.name=genie-eval',
  '-c',
  'user.email=genie-eval@localhost',
  '-c',
  'core.fsmonitor=false',
  '-c',
  'core.hooksPath=/dev/null',
]
const DIFF_OPTIONS = ['--no-ext-diff', '--no-textconv']

/**
 * @typedef {import('./tasks.mjs').Edit} Edit
 * @typedef {{ root: string, modules: string, cliEntry: string, versions: Record<string, string> }} Consumer
 */

export function assertFixtureInstalled() {
  if (!existsSync(join(FIXTURE_MODULES, 'vite')) || !existsSync(join(FIXTURE_MODULES, '.bin'))) {
    throw new Error(
      'evals/fixture-app dependencies are missing. Run `pnpm install` at the repo root.',
    )
  }
}

/**
 * Runs git with hooks and fsmonitor off, since the agent may have touched the trial's repository.
 * @param {string} cwd
 * @param {string[]} args
 */
async function git(cwd, args) {
  const result = await run('git', [...GIT_OPTIONS, ...args], { cwd, timeoutMs: 30_000 })
  if (result.code !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`)
  return result.stdout
}

/**
 * Every repository checkout that can hold the answer key: this worktree and, for a linked worktree, the main checkout.
 * @returns {Promise<string[]>}
 */
export async function repositoryRoots() {
  const result = await run('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
    cwd: REPO_ROOT,
    timeoutMs: 30_000,
  })
  const commonDir = result.code === 0 ? result.stdout.trim() : ''
  return [...new Set([REPO_ROOT, ...(commonDir ? [dirname(commonDir)] : [])])]
}

/**
 * @param {string} prefix
 */
export async function temporaryDirectory(prefix) {
  const dir = await realpath(await mkdtemp(join(tmpdir(), prefix)))
  track(dir, () => rm(dir, { recursive: true, force: true }))
  return dir
}

/**
 * @param {string} dir
 * @param {string} mode
 */
async function chmodTree(dir, mode) {
  const result = await run('chmod', ['-R', mode, dir], { timeoutMs: 60_000, cleanup: true })
  if (result.code !== 0) throw new Error(`chmod -R ${mode} ${dir} failed: ${result.stderr.trim()}`)
}

/**
 * Removes write access from a tracked directory; the cleanup that restores it is registered first,
 * so an interrupt or a partial chmod still leaves the tree removable.
 * @param {string} dir
 */
export async function makeReadOnly(dir) {
  track(dir, async () => {
    await chmodTree(dir, 'u+w')
    await rm(dir, { recursive: true, force: true })
  })
  await chmodTree(dir, 'a-w')
}

/**
 * @returns {Promise<Record<string, string>>}
 */
async function fixtureDependencies() {
  const manifest = JSON.parse(await readFile(join(FIXTURE_ROOT, 'package.json'), 'utf8'))
  return { ...manifest.dependencies, ...manifest.devDependencies }
}

/**
 * Installs packed Genie tarballs plus the fixture's exact resolved dependencies outside the monorepo, as a user would.
 * The install is made read-only so an agent cannot edit it through a trial's `node_modules` link.
 * @returns {Promise<Consumer>}
 */
export async function prepareConsumer() {
  const root = await temporaryDirectory('genie-eval-deps-')
  /** @type {string[]} */
  const tarballs = []
  for (const packageRoot of PACKED_PACKAGES) {
    const packed = await run('pnpm', ['pack', '--json', '--pack-destination', root], {
      cwd: packageRoot,
      timeoutMs: 60_000,
    })
    if (packed.code !== 0) throw new Error(`pnpm pack failed in ${packageRoot}: ${packed.stderr}`)
    tarballs.push(resolve(root, JSON.parse(packed.stdout).filename))
  }

  /** @type {Record<string, string>} */
  const versions = {}
  /** @type {string[]} */
  const registryDependencies = []
  for (const [name, range] of Object.entries(await fixtureDependencies())) {
    const manifest = JSON.parse(await readFile(join(FIXTURE_MODULES, name, 'package.json'), 'utf8'))
    versions[name] = manifest.version
    if (!String(range).startsWith('workspace:'))
      registryDependencies.push(`${name}@${manifest.version}`)
  }

  await writeFile(join(root, 'package.json'), '{ "private": true, "type": "module" }\n')
  const installed = await run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      '--package-lock=false',
      ...tarballs,
      ...registryDependencies,
    ],
    { cwd: root, timeoutMs: 300_000 },
  )
  if (installed.code !== 0) {
    throw new Error(
      `npm install of the packed consumer failed:\n${installed.stdout}${installed.stderr}`,
    )
  }
  await makeReadOnly(root)
  const modules = join(root, 'node_modules')
  return { root, modules, cliEntry: join(modules, '@genie-react/cli/dist/cli.js'), versions }
}

/**
 * Copies the fixture to a fresh directory outside the repo so the agent cannot see graders or tasks.
 * @param {string} label
 * @param {Consumer | null} consumer Packed install to link; null links the workspace install.
 * @returns {Promise<string>}
 */
export async function copyFixture(label, consumer) {
  const dir = await temporaryDirectory(`genie-eval-${label}-`)
  await cp(FIXTURE_ROOT, dir, {
    recursive: true,
    filter: (source) => {
      const [first] = relative(FIXTURE_ROOT, source).split(sep)
      return first === undefined || !COPY_EXCLUDES.has(first)
    },
  })
  const modules = consumer?.modules ?? (await realpath(FIXTURE_MODULES))
  await symlink(modules, join(dir, 'node_modules'), 'dir')
  await writeFile(join(dir, '.gitignore'), 'node_modules\n.genie\n.vite\n')
  if (consumer) await pinWorkspaceVersions(dir, consumer.versions)
  return dir
}

/**
 * @param {string} dir
 * @param {Record<string, string>} versions
 */
async function pinWorkspaceVersions(dir, versions) {
  const path = join(dir, 'package.json')
  const manifest = JSON.parse(await readFile(path, 'utf8'))
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, range] of Object.entries(manifest[field] ?? {})) {
      if (String(range).startsWith('workspace:')) manifest[field][name] = `^${versions[name]}`
    }
  }
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`)
}

/**
 * Builds the agent's workspace: fixture copy, git baseline, and `genie-react init`, which installs the skill for both agents.
 * @param {{ label: string, agent: 'claude' | 'codex', consumer: Consumer }} options
 */
export async function prepareTrialWorkspace({ label, agent, consumer }) {
  const dir = await copyFixture(label, consumer)
  try {
    return await initializeTrialWorkspace(dir, agent, consumer)
  } catch (error) {
    await removeWorkspace(dir)
    throw error
  }
}

/**
 * @param {string} dir
 * @param {'claude' | 'codex'} agent
 * @param {Consumer} consumer
 */
async function initializeTrialWorkspace(dir, agent, consumer) {
  await git(dir, ['init', '-q'])
  await git(dir, ['add', '-A'])
  await git(dir, ['commit', '-qm', 'fixture'])

  const init = await run(process.execPath, [consumer.cliEntry, 'init', '--yes'], {
    cwd: dir,
    timeoutMs: 60_000,
  })
  if (init.code !== 0) {
    throw new Error(`genie-react init failed (${init.code}): ${init.stdout}${init.stderr}`)
  }
  /** @type {Record<string, unknown> | null} */
  let initReceipt = null
  try {
    initReceipt = JSON.parse(init.stdout)
  } catch {}

  await git(dir, ['add', '-A'])
  await git(dir, ['commit', '-q', '--allow-empty', '-m', 'genie setup'])
  const skill = join(dir, agent === 'claude' ? '.claude' : '.agents', 'skills/genie/SKILL.md')
  return { dir, initReceipt, skillInstalled: existsSync(skill) }
}

/**
 * Returns the agent's source changes since the setup commit, excluding agent tool state.
 * @param {string} dir
 */
export async function workspaceDiff(dir) {
  await git(dir, ['add', '-A'])
  const pathspec = ['--', '.', ':(exclude).claude', ':(exclude).agents', ':(exclude).codex']
  const patch = await git(dir, ['diff', '--cached', ...DIFF_OPTIONS, ...pathspec])
  const files = (await git(dir, ['diff', '--cached', '--name-only', ...DIFF_OPTIONS, ...pathspec]))
    .split('\n')
    .filter(Boolean)
  return { patch, files }
}

/**
 * @param {string} dir
 * @param {Edit[]} edits
 */
export async function applyEdits(dir, edits) {
  for (const { file, find, replace } of edits) {
    const path = join(dir, file)
    const source = await readFile(path, 'utf8')
    const occurrences = source.split(find).length - 1
    if (occurrences !== 1) {
      throw new Error(`${file}: expected exactly one match for edit, found ${occurrences}`)
    }
    await writeFile(
      path,
      source.replace(find, () => replace),
    )
  }
}

/**
 * @param {string} dir
 */
export async function typecheck(dir) {
  const tsc = join(dir, 'node_modules/typescript/bin/tsc')
  const result = await run(process.execPath, [tsc, '--noEmit', '-p', dir], {
    cwd: dir,
    timeoutMs: 120_000,
  })
  return { pass: result.code === 0, output: `${result.stdout}${result.stderr}`.trim() }
}

/**
 * @param {string} dir
 */
export async function startDevServer(dir) {
  const port = await freePort()
  const vite = join(dir, 'node_modules/vite/bin/vite.js')
  const server = start(
    process.execPath,
    [vite, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: dir },
  )
  const url = `http://127.0.0.1:${port}/`
  try {
    await waitForHttp(url, {
      timeoutMs: 60_000,
      isAlive: () => !server.exited(),
      describe: server.log,
    })
  } catch (error) {
    await server.stop()
    throw error
  }
  return { url, port, stop: server.stop, log: server.log }
}

/**
 * Removes a directory created by this module, restoring write access first for the consumer install.
 * @param {string} dir
 */
export async function removeWorkspace(dir) {
  await release(dir)
}
