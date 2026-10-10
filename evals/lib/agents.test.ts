import { describe, expect, it } from 'vitest'
import {
  agentCommand,
  agentEnv,
  agentHistoryDirs,
  claudeSandboxSettings,
  outsideRoots,
} from './agents.mjs'

const options = {
  executable: '/opt/bin/claude',
  dir: '/tmp/trial',
  model: 'sonnet',
  maxTurns: 10,
  maxBudgetUsd: 1,
  browserSession: 'genie-eval-run-task-1',
  toolDirs: ['/opt/node/bin', '/opt/tools/bin', '/opt/node/bin'],
  settingsPath: '/repo/evals/results/run/task-1.settings.json',
  readableRoots: ['/tmp/deps'],
  deniedReadRoots: ['/repo', '/home/me/.claude/projects'],
}

describe('agentEnv', () => {
  it('passes only allowlisted variables and builds a minimal PATH', () => {
    const env = agentEnv(
      {
        HOME: '/home/me',
        LANG: 'en_US.UTF-8',
        ANTHROPIC_API_KEY: 'key',
        CLAUDE_CODE_OAUTH_TOKEN: 'token',
        PATH: '/repo/node_modules/.bin:/usr/bin',
        OLDPWD: '/repo',
        PNPM_SCRIPT_SRC_DIR: '/repo',
        npm_package_json: '/repo/package.json',
        CLAUDECODE: '1',
        CLAUDE_CODE_ENTRYPOINT: 'cli',
        GENIE_BRIDGE_URL: 'ws://localhost:1',
      },
      options,
    )
    expect(env).toEqual({
      HOME: '/home/me',
      LANG: 'en_US.UTF-8',
      ANTHROPIC_API_KEY: 'key',
      CLAUDE_CODE_OAUTH_TOKEN: 'token',
      PATH: '/tmp/trial/node_modules/.bin:/opt/node/bin:/opt/tools/bin:/usr/bin:/bin:/usr/sbin:/sbin',
      AGENT_BROWSER_SESSION: 'genie-eval-run-task-1',
      AGENT_BROWSER_ALLOWED_DOMAINS: '127.0.0.1,localhost',
      npm_config_verify_deps_before_run: 'false',
      pnpm_config_verify_deps_before_run: 'false',
    })
  })
})

describe('claudeSandboxSettings', () => {
  const base = {
    dir: '/tmp/trial',
    readableRoots: ['/tmp/deps'],
    deniedReadRoots: ['/repo', '/tmp'],
    browserSocketDir: '/home/me/.agent-browser',
  }

  it('denies reads of the repo and temp roots and keeps network local', () => {
    expect(claudeSandboxSettings({ ...base, mode: 'diagnose' }).sandbox).toMatchObject({
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: false,
      filesystem: { denyRead: ['/repo', '/tmp'], allowRead: ['/tmp/trial', '/tmp/deps'] },
      network: {
        allowedDomains: ['localhost', '127.0.0.1'],
        allowLocalBinding: true,
        allowUnixSockets: ['/home/me/.agent-browser'],
      },
    })
  })

  it('allows writes only to Genie state and, in fix mode, src', () => {
    const diagnose = claudeSandboxSettings({ ...base, mode: 'diagnose' }).sandbox.filesystem
    expect(diagnose.allowWrite).toEqual(['/tmp/trial/.genie'])
    const fix = claudeSandboxSettings({ ...base, mode: 'fix' }).sandbox.filesystem
    expect(fix.allowWrite).toEqual(['/tmp/trial/.genie', '/tmp/trial/src'])
    expect(fix.denyWrite).toEqual(
      expect.arrayContaining([
        '/tmp/trial/vite.config.ts',
        '/tmp/trial/package.json',
        '/tmp/trial/tsconfig.json',
        '/tmp/trial/index.html',
        '/tmp/trial/.git',
        '/tmp/trial/.claude',
        '/tmp/trial/.agents',
        '/tmp/trial/node_modules',
      ]),
    )
  })
})

describe('outsideRoots', () => {
  it('drops directories inside a repository root but keeps look-alike siblings', () => {
    expect(
      outsideRoots(
        ['/repo/node_modules/.bin', '/repo', '/repo-tools/bin', '/usr/local/bin'],
        ['/repo'],
      ),
    ).toEqual(['/repo-tools/bin', '/usr/local/bin'])
  })
})

describe('agentHistoryDirs', () => {
  it('follows CLAUDE_CONFIG_DIR and CODEX_HOME', () => {
    expect(agentHistoryDirs({}, '/home/me')).toEqual([
      '/home/me/.claude/projects',
      '/home/me/.codex/sessions',
    ])
    expect(agentHistoryDirs({ CLAUDE_CONFIG_DIR: '/cfg', CODEX_HOME: '/cx' }, '/home/me')).toEqual([
      '/cfg/projects',
      '/cx/sessions',
    ])
  })
})

describe('agentCommand', () => {
  it('scopes Claude file tools to the trial and loads the sandbox settings', () => {
    const diagnose = agentCommand({ ...options, agent: 'claude', mode: 'diagnose' })
    expect(diagnose.command).toBe('/opt/bin/claude')
    expect(diagnose.args).toEqual(
      expect.arrayContaining(['--settings', options.settingsPath, 'Read(./**)', 'Read(//repo/**)']),
    )
    expect(diagnose.args).not.toContain('Read')
    expect(diagnose.args).not.toContain('Bash(cd *)')
    expect(diagnose.args).not.toContain('Bash(export *)')
    expect(diagnose.args).not.toContain('Bash(sort *)')
    expect(diagnose.args).toEqual(
      expect.arrayContaining(['Bash(agent-browser upload *)', 'Bash(agent-browser download *)']),
    )
    expect(diagnose.args).toContain('Read(//tmp/deps/**)')
    expect(diagnose.args.some((arg) => arg.startsWith('Edit'))).toBe(false)

    const fix = agentCommand({ ...options, agent: 'claude', mode: 'fix' })
    expect(fix.args).toContain('Edit(./src/**)')
    expect(fix.args).not.toContain('Edit')
  })

  it('runs Codex without user config or rules and without temp-dir write access', () => {
    const codex = agentCommand({ ...options, agent: 'codex', mode: 'diagnose' })
    expect(codex.args).toEqual(
      expect.arrayContaining([
        '--ignore-user-config',
        '--ignore-rules',
        'sandbox_workspace_write.exclude_tmpdir_env_var=true',
        'sandbox_workspace_write.exclude_slash_tmp=true',
      ]),
    )
    expect(codex.env.PATH?.startsWith('/tmp/trial/node_modules/.bin:')).toBe(true)
  })
})
