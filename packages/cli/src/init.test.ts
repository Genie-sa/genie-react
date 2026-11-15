import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { removeAgentToken, startGenieHub, writeAgentToken } from 'genie-react/hub'
import { decodeFrame, encodeMessage, GENIE_DISCOVERY_FILE } from 'genie-react/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WebSocket } from 'ws'
import {
  detectFramework,
  type Logger,
  runDoctor,
  runInit,
  runLiveDoctor,
  sourceMapHealthOf,
} from './index'

const VITE_CONFIG = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`

const ROUTER_ROOT = `import { Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'

export const Route = createRootRoute({ component: RootComponent })

function RootComponent() {
  return (
    <>
      <Outlet />
      <TanStackRouterDevtools position="bottom-right" />
    </>
  )
}
`

const START_ROOT = `import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'

export const Route = createRootRoute({ shellComponent: RootDocument })

function RootDocument({ children }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
`

const NEXT_LAYOUT = `export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`

const pkg = (deps: Record<string, string>): string =>
  JSON.stringify({ name: 'fixture', private: true, type: 'module', dependencies: deps }, null, 2)

let root: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'genie-init-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

async function project(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(join(root, 'p-'))
  for (const [rel, contents] of Object.entries(files)) {
    const path = join(dir, rel)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, contents, 'utf8')
  }
  return dir
}

function capture(): { logger: Logger; lines: string[] } {
  const lines: string[] = []
  return { logger: { info: (m) => lines.push(m), error: (m) => lines.push(m) }, lines }
}

const silent: Logger = { info: () => {}, error: () => {} }
const staleSkill = (version: string) =>
  `---\nname: genie\nmetadata:\n  version: "${version}"\n  package: "@genie-react/cli"\n---\nstale\n`

describe('detectFramework', () => {
  it('classifies a project with @tanstack/react-start as tanstack-start', async () => {
    const dir = await project({
      'package.json': pkg({
        '@tanstack/react-start': 'latest',
        '@tanstack/react-router': 'latest',
      }),
      'src/routes/__root.tsx': START_ROOT,
    })
    expect(detectFramework(dir)).toBe('tanstack-start')
  })

  it('classifies @tanstack/react-router + a __root route as tanstack-router', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'src/routes/__root.tsx': ROUTER_ROOT,
    })
    expect(detectFramework(dir)).toBe('tanstack-router')
  })

  it('classifies a bare index.html (no TanStack deps) as react-vite', async () => {
    const dir = await project({
      'package.json': pkg({ react: '^19', 'react-dom': '^19' }),
      'index.html': '<div id="root"></div>',
    })
    expect(detectFramework(dir)).toBe('react-vite')
  })

  it('treats start as more specific than router when both deps are present', async () => {
    const dir = await project({
      'package.json': pkg({
        '@tanstack/react-start': 'latest',
        '@tanstack/react-router': 'latest',
      }),
      'index.html': '<div id="root"></div>',
      'src/routes/__root.tsx': START_ROOT,
    })
    expect(detectFramework(dir)).toBe('tanstack-start')
  })

  it('falls back to tanstack-router when the router dep is present but no __root exists', async () => {
    const dir = await project({ 'package.json': pkg({ '@tanstack/react-router': 'latest' }) })
    expect(detectFramework(dir)).toBe('tanstack-router')
  })

  it('classifies a router dep + index.html with a non-default routes dir as tanstack-router, not react-vite', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'routes/__root.tsx': ROUTER_ROOT,
    })
    expect(detectFramework(dir)).toBe('tanstack-router')
  })

  it('classifies a project with next as nextjs', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'app/layout.tsx': NEXT_LAYOUT,
    })
    expect(detectFramework(dir)).toBe('nextjs')
  })

  it('classifies an empty project as unknown', async () => {
    const dir = await project({ 'package.json': pkg({}) })
    expect(detectFramework(dir)).toBe('unknown')
  })

  it('detects app/routes/__root.jsx as well as src/routes', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'app/routes/__root.jsx': ROUTER_ROOT,
    })
    expect(detectFramework(dir)).toBe('tanstack-router')
  })
})

describe('runInit — plain React + Vite', () => {
  it('wires the plugin, skips the component, and reports success', async () => {
    const dir = await project({
      'package.json': pkg({ react: '^19' }),
      'index.html': '<div id="root"></div>',
      'vite.config.ts': VITE_CONFIG,
    })
    const { logger, lines } = capture()
    const result = runInit({ cwd: dir, dryRun: true, logger })

    expect(result.framework).toBe('react-vite')
    expect(result.viteConfig.action).toBe('edit')
    expect(result.rootRoute.action).toBe('skip')
    expect(result.ok).toBe(true)
    expect(lines.join('\n')).not.toContain('no root route found')
  })

  it('lists the single genie-react package in next steps for a plain React app', async () => {
    const dir = await project({
      'package.json': pkg({ react: '^19' }),
      'index.html': '<div id="root"></div>',
      'vite.config.ts': VITE_CONFIG,
    })
    const { logger, lines } = capture()
    runInit({ cwd: dir, dryRun: true, logger })
    const text = lines.join('\n')
    expect(text).toContain('npm install -D genie-react @genie-react/cli')
  })

  it('still prints the <Genie /> render step — only it surfaces the memory + plugin tools', async () => {
    const dir = await project({
      'package.json': pkg({ react: '^19' }),
      'index.html': '<div id="root"></div>',
      'vite.config.ts': VITE_CONFIG,
    })
    const { logger, lines } = capture()
    runInit({ cwd: dir, dryRun: true, logger })
    const text = lines.join('\n')
    expect(text).toContain('render Genie near your app root')
    expect(text).toContain('{import.meta.env.DEV && <Genie />}')
  })
})

describe('runInit — universal (no Vite, no Next)', () => {
  it('treats the hub + script-tag path as a valid setup and exits ok', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const { logger, lines } = capture()
    const result = runInit({ cwd: dir, dryRun: true, logger })
    const text = lines.join('\n')

    expect(result.framework).toBe('unknown')
    expect(result.ok).toBe(true)
    expect(text).toContain('setup with the standalone hub')
    expect(text).toContain('<script src="http://127.0.0.1:4390/__genie/client.js"></script>')
    expect(text).toContain("import 'genie-react/hook'")
    expect(text).not.toContain('add the plugin to your Vite config manually')
    expect(text).not.toContain('<Genie />}')
  })
})

describe('runInit — TanStack Router SPA', () => {
  it('inserts <Genie /> after <Outlet /> and adds the import', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': ROUTER_ROOT,
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.framework).toBe('tanstack-router')
    expect(result.rootRoute.action).toBe('edit')
    if (result.rootRoute.action !== 'edit') throw new Error('expected edit')
    expect(result.rootRoute.contents).toContain('<><Outlet />{import.meta.env.DEV && <Genie />}</>')
    expect(result.rootRoute.contents).toContain("import { Genie } from 'genie-react'")
    expect(result.ok).toBe(true)
  })

  it('reports manual when the root route has no <Outlet />, but still exits ok', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': 'export const Route = {}\n',
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.rootRoute.action).toBe('manual')
    expect(result.ok).toBe(true)
  })
})

describe('runInit — TanStack Start', () => {
  it('inserts <Genie /> before </body>', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-start': 'latest' }),
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': START_ROOT,
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.framework).toBe('tanstack-start')
    expect(result.rootRoute.action).toBe('edit')
    if (result.rootRoute.action !== 'edit') throw new Error('expected edit')
    expect(result.rootRoute.contents).toMatch(
      /\{import\.meta\.env\.DEV && <Genie \/>\}\n\s*<\/body>/,
    )
    expect(result.ok).toBe(true)
  })

  it('fails when the component cannot be wired (no </body>), since Start has no other client path', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-start': 'latest' }),
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': 'export const Route = {}\n',
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.rootRoute.action).toBe('manual')
    expect(result.ok).toBe(false)
  })
})

describe('runInit — apps wired by the published 0.1.0 names stay idempotent', () => {
  it('treats @genie-react/vite and @genie-react/react imports as already wired', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'vite.config.ts': `import { genie } from '@genie-react/vite'\n${VITE_CONFIG.replace('react()', 'genie(), react()')}`,
      'src/routes/__root.tsx': `import { Genie } from '@genie-react/react'\n${ROUTER_ROOT.replace('<Outlet />', '<><Outlet />{import.meta.env.DEV && <Genie />}</>')}`,
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.viteConfig.action).toBe('already')
    expect(result.rootRoute.action).toBe('already')
  })
})

describe('runInit — Next.js', () => {
  it('inserts <GenieScript /> after <body> and plans instrumentation.ts', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'app/layout.tsx': NEXT_LAYOUT,
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.framework).toBe('nextjs')
    expect(result.rootRoute.action).toBe('edit')
    if (result.rootRoute.action !== 'edit') throw new Error('expected edit')
    expect(result.rootRoute.contents).toContain("import { GenieScript } from 'genie-react/next'")
    expect(result.rootRoute.contents).toMatch(/<body>\n\s*<GenieScript \/>/)
    expect(result.instrumentation?.action).toBe('edit')
    if (result.instrumentation?.action !== 'edit') throw new Error('expected edit')
    expect(result.instrumentation.contents).toContain('registerGenie')
    expect(result.ok).toBe(true)
  })

  it('creates instrumentation.ts and is idempotent on a second run', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'app/layout.tsx': NEXT_LAYOUT,
    })
    const first = runInit({ cwd: dir, logger: silent })
    expect(first.rootRoute.action).toBe('edit')
    expect(first.instrumentation?.action).toBe('edit')

    const instrumentation = await readFile(join(dir, 'instrumentation.ts'), 'utf8')
    expect(instrumentation).toContain("await import('genie-react/next')")

    const second = runInit({ cwd: dir, logger: silent })
    expect(second.rootRoute.action).toBe('already')
    expect(second.instrumentation?.action).toBe('already')
  })

  it('respects src/ layouts and leaves an existing foreign instrumentation file alone', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'src/app/layout.tsx': NEXT_LAYOUT,
      'src/instrumentation.ts': 'export function register() {}\n',
    })
    const result = runInit({ cwd: dir, logger: silent })

    expect(result.rootRoute.action).toBe('edit')
    expect(result.instrumentation?.action).toBe('manual')
    expect(result.ok).toBe(true)
  })

  it('reports manual when the layout has no <body>', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'app/layout.tsx': 'export default function RootLayout() { return null }\n',
    })
    const result = runInit({ cwd: dir, dryRun: true, logger: silent })

    expect(result.rootRoute.action).toBe('manual')
    expect(result.ok).toBe(false)
  })
})

describe('runDoctor — Next.js', () => {
  it('checks the app layout for <GenieScript /> instead of a Vite config', async () => {
    const dir = await project({
      'package.json': pkg({ next: '^16', react: '^19' }),
      'app/layout.tsx': NEXT_LAYOUT.replace('<body>', '<body>\n        <GenieScript />'),
    })
    const result = runDoctor({ cwd: dir, logger: silent })

    expect(result.framework).toBe('nextjs')
    const layoutCheck = result.checks.find((c) => c.label.includes('GenieScript'))
    expect(layoutCheck?.ok).toBe(true)
    expect(result.checks.some((c) => c.label.includes('Vite config'))).toBe(false)
  })
})

describe('runDoctor — discovery and skill checks', () => {
  it('finds the hub discovery file from a subdirectory instead of reporting no hub', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const file = join(dir, GENIE_DISCOVERY_FILE)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(
      file,
      JSON.stringify({ url: 'ws://127.0.0.1:4390/__genie/ws', port: 4390, pid: process.pid }),
    )
    const nested = join(dir, 'src', 'components')
    await mkdir(nested, { recursive: true })

    const result = runDoctor({ cwd: nested, logger: silent })

    expect(result.bridge?.url).toBe('ws://127.0.0.1:4390/__genie/ws')
    expect(result.checks).toContainEqual(
      expect.objectContaining({ label: 'hub is running', ok: true, detail: 'port 4390' }),
    )
  })

  it('treats a missing agent skill as a warning but drifted guidance as a failure', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const skillCheck = () =>
      runDoctor({ cwd: dir, logger: silent }).checks.find(
        (check) => check.label === 'agent skill matches the bundled CLI guidance',
      )

    expect(skillCheck()).toMatchObject({ ok: false, critical: false })

    await mkdir(join(dir, '.agents/skills/genie'), { recursive: true })
    await writeFile(join(dir, '.agents/skills/genie/SKILL.md'), staleSkill('0.8.0'))
    expect(skillCheck()).toMatchObject({ ok: false, critical: true })
  })
})

describe('runDoctor — GENIE_SKILL_DIR', () => {
  const SKILL_LABEL = 'agent skill in GENIE_SKILL_DIR matches the bundled CLI guidance'
  const shippedSkillDirectory = join(process.cwd(), 'packages/cli/skill')

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  async function externalSkill(files: Record<string, string>): Promise<string> {
    const directory = await mkdtemp(join(root, 'skills-'))
    for (const [name, contents] of Object.entries(files)) {
      await writeFile(join(directory, name), contents, 'utf8')
    }
    return directory
  }

  async function shippedSkillFiles(): Promise<Record<string, string>> {
    const names = ['SKILL.md', 'APP_TOOLS.md', 'EVIDENCE.md']
    const contents = await Promise.all(
      names.map((name) => readFile(join(shippedSkillDirectory, name), 'utf8')),
    )
    return Object.fromEntries(names.map((name, index) => [name, contents[index] ?? '']))
  }

  it('accepts the shipped skill copied outside a yarn project and skips the project locations', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }), 'yarn.lock': '' })
    const directory = await externalSkill(await shippedSkillFiles())
    vi.stubEnv('GENIE_SKILL_DIR', directory)
    const { version } = JSON.parse(
      await readFile(join(process.cwd(), 'packages/cli/package.json'), 'utf8'),
    )

    const result = runDoctor({ cwd: dir, logger: silent })

    expect(result.checks.find(({ label }) => label === SKILL_LABEL)).toMatchObject({ ok: true })
    expect(result.checks.some(({ label }) => label.includes('Claude Code skill'))).toBe(false)
    expect(result).toMatchObject({
      versions: { activeSkill: version },
      skill: { path: directory, current: true, locations: [{ path: directory }] },
    })
  })

  it('fails drifted guidance in GENIE_SKILL_DIR and says to copy the bundled files there', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const directory = await externalSkill({ 'SKILL.md': staleSkill('0.8.0') })
    vi.stubEnv('GENIE_SKILL_DIR', directory)

    const check = runDoctor({ cwd: dir, logger: silent }).checks.find(
      ({ label }) => label === SKILL_LABEL,
    )

    expect(check).toMatchObject({ ok: false, critical: true })
    expect(check?.detail).toContain(`copy the files in ${shippedSkillDirectory} into ${directory}`)
  })

  it('warns, without failing, when GENIE_SKILL_DIR holds no skill', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    vi.stubEnv('GENIE_SKILL_DIR', join(root, 'absent'))

    const check = runDoctor({ cwd: dir, logger: silent }).checks.find(
      ({ label }) => label === SKILL_LABEL,
    )

    expect(check).toMatchObject({ ok: false, critical: false })
  })
})

describe('runInit — idempotency and dry-run', () => {
  it('installs stale agent guidance and references from the bundled version and doctor verifies their hash', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': ROUTER_ROOT,
    })
    const activeSkill = join(dir, '.agents/skills/genie/SKILL.md')
    const activeAppTools = join(dir, '.agents/skills/genie/APP_TOOLS.md')
    const bundledSkill = await readFile(join(process.cwd(), 'packages/cli/skill/SKILL.md'), 'utf8')
    const bundledAppTools = await readFile(
      join(process.cwd(), 'packages/cli/skill/APP_TOOLS.md'),
      'utf8',
    )

    expect(bundledSkill).toContain('genie-react tools app')
    expect(bundledSkill).toContain('`app_*`')

    runInit({ cwd: dir, logger: silent })
    expect(await readFile(activeSkill, 'utf8')).toBe(bundledSkill)
    expect(await readFile(activeAppTools, 'utf8')).toBe(bundledAppTools)
    const { version } = JSON.parse(
      await readFile(join(process.cwd(), 'packages/cli/package.json'), 'utf8'),
    )
    expect(runDoctor({ cwd: dir, logger: silent })).toMatchObject({
      versions: { bundledSkill: version, activeSkill: version },
      skill: { current: true },
    })

    await writeFile(activeAppTools, 'stale app-tools reference\n')
    expect(runDoctor({ cwd: dir, logger: silent }).skill.current).toBe(false)

    runInit({ cwd: dir, logger: silent })
    expect(await readFile(activeAppTools, 'utf8')).toBe(bundledAppTools)

    await writeFile(activeSkill, staleSkill('0.8.0'))
    const stale = runDoctor({ cwd: dir, logger: silent })
    expect(stale.skill.current).toBe(false)
    expect(stale.remediation.join('\n')).toContain('npx genie-react init')

    runInit({ cwd: dir, logger: silent })
    expect(await readFile(activeSkill, 'utf8')).toBe(bundledSkill)
    expect(runDoctor({ cwd: dir, logger: silent }).skill.current).toBe(true)
  })

  it('reports already on a second run for TanStack Router and writes nothing the second time', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-router': 'latest' }),
      'index.html': '<div id="app"></div>',
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': ROUTER_ROOT,
    })

    const first = runInit({ cwd: dir, logger: silent })
    expect(first.rootRoute.action).toBe('edit')
    expect(first.viteConfig.action).toBe('edit')

    const afterFirst = await readFile(join(dir, 'src/routes/__root.tsx'), 'utf8')

    const second = runInit({ cwd: dir, logger: silent })
    expect(second.rootRoute.action).toBe('already')
    expect(second.viteConfig.action).toBe('already')

    const afterSecond = await readFile(join(dir, 'src/routes/__root.tsx'), 'utf8')
    expect(afterSecond).toBe(afterFirst)
  })

  it('writes no files in dry-run mode', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-start': 'latest' }),
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': START_ROOT,
    })

    const result = runInit({ cwd: dir, dryRun: true, logger: silent })
    expect(result.dryRun).toBe(true)

    expect(await readFile(join(dir, 'vite.config.ts'), 'utf8')).toBe(VITE_CONFIG)
    expect(await readFile(join(dir, 'src/routes/__root.tsx'), 'utf8')).toBe(START_ROOT)
  })
})

describe('runInit — agent skill locations', () => {
  const VITE_APP = {
    'package.json': pkg({ react: '^19' }),
    'index.html': '<div id="root"></div>',
    'vite.config.ts': VITE_CONFIG,
  }
  const bundled = (name: string) =>
    readFile(join(process.cwd(), 'packages/cli/skill', name), 'utf8')

  it('links .claude/skills/genie to the canonical .agents copy and doctor verifies both', async () => {
    const dir = await project(VITE_APP)
    const claude = join(dir, '.claude/skills/genie')

    const result = runInit({ cwd: dir, logger: silent })
    expect(result.artifacts).toContainEqual(
      expect.objectContaining({ path: claude, status: 'applied', link: 'symlink' }),
    )
    expect((await lstat(claude)).isSymbolicLink()).toBe(true)
    expect(await readlink(claude)).toBe(join('..', '..', '.agents/skills/genie'))
    expect(await readFile(join(claude, 'EVIDENCE.md'), 'utf8')).toBe(await bundled('EVIDENCE.md'))

    const doctor = runDoctor({ cwd: dir, logger: silent })
    expect(doctor.skill.current).toBe(true)
    expect(doctor.skill.locations).toEqual([
      expect.objectContaining({ path: '.agents/skills/genie', symlink: false, current: true }),
      expect.objectContaining({ path: '.claude/skills/genie', symlink: true, current: true }),
    ])

    const second = runInit({ cwd: dir, logger: silent })
    expect(
      second.artifacts.filter(({ kind }) => kind === 'agent_skill').map(({ status }) => status),
    ).toEqual(['already', 'already', 'already', 'already'])
  })

  it('refreshes an existing .claude copy in place and doctor reports its drift', async () => {
    const dir = await project({
      ...VITE_APP,
      '.claude/skills/genie/SKILL.md': staleSkill('0.12.3'),
    })
    runInit({ cwd: dir, logger: silent })
    const claudeSkill = join(dir, '.claude/skills/genie/SKILL.md')
    expect((await lstat(join(dir, '.claude/skills/genie'))).isSymbolicLink()).toBe(false)
    expect(await readFile(claudeSkill, 'utf8')).toBe(await bundled('SKILL.md'))
    expect(runDoctor({ cwd: dir, logger: silent }).skill.current).toBe(true)

    await writeFile(claudeSkill, staleSkill('0.14.0'))
    const drifted = runDoctor({ cwd: dir, logger: silent })
    expect(drifted.ok).toBe(false)
    expect(drifted.skill.current).toBe(false)
    expect(drifted.checks.find(({ label }) => label.startsWith('agent skill'))?.ok).toBe(true)
    const claudeCheck = drifted.checks.find(({ label }) => label.startsWith('Claude Code skill'))
    expect(claudeCheck).toMatchObject({ ok: false, critical: true })
    expect(claudeCheck?.detail).toContain('drifted')
    expect(drifted.remediation.join('\n')).toContain('npx genie-react init')

    runInit({ cwd: dir, logger: silent })
    expect(runDoctor({ cwd: dir, logger: silent }).skill.current).toBe(true)
  })

  it('reports a missing Claude Code location without failing the canonical check', async () => {
    const dir = await project(VITE_APP)
    runInit({ cwd: dir, logger: silent })
    await rm(join(dir, '.claude'), { recursive: true })

    const doctor = runDoctor({ cwd: dir, logger: silent })
    expect(doctor.skill.locations[0]?.current).toBe(true)
    expect(doctor.checks.find(({ label }) => label.startsWith('Claude Code skill'))?.detail).toBe(
      '.claude/skills/genie missing; run: npx genie-react init',
    )
  })

  it('leaves a symlink that points elsewhere untouched and reports it as manual', async () => {
    const dir = await project({ ...VITE_APP, 'elsewhere/SKILL.md': 'foreign skill\n' })
    await mkdir(join(dir, '.claude/skills'), { recursive: true })
    await symlink(join(dir, 'elsewhere'), join(dir, '.claude/skills/genie'), 'dir')

    const result = runInit({ cwd: dir, logger: silent })
    expect(result.artifacts).toContainEqual(
      expect.objectContaining({
        path: join(dir, '.claude/skills/genie'),
        status: 'manual',
        reason: 'skill_path_conflict',
      }),
    )
    expect(await readFile(join(dir, 'elsewhere/SKILL.md'), 'utf8')).toBe('foreign skill\n')
  })

  it.each([
    ['no lockfile', {}, 'npx genie-react'],
    ['package-lock.json', { 'package-lock.json': '{}' }, 'npx genie-react'],
    ['pnpm-lock.yaml', { 'pnpm-lock.yaml': '' }, 'pnpm exec genie-react'],
    ['a Yarn Berry yarn.lock', { 'yarn.lock': '__metadata:\n  version: 8\n' }, 'yarn genie-react'],
    ['a Yarn 1 yarn.lock', { 'yarn.lock': '# yarn lockfile v1\n' }, 'yarn --silent genie-react'],
    ['bun.lock', { 'bun.lock': '' }, 'bunx genie-react'],
  ])('uses one command prefix for %s across skill and hints', async (_, lockfile, invocation) => {
    const dir = await project({ ...VITE_APP, ...lockfile })
    runInit({ cwd: dir, logger: silent })

    for (const name of ['SKILL.md', 'APP_TOOLS.md']) {
      const installed = await readFile(join(dir, '.agents/skills/genie', name), 'utf8')
      expect(installed).toContain(`${invocation} tools app`)
      if (invocation !== 'npx genie-react') expect(installed).not.toContain('npx genie-react')
    }
    expect(runDoctor({ cwd: dir, logger: silent }).skill.current).toBe(true)

    await rm(join(dir, '.claude'), { recursive: true })
    expect(runDoctor({ cwd: dir, logger: silent }).remediation).toContain(
      `.claude/skills/genie missing; run: ${invocation} init`,
    )
  })

  const BIN = 'node_modules/.bin/genie-react'

  it.each([
    ['an app with its own binary', 'pnpm-lock.yaml', '', [BIN], BIN],
    [
      'an app in a workspace that hoists the binary',
      'package-lock.json',
      'apps/web/',
      [BIN],
      `../../${BIN}`,
    ],
    [
      'an app with its own and a hoisted binary',
      'bun.lock',
      'apps/web/',
      [BIN, `apps/web/${BIN}`],
      BIN,
    ],
    ['a binary outside the project', 'yarn.lock', 'apps/web/', [], 'yarn genie-react'],
  ])(
    'skill commands call the installed binary for %s',
    async (_, lockfile, app, bins, invocation) => {
      const outer = await mkdtemp(join(root, 'outer-'))
      await mkdir(join(outer, 'node_modules/.bin'), { recursive: true })
      await writeFile(join(outer, BIN), '#!/bin/sh\n')
      const workspace = join(outer, 'workspace')
      const files = Object.fromEntries(
        Object.entries(VITE_APP).map(([name, body]) => [`${app}${name}`, body]),
      )
      for (const [name, body] of Object.entries({ ...files, [lockfile]: '' })) {
        await mkdir(dirname(join(workspace, name)), { recursive: true })
        await writeFile(join(workspace, name), body)
      }
      for (const bin of bins) {
        await mkdir(dirname(join(workspace, bin)), { recursive: true })
        await writeFile(join(workspace, bin), '#!/bin/sh\n')
      }
      const dir = join(workspace, app)

      runInit({ cwd: dir, logger: silent })

      const installed = await readFile(join(dir, '.agents/skills/genie/SKILL.md'), 'utf8')
      expect(installed).toContain(`\n${invocation} status --session my-agent --wait 15000\n`)
      expect(installed).not.toContain('npx genie-react')
      const doctor = runDoctor({ cwd: dir, logger: silent })
      expect(doctor.skill.current).toBe(true)
      await rm(join(dir, '.claude'), { recursive: true })
      expect(runDoctor({ cwd: dir, logger: silent }).remediation.join('\n')).not.toContain(BIN)
    },
  )

  it('keeps the exec command on Windows, where shells cannot run a .bin path as written', async () => {
    const dir = await project({ ...VITE_APP, 'pnpm-lock.yaml': '', [BIN]: '#!/bin/sh\n' })
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })
    try {
      runInit({ cwd: dir, logger: silent })
    } finally {
      if (platform) Object.defineProperty(process, 'platform', platform)
    }

    const installed = await readFile(join(dir, '.agents/skills/genie/SKILL.md'), 'utf8')
    expect(installed).toContain('\npnpm exec genie-react status --session my-agent --wait 15000\n')
  })

  it.each([
    [
      'a foreign skill directory',
      '.claude/skills/genie',
      'directory',
      async (dir: string) => {
        await mkdir(join(dir, '.claude/skills/genie'), { recursive: true })
        await writeFile(join(dir, '.claude/skills/genie/SKILL.md'), 'another skill\n')
      },
    ],
    [
      'a dangling skill symlink',
      '.claude/skills/genie',
      'symlink',
      async (dir: string) => {
        await mkdir(join(dir, '.claude/skills'), { recursive: true })
        await symlink(join(dir, 'missing'), join(dir, '.claude/skills/genie'), 'dir')
      },
    ],
    [
      'a .agents file',
      '.agents',
      'file',
      (dir: string) => writeFile(join(dir, '.agents'), 'not a directory\n'),
    ],
    [
      'a .agents symlink out of the project',
      '.agents',
      'symlink',
      (dir: string) => symlink(dirname(dir), join(dir, '.agents'), 'dir'),
    ],
  ])('has init and doctor name %s as the entry to fix', async (_, blocking, kind, occupy) => {
    const dir = await project(VITE_APP)
    await occupy(dir)

    expect(runInit({ cwd: dir, logger: silent }).artifacts).toContainEqual(
      expect.objectContaining({
        path: join(dir, blocking),
        status: 'manual',
        reason: 'skill_path_conflict',
      }),
    )
    const doctor = runDoctor({ cwd: dir, logger: silent })
    expect(doctor.skill.locations.map(({ conflictPath }) => conflictPath)).toContain(blocking)
    expect(doctor.remediation).toContainEqual(
      expect.stringMatching(
        new RegExp(
          `^skill_path_conflict: ${blocking.replaceAll('.', '\\.')} blocks .*\\. Remove or replace the ${kind} at ${blocking.replaceAll('.', '\\.')}, then run: npx genie-react init$`,
        ),
      ),
    )
  })
})

describe('runDoctor — package checks', () => {
  it('checks the single genie-react package for a plain React + Vite app', async () => {
    const dir = await project({
      'package.json': pkg({ react: '^19' }),
      'index.html': '<div id="root"></div>',
      'vite.config.ts': VITE_CONFIG.replace('react()', 'genie(), react()'),
    })
    const result = runDoctor({ cwd: dir, logger: silent })

    expect(result.framework).toBe('react-vite')
    const labels = result.checks.map((c) => c.label)
    expect(labels).toContain('genie-react resolvable in node_modules')
  })

  it('checks the same package set for a TanStack Start app', async () => {
    const dir = await project({
      'package.json': pkg({ '@tanstack/react-start': 'latest' }),
      'vite.config.ts': VITE_CONFIG,
      'src/routes/__root.tsx': START_ROOT,
    })
    const result = runDoctor({ cwd: dir, logger: silent })

    expect(result.framework).toBe('tanstack-start')
    const labels = result.checks.map((c) => c.label)
    expect(labels).toContain('genie-react resolvable in node_modules')
  })
})

describe('source-map health', () => {
  it('treats served-only coordinates as partial rather than mapped and healthy', () => {
    expect(
      sourceMapHealthOf({
        summary: { sourceMaps: { mapped: 0, served: 12, unknown: 0 } },
      }),
    ).toEqual({ status: 'partial', mapped: 0, served: 12, unknown: 0 })
    expect(
      sourceMapHealthOf({
        summary: { sourceMaps: { mapped: 12, served: 0, unknown: 0 } },
      }),
    ).toEqual({ status: 'healthy', mapped: 12, served: 0, unknown: 0 })
  })
})

/** A hub on an OS-assigned port serving a stand-in client, so these tests need neither a free default port nor a built package. */
async function startTestHub(rootDir: string) {
  const clientBundlePath = join(rootDir, 'client.global.iife.js')
  await writeFile(clientBundlePath, '/* stand-in genie client */\n')
  return startGenieHub({ rootDir, port: 0, strictPort: true, clientBundlePath })
}

/** An app session with only the React tools the live doctor calls, answering react_get_renders with `renderCollection`. */
async function connectReactApp(dir: string, renderCollection: string): Promise<WebSocket> {
  const discovery = JSON.parse(await readFile(join(dir, GENIE_DISCOVERY_FILE), 'utf8')) as {
    url: string
  }
  const app = new WebSocket(`${discovery.url}?role=app`)
  await new Promise<void>((resolve, reject) => {
    app.once('open', resolve)
    app.once('error', reject)
  })
  app.on('message', (data) => {
    const message = decodeFrame(data.toString()) as { kind?: string; id?: string; tool?: string }
    if (message.kind !== 'bridge/request') return
    const result =
      message.tool === 'react_get_renders' ? { renderCollection, components: [] } : { matches: [] }
    app.send(encodeMessage({ kind: 'app/response', id: message.id, ok: true, result }))
  })
  const sessionId = 'live-doctor-react'
  app.send(
    encodeMessage({
      kind: 'app/hello',
      protocol: 1,
      sessionId,
      app: { name: 'Live doctor fixture' },
      capabilities: ['react'],
      tools: ['react_find_components', 'react_provenance', 'react_get_renders'].map((name) => ({
        name,
        title: name,
        description: 'Fixture tool.',
        group: 'react',
        annotations: { readOnlyHint: true },
      })),
    }),
  )
  app.send(encodeMessage({ kind: 'app/ready', sessionId }))
  return app
}

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : 0
      server.close(() => resolve(port))
    })
    server.once('error', reject)
  })
}

describe('runLiveDoctor', () => {
  it('probes a running standalone hub end to end', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const hub = await startTestHub(dir)
    try {
      const live = await runLiveDoctor({ cwd: dir, logger: silent })
      const byLabel = (prefix: string) => live.checks.find((c) => c.label.startsWith(prefix))
      expect(byLabel('standalone hub answering')?.ok).toBe(true)
      expect(byLabel('hub serves the browser client')?.ok).toBe(true)
      expect(byLabel('bridge accepts agent connections')?.ok).toBe(true)
      const session = byLabel('no app session connected yet')
      expect(session?.ok).toBe(false)
      expect(session?.critical).toBe(false)
    } finally {
      if (hub.status === 'started') await hub.handle.close()
    }
  }, 15_000)

  it('keeps the agent token out of its report and explains a token mismatch', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const hub = await startTestHub(dir)
    try {
      if (hub.status !== 'started') throw new Error('expected a fresh hub')
      const healthy = await runLiveDoctor({ cwd: dir, logger: silent })
      expect(JSON.stringify(healthy)).not.toContain(hub.handle.bridge.agentToken)

      await writeAgentToken(dir, 'stale-token')
      const stale = await runLiveDoctor({ cwd: dir, logger: silent })
      const check = stale.checks.find((c) => c.label === 'bridge accepts agent connections')
      expect(check?.ok).toBe(false)
      expect(check?.detail).toContain('rejected the agent token')
      expect(JSON.stringify(stale)).not.toContain('stale-token')

      await removeAgentToken(dir)
      const unauthenticated = await runLiveDoctor({ cwd: dir, logger: silent })
      expect(unauthenticated.checks).toContainEqual(
        expect.objectContaining({ label: 'hub publishes an agent token', ok: false }),
      )
    } finally {
      if (hub.status === 'started') await hub.handle.close()
    }
  }, 15_000)

  it.each([
    ['available', { ok: true, critical: true }],
    [
      'unavailable (hook installed after React initialised — import genie-react/hook, or genie-react/native on React Native, before React)',
      { ok: false, critical: true },
    ],
    [
      'degraded (hook installed after React initialised — commits before that point were not observed)',
      { ok: false, critical: false },
    ],
  ])(
    'reports whether the hook loaded before React from a connected session: %s',
    async (renderCollection, verdict) => {
      const dir = await project({ 'package.json': pkg({ react: '^19' }) })
      const hub = await startTestHub(dir)
      const app = await connectReactApp(dir, renderCollection)
      try {
        const live = await runLiveDoctor({ cwd: dir, logger: silent })
        expect(live.checks).toContainEqual({
          label: 'genie-react/hook loaded before React',
          ...verdict,
          detail: `render collection ${renderCollection}`,
        })
      } finally {
        app.close()
        if (hub.status === 'started') await hub.handle.close()
      }
    },
    15_000,
  )

  it('probes the requested --session and names an unknown one', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const hub = await startTestHub(dir)
    try {
      const live = await runLiveDoctor({ cwd: dir, logger: silent, session: 'missing-tab' })
      const check = live.checks.find((c) => c.label === 'bridge accepts agent connections')
      expect(check?.ok).toBe(false)
      expect(check?.detail).toContain('--session target is not connected')
    } finally {
      if (hub.status === 'started') await hub.handle.close()
    }
  }, 15_000)

  it('records an ambiguous bridge selection as a failed check instead of crashing', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }), '.git/HEAD': '' })
    for (const app of ['a', 'b']) {
      const file = join(dir, app, GENIE_DISCOVERY_FILE)
      await mkdir(dirname(file), { recursive: true })
      await writeFile(
        file,
        JSON.stringify({
          url: `ws://127.0.0.1:${app === 'a' ? 4501 : 4502}/__genie/ws`,
          pid: process.pid,
        }),
      )
    }
    const live = await runLiveDoctor({ cwd: dir, logger: silent, timeoutMs: 300 })
    expect(live.ok).toBe(false)
    expect(live.checks).toContainEqual(
      expect.objectContaining({
        label: 'bridge selection',
        ok: false,
        detail: expect.stringContaining('Multiple live Genie bridges'),
      }),
    )
  })

  it('reports nothing listening when the discovery file points at a dead port', async () => {
    const dir = await project({ 'package.json': pkg({ react: '^19' }) })
    const port = await freePort()
    const file = join(dir, GENIE_DISCOVERY_FILE)
    await mkdir(dirname(file), { recursive: true })
    await writeFile(
      file,
      JSON.stringify({ url: `ws://localhost:${port}/__genie/ws`, port, pid: process.pid }),
      'utf8',
    )
    const live = await runLiveDoctor({ cwd: dir, logger: silent, timeoutMs: 800 })
    const check = live.checks.find((c) => c.label.startsWith('dev server / hub listening'))
    expect(check?.ok).toBe(false)
    expect(live.ok).toBe(false)
  }, 10_000)
})
