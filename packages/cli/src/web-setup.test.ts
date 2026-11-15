import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GENIE_DISCOVERY_FILE } from 'genie-react/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type Logger, runDoctor } from './index'
import { runInitCommand } from './setup-output'

const APPS = resolve(dirname(fileURLToPath(import.meta.url)), '../../../apps')
const silent: Logger = { info: () => {}, error: () => {} }

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'genie-web-setup-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(root, { recursive: true, force: true })
})

/** A copy of a demo app's own files beside the workspace runtime, so a running hub or install in the real app cannot change the result. */
async function copyApp(app: string, entries: readonly string[]): Promise<string> {
  const dir = await mkdtemp(join(root, `${app}-`))
  for (const entry of entries)
    await cp(join(APPS, app, entry), join(dir, entry), { recursive: true })
  await mkdir(join(dir, 'node_modules'))
  await symlink(join(APPS, '../packages/genie-react'), join(dir, 'node_modules/genie-react'))
  return dir
}

const legacyApp = () =>
  copyApp('realworld-legacy', ['package.json', 'webpack.config.js', 'public', 'src'])
const plainApp = () => copyApp('plain-demo', ['package.json', 'public', 'src'])

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(root, 'p-'))
  for (const [path, contents] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true })
    await writeFile(join(dir, path), contents)
  }
  return dir
}

async function startedHubAt(dir: string, port: number): Promise<void> {
  const file = join(dir, GENIE_DISCOVERY_FILE)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(
    file,
    JSON.stringify({ url: `ws://127.0.0.1:${port}/__genie/ws`, pid: process.pid }),
  )
}

function initReceipt(cwd: string) {
  const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  const code = runInitCommand({ cwd, dryRun: true })
  const receipt = JSON.parse(String(stdout.mock.lastCall?.[0]))
  stdout.mockRestore()
  return { code, receipt }
}

function check(dir: string, label: string) {
  return runDoctor({ cwd: dir, logger: silent }).checks.find((entry) => entry.label === label)
}

describe('init on a project that uses neither Vite nor Next.js', () => {
  it('plans the webpack app around its own hub script and bundled client', async () => {
    const dir = await legacyApp()
    const { code, receipt } = initReceipt(dir)

    expect(code).toBe(0)
    expect(receipt).toMatchObject({
      status: 'ok',
      userActionRequired: false,
      next: { argv: ['npm', 'run', 'hub'] },
      data: {
        framework: 'unknown',
        manualSteps: [],
        commands: { hub: { argv: ['npm', 'run', 'hub'] } },
        integration: {
          bundler: 'webpack',
          hubPort: 4712,
          hubPortSource: 'package-script',
          scriptUrl: 'http://127.0.0.1:4712/__genie/client.js',
          websocketUrl: 'ws://127.0.0.1:4712/__genie/ws',
        },
      },
    })
    expect(receipt.data.artifacts[0]).toEqual({
      kind: 'client_setup',
      status: 'already',
      path: 'src/devtools/connect-genie.ts',
    })
    const kinds = receipt.data.artifacts.map(({ kind }: { kind: string }) => kind)
    expect(kinds).not.toContain('vite_config')
    expect(kinds).not.toContain('root_route')
    expect(JSON.stringify(receipt)).not.toMatch(/GenieScript|genie-react\/next|vite/)
  })

  it('finds the esbuild app wired by its script tag on the default port', async () => {
    const { receipt } = initReceipt(await plainApp())
    expect(receipt.data.artifacts[0]).toEqual({
      kind: 'client_setup',
      status: 'already',
      path: 'public/index.html',
    })
    expect(receipt.data.integration).toMatchObject({
      bundler: 'esbuild',
      hubPort: 4390,
      hubPortSource: 'default',
    })
    expect(receipt.next.argv).toEqual(['npx', 'genie-react', 'hub', '--port', '4390'])
  })

  it('gives an unwired project one client step on the port of the hub that is running', async () => {
    const dir = await project({
      'package.json': JSON.stringify({ devDependencies: { '@rspack/core': '*', webpack: '*' } }),
      'src/index.tsx': "import { createRoot } from 'react-dom/client'\n",
    })
    await startedHubAt(dir, 5123)
    const { code, receipt } = initReceipt(dir)

    expect(code).toBe(0)
    expect(receipt.userActionRequired).toBe(true)
    expect(receipt.next.argv).toEqual(['npx', 'genie-react', 'doctor', '--live'])
    expect(receipt.data.integration).toMatchObject({
      bundler: 'rspack',
      hubPort: 5123,
      hubPortSource: 'running-hub',
    })
    expect(receipt.data.manualSteps).toEqual([
      expect.objectContaining({
        kind: 'client_setup',
        scriptTag: '<script src="http://127.0.0.1:5123/__genie/client.js"></script>',
        hookModule: 'genie-react/hook',
        module: 'genie-react/client',
        export: 'createGenieClient',
        url: 'ws://127.0.0.1:5123/__genie/ws',
        placement: expect.stringContaining('before React'),
      }),
    ])
  })

  it('names the file whose React import runs before the hook', async () => {
    const dir = await plainApp()
    const entry = join(dir, 'src/main-manual.tsx')
    const source = await readFile(entry, 'utf8')
    await writeFile(
      entry,
      source
        .replace("import 'genie-react/hook'\n", '')
        .replace(
          "import { createRoot } from 'react-dom/client'\n",
          "import { createRoot } from 'react-dom/client'\nimport 'genie-react/hook'\n",
        ),
    )
    const { receipt } = initReceipt(dir)
    expect(receipt.userActionRequired).toBe(true)
    expect(receipt.data.manualSteps).toEqual([
      expect.objectContaining({ kind: 'hook_order', path: 'src/main-manual.tsx' }),
    ])
  })
})

