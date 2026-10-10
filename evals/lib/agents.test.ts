import { describe, expect, it } from 'vitest'
import { agentCommand, agentEnv, claudeSandboxSettings } from './agents.mjs'

const options = {
  executable: '/opt/bin/claude',
  dir: '/tmp/trial',
  model: 'sonnet',
  maxTurns: 10,
  maxBudgetUsd: 1,
  browserSession: 'genie-eval-run-task-1',
  toolDirs: ['/opt/node/bin', '/opt/tools/bin', '/opt/node/bin'],
  settingsPath: '/repo/evals/results/run/task-1.settings.json',
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
  it('confines writes to the trial and denies reads of the repo and temp roots', () => {
    expect(
      claudeSandboxSettings({
        dir: '/tmp/trial',
        readableRoots: ['/tmp/deps'],
        deniedReadRoots: ['/repo', '/tmp'],
        browserSocketDir: '/home/me/.agent-browser',
      }),
    ).toEqual({
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        autoAllowBashIfSandboxed: false,
        filesystem: {
          allowWrite: ['/tmp/trial'],
          denyRead: ['/repo', '/tmp'],
          allowRead: ['/tmp/trial', '/tmp/deps'],
        },
        network: {
          allowedDomains: ['localhost', '127.0.0.1'],
          allowLocalBinding: true,
          allowUnixSockets: ['/home/me/.agent-browser'],
        },
      },
    })
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
