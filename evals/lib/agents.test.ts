import { describe, expect, it } from 'vitest'
import {
  agentCommand,
  agentEnv,
  agentStateDirs,
  claudeBashRules,
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
  appOrigin: 'http://127.0.0.1:5173',
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

  it('allows writes only to src, and only in fix mode', () => {
    const diagnose = claudeSandboxSettings({ ...base, mode: 'diagnose' }).sandbox.filesystem
    expect(diagnose.allowWrite).toEqual([])
    const fix = claudeSandboxSettings({ ...base, mode: 'fix' }).sandbox.filesystem
    expect(fix.allowWrite).toEqual(['/tmp/trial/src'])
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
        '/tmp/trial/.genie',
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

describe('agentStateDirs', () => {
  it('covers whole agent config dirs and follows CLAUDE_CONFIG_DIR and CODEX_HOME', () => {
    expect(agentStateDirs({}, '/home/me')).toEqual([
      '/home/me/.claude',
      '/home/me/.claude.json',
      '/home/me/.codex',
    ])
    expect(agentStateDirs({ CLAUDE_CONFIG_DIR: '/cfg', CODEX_HOME: '/cx' }, '/home/me')).toEqual([
      '/cfg',
      '/home/me/.claude.json',
      '/cx',
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

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

function matchesRule(command: string, rule: string) {
  const pattern = rule.split('*').map(escapeRegExp).join('.*')
  const bare = rule.endsWith(' *') ? `|${escapeRegExp(rule.slice(0, -2))}` : ''
  return new RegExp(`^(?:${pattern}${bare})$`, 's').test(command)
}

describe('claudeBashRules', () => {
  const { allow, deny } = claudeBashRules('http://127.0.0.1:5173')
  const permitted = (command: string) =>
    allow.some((rule) => matchesRule(command, rule)) &&
    !deny.some((rule) => matchesRule(command, rule))

  it.each([
    'genie-react status',
    'genie-react tools',
    "genie-react call react_get_renders '{}'",
    'genie-react call react_get_renders {} --max-bytes 9000',
    'pnpm exec genie-react doctor',
    `genie-react batch '[{"tool":"react_error_state"}]'`,
    'pnpm exec genie-react status --sessions-only',
    "npx genie-react call react_render_causes '{}'",
    'agent-browser open http://127.0.0.1:5173/?screen=search',
    "agent-browser open 'http://127.0.0.1:5173/?screen=search'",
    'agent-browser open "http://127.0.0.1:5173/"',
    'agent-browser snapshot',
    'agent-browser snapshot -i',
    'agent-browser click @e3',
    'agent-browser type "#q" cert',
    'agent-browser get url',
    'agent-browser react tree',
    'agent-browser wait 500',
    'agent-browser screenshot',
    'cat src/App.tsx',
    'grep -rn useMemo src',
    'jq .status out.json',
    'ls src',
  ])('allows %s', (command) => {
    expect(permitted(command)).toBe(true)
  })

  it.each([
    'genie-react init --yes',
    'genie-react link /repo',
    'genie-react hub',
    'genie-react --max-bytes 9000 init --yes',
    'genie-react capture export abc --output vite.config.ts --force',
    "genie-react call react_get_renders '{}' --url ws://127.0.0.1:4301",
    'genie-react --url ws://127.0.0.1:4301 status',
    'npx vite build',
    'npx -p evil genie-react status',
    'pnpm exec vite --config /tmp/evil.mjs',
    'pnpm genie-react status',
    'agent-browser open http://localhost:4301/',
    'agent-browser open http://127.0.0.1:51730/',
    'agent-browser open http://127.0.0.1:5173@localhost:4301/',
    'agent-browser open file:///etc/hosts',
    'agent-browser eval "fetch(\'/@fs/etc/hosts\')"',
    'agent-browser tab new http://localhost:4301/',
    'agent-browser read http://127.0.0.1:5173/@fs/etc/hosts',
    'agent-browser screenshot /Users/me/.zshrc',
    'agent-browser pdf vite.config.ts',
    'agent-browser download a ./vite.config.ts',
    'agent-browser upload input /etc/hosts',
    'agent-browser batch "get url"',
    'agent-browser plugin add evil',
    'agent-browser connect 9222',
    'agent-browser --session other get url',
    'agent-browser get url --executable-path /bin/sh',
    'agent-browser click @e1 --allow-file-access',
    'agent-browser wait --fn "fetch(1)"',
    'agent-browser wait --download ./vite.config.ts',
    'agent-browser snapshot --screenshot-dir /Users/me',
    'agent-browser -p browserbase snapshot -i',
    'sort -o vite.config.ts src/a.ts',
    'find . -delete',
    "sed -i '' s/a/b/ vite.config.ts",
    'awk \'BEGIN { system("id") }\'',
    'xargs rm',
    'env FOO=1 genie-react status',
    "node -e 'process.exit()'",
    'git -c core.pager=sh log',
    'tee vite.config.ts',
    'cp src/a.ts vite.config.ts',
    'mv src/a.ts vite.config.ts',
  ])('denies %s', (command) => {
    expect(permitted(command)).toBe(false)
  })
})