describe('doctor on a project that uses neither Vite nor Next.js', () => {
  it('passes both demo apps without a running hub, which is only a warning', async () => {
    for (const dir of [await legacyApp(), await plainApp()]) {
      const result = runDoctor({ cwd: dir, logger: silent })
      expect(result.checks.filter((entry) => entry.critical && !entry.ok)).toEqual([])
      expect(result.checks).toContainEqual(
        expect.objectContaining({ label: 'hub is running', ok: false, critical: false }),
      )
    }
    expect(check(await legacyApp(), 'webpack: development client connects to the hub')).toEqual({
      label: 'webpack: development client connects to the hub',
      ok: true,
      critical: true,
      detail:
        'genie-react/hook in src/devtools/install-hook.ts; createGenieClient in src/devtools/connect-genie.ts',
    })
  })

  it('fails a script tag that points away from the running hub and says which URL to load', async () => {
    const dir = await plainApp()
    await startedHubAt(dir, 5124)
    expect(check(dir, 'client script tag uses the hub port')).toEqual({
      label: 'client script tag uses the hub port',
      ok: false,
      critical: true,
      detail:
        'public/index.html loads http://127.0.0.1:4390/__genie/client.js, but the hub runs on port 5124; load http://127.0.0.1:5124/__genie/client.js',
    })
  })

  it.each([
    [
      'a bundled client without the hook',
      {
        'src/main.ts':
          "import { createGenieClient } from 'genie-react/client'\ncreateGenieClient({}).start()\n",
      },
      'no genie-react/hook import',
    ],
    [
      'the hook without a client',
      { 'src/main.ts': "import 'genie-react/hook'\nimport 'react'\n" },
      'no createGenieClient',
    ],
    [
      'only a commented-out hook import',
      { 'src/main.ts': "// import 'genie-react/hook'\n// require('genie-react/hook')\n" },
      'no client found',
    ],
  ])('fails %s with the step that completes it', async (_name, files, expected) => {
    const dir = await project({ 'package.json': '{}', ...files })
    expect(check(dir, 'web bundler: development client connects to the hub')).toMatchObject({
      ok: false,
      critical: true,
      detail: expect.stringContaining(expected),
    })
  })

  it('accepts a hook imported after a type-only React import, which loads nothing', async () => {
    const dir = await project({
      'package.json': '{}',
      'src/main.ts': [
        "import type { ReactNode } from 'react'",
        "import 'genie-react/hook'",
        "import { createRoot } from 'react-dom/client'",
        "import { createGenieClient } from 'genie-react/client'",
        'createGenieClient({}).start()',
      ].join('\n'),
    })
    expect(
      check(dir, 'genie-react/hook is imported before React in each file that imports it')?.ok,
    ).toBe(true)
  })

  it('ignores dependencies and build output when it looks for the client', async () => {
    const dir = await project({
      'package.json': '{}',
      'node_modules/lib/index.html':
        '<script src="http://127.0.0.1:4390/__genie/client.js"></script>',
      'dist/index.html': '<script src="http://127.0.0.1:4390/__genie/client.js"></script>',
    })
    expect(check(dir, 'web bundler: development client connects to the hub')?.ok).toBe(false)
  })
})
