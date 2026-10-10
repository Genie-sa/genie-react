import { lstat, mkdir, mkdtemp, readFile, readlink, rm, symlink, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { startGenieHub } from 'genie-react/hub'
import { GENIE_DISCOVERY_FILE } from 'genie-react/protocol'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
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
    expect(text).toContain('universal setup')
    expect(text).toContain('client.js')
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
    expect(runDoctor({ cwd: dir, logger: silent })).toMatchObject({
      versions: { bundledSkill: '0.14.0', activeSkill: '0.14.0' },
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
    const hub = await startGenieHub({ rootDir: dir })
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
