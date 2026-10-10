import { delimiter, isAbsolute, join, relative, sep } from 'node:path'

export const AGENTS = /** @type {const} */ (['claude', 'codex'])

const GENIE_LAUNCHERS = ['genie-react', 'pnpm exec genie-react', 'npx genie-react']
const GENIE_SUBCOMMANDS = ['status', 'tools', 'call', 'batch', 'doctor']
const SHELL_HELPERS = ['sleep', 'echo', 'cat', 'head', 'tail', 'grep', 'jq', 'wc', 'ls']
const BROWSER_COMMANDS = [
  'snapshot',
  'click',
  'dblclick',
  'type',
  'fill',
  'press',
  'keyboard',
  'hover',
  'focus',
  'check',
  'uncheck',
  'select',
  'drag',
  'scroll',
  'scrollintoview',
  'wait',
  'get',
  'is',
  'find',
  'mouse',
  'react',
]
const BROWSER_BARE_COMMANDS = [
  'snapshot',
  'back',
  'forward',
  'reload',
  'console',
  'errors',
  'screenshot',
]
const BROWSER_DENIED_FLAGS = [
  '--session',
  '--namespace',
  '--profile',
  '--restore',
  '--state',
  '--auto-connect',
  '--cdp',
  '--provider',
  '--executable-path',
  '--extension',
  '--init-script',
  '--enable',
  '--args',
  '--user-agent',
  '--proxy',
  '--ignore-https-errors',
  '--ca-cert',
  '--allow-file-access',
  '--allowed-domains',
  '--action-policy',
  '--headers',
  '--headed',
  '--engine',
  '--config',
  '--download',
  '--screenshot-dir',
  '--fn',
]
const PROTECTED_PATHS = [
  'vite.config.ts',
  'vite.config.js',
  'vite.config.mjs',
  'vite.config.mts',
  'package.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'index.html',
  '.git',
  '.claude',
  '.agents',
  'node_modules',
  '.genie',
]
const SYSTEM_PATH = ['/usr/bin', '/bin', '/usr/sbin', '/sbin']
const INHERITED_ENV = new Set([
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TERM',
  'HTTPS_PROXY',
  'HTTP_PROXY',
  'NO_PROXY',
  'NODE_EXTRA_CA_CERTS',
  'SSL_CERT_FILE',
  'CLAUDE_CONFIG_DIR',
  'CLAUDE_CODE_OAUTH_TOKEN',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CODEX_HOME',
  'OPENAI_API_KEY',
  'OPENAI_BASE_URL',
])
const INHERITED_ENV_PREFIXES = ['ANTHROPIC_']

/**
 * @typedef {'claude' | 'codex'} AgentName
 * @typedef {{
 *   agent: AgentName,
 *   executable: string,
 *   mode: 'diagnose' | 'fix',
 *   dir: string,
 *   model: string | undefined,
 *   maxTurns: number,
 *   maxBudgetUsd: number,
 *   browserSession: string,
 *   toolDirs: string[],
 *   settingsPath: string,
 *   appOrigin: string,
 *   readableRoots: string[],
 *   deniedReadRoots: string[],
 * }} AgentRunOptions
 * @typedef {{ command: string, args: string[], env: NodeJS.ProcessEnv }} AgentCommand
 */

/**
 * @param {string} path
 * @param {string} root
 */
function isWithin(path, root) {
  const offset = relative(root, path)
  return offset !== '..' && !offset.startsWith(`..${sep}`) && !isAbsolute(offset)
}

/**
 * Drops directories inside any of `roots`, so a PATH entry such as the repo's `node_modules/.bin` never reaches the agent.
 * @param {string[]} dirs
 * @param {string[]} roots
 */
export function outsideRoots(dirs, roots) {
  return dirs.filter((dir) => !roots.some((root) => isWithin(dir, root)))
}

/**
 * Where Claude and Codex keep transcripts, file snapshots, and prompt history, which can hold earlier trials' answers.
 * @param {NodeJS.ProcessEnv} env
 * @param {string} home
 */
export function agentStateDirs(env, home) {
  return [
    env.CLAUDE_CONFIG_DIR ?? join(home, '.claude'),
    join(home, '.claude.json'),
    env.CODEX_HOME ?? join(home, '.codex'),
  ]
}

/**
 * Builds the agent environment from an allowlist so nothing names the repository: auth and locale pass through,
 * PATH holds only the trial's bins, the required tool directories, and system directories.
 * The skill suggests `pnpm exec`; disabling pnpm's pre-run install (npm_ prefix for pnpm 10, pnpm_ for 11+) keeps it off the linked node_modules.
 * @param {NodeJS.ProcessEnv} source
 * @param {{ dir: string, browserSession: string, toolDirs: string[] }} options
 * @returns {NodeJS.ProcessEnv}
 */
export function agentEnv(source, { dir, browserSession, toolDirs }) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {}
  for (const [key, value] of Object.entries(source)) {
    if (INHERITED_ENV.has(key) || INHERITED_ENV_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      env[key] = value
    }
  }
  const path = [join(dir, 'node_modules/.bin'), ...toolDirs, ...SYSTEM_PATH]
  return {
    ...env,
    PATH: [...new Set(path)].join(delimiter),
    AGENT_BROWSER_SESSION: browserSession,
    AGENT_BROWSER_ALLOWED_DOMAINS: '127.0.0.1,localhost',
    npm_config_verify_deps_before_run: 'false',
    pnpm_config_verify_deps_before_run: 'false',
  }
}

/**
 * Claude Code settings that run every Bash command in the OS sandbox, network limited to the local dev server and
 * the agent-browser daemon socket, and no reads of the repository or sibling temp directories.
 * Writes are limited to `src/` in fix mode and never reach files the unsandboxed harness executes or trusts (Vite
 * config, manifests, git metadata, or `.genie/bridge.json`, which the harness's own Genie calls use).
 * Bash still needs an allow rule, so commands outside the allowlist are denied and counted.
 * @param {{ dir: string, mode: 'diagnose' | 'fix', readableRoots: string[], deniedReadRoots: string[], browserSocketDir: string }} options
 */
export function claudeSandboxSettings({
  dir,
  mode,
  readableRoots,
  deniedReadRoots,
  browserSocketDir,
}) {
  const writable = mode === 'fix' ? ['src'] : []
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      autoAllowBashIfSandboxed: false,
      filesystem: {
        allowWrite: writable.map((path) => join(dir, path)),
        denyWrite: PROTECTED_PATHS.map((path) => join(dir, path)),
        denyRead: deniedReadRoots,
        allowRead: [dir, ...readableRoots],
      },
      network: {
        allowedDomains: ['localhost', '127.0.0.1'],
        allowLocalBinding: true,
        allowUnixSockets: [browserSocketDir],
      },
    },
  }
}

/**
 * Bash permission rules for Claude. Each allowed command is a fixed subcommand: Genie's read-only `status`, `tools`,
 * `call`, `batch`, and `doctor` without `--url` (flags go after the subcommand), page-level agent-browser commands,
 * `open` only for the trial's own origin, and read-only shell helpers. The agent-browser daemon runs outside the
 * sandbox, so flags that switch sessions, relaunch the browser, evaluate script, or save files are denied wherever
 * they appear. Claude splits compound commands and checks each part.
 * @param {string} appOrigin
 */
export function claudeBashRules(appOrigin) {
  const opens = ['', "'", '"'].flatMap((quote) => [
    `agent-browser open ${quote}${appOrigin}/*`,
    `agent-browser open ${quote}${appOrigin}${quote}`,
  ])
  const allow = [
    ...GENIE_LAUNCHERS.flatMap((launcher) =>
      GENIE_SUBCOMMANDS.flatMap((subcommand) => [
        `${launcher} ${subcommand}`,
        `${launcher} ${subcommand} *`,
      ]),
    ),
    ...opens,
    ...BROWSER_COMMANDS.map((command) => `agent-browser ${command} *`),
    ...BROWSER_BARE_COMMANDS.map((command) => `agent-browser ${command}`),
    ...SHELL_HELPERS.map((command) => `${command} *`),
  ]
  const deny = [
    ...GENIE_LAUNCHERS.map((launcher) => `${launcher} *--url*`),
    ...BROWSER_DENIED_FLAGS.map((flag) => `agent-browser *${flag}*`),
    'agent-browser * -p *',
  ]
  return { allow, deny }
}

/**
 * Restricts Claude to the Bash rules above and file tools scoped to the trial directory and the shared install.
 * Read rules also govern Grep and Glob; the prompt is sent on stdin.
 * @param {AgentRunOptions} options
 * @returns {AgentCommand}
 */
function claudeCommand(options) {
  const fileTools =
    options.mode === 'fix' ? ['Read', 'Edit', 'Grep', 'Glob'] : ['Read', 'Grep', 'Glob']
  const bash = claudeBashRules(options.appOrigin)
  const allowed = [
    ...bash.allow.map((rule) => `Bash(${rule})`),
    'Read(./**)',
    ...options.readableRoots.map((root) => `Read(/${root}/**)`),
    ...(options.mode === 'fix' ? ['Edit(./src/**)'] : []),
    'Skill',
  ]
  return {
    command: options.executable,
    args: [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      ...(options.model ? ['--model', options.model] : []),
      '--max-turns',
      String(options.maxTurns),
      '--max-budget-usd',
      String(options.maxBudgetUsd),
      '--permission-mode',
      'dontAsk',
      '--setting-sources',
      'project',
      '--settings',
      options.settingsPath,
      '--strict-mcp-config',
      '--no-session-persistence',
      '--tools',
      ['Bash', ...fileTools, 'Skill'].join(','),
      '--allowedTools',
      ...allowed,
      '--disallowedTools',
      ...options.deniedReadRoots.map((root) => `Read(/${root}/**)`),
      ...bash.deny.map((rule) => `Bash(${rule})`),
    ],
    env: agentEnv(process.env, options),
  }
}

/**
 * Codex has no per-command allowlist and its sandbox cannot restrict reads, so results are labelled unsandboxed;
 * the sandbox bounds writes to the trial and the grader flags edits in diagnose mode.
 * @param {AgentRunOptions} options
 * @returns {AgentCommand}
 */
function codexCommand(options) {
  return {
    command: options.executable,
    args: [
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '--ignore-user-config',
      '--ignore-rules',
      '-C',
      options.dir,
      '-s',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
      '-c',
      'sandbox_workspace_write.exclude_tmpdir_env_var=true',
      '-c',
      'sandbox_workspace_write.exclude_slash_tmp=true',
      ...(options.model ? ['-m', options.model] : []),
      '-',
    ],
    env: agentEnv(process.env, options),
  }
}

/**
 * @param {AgentName} agent
 */
export function isolationLabel(agent) {
  return agent === 'claude' ? 'sandboxed reads and writes' : 'reads not sandboxed'
}

/**
 * @param {AgentRunOptions} options
 * @returns {AgentCommand}
 */
export function agentCommand(options) {
  return options.agent === 'codex' ? codexCommand(options) : claudeCommand(options)
}

/**
 * @param {{ prompt: string, mode: 'diagnose' | 'fix' }} task
 * @param {string} url
 */
export function buildPrompt(task, url) {
  const instructions =
    task.mode === 'fix'
      ? 'Fix the bug with the smallest correct source change, then confirm the fix in the running app.'
      : 'Do not modify any files.'
  return `${task.prompt}

The app is already running at ${url} (Vite dev server with hot reload). Start by opening that URL with \`agent-browser open\`; the session is already selected. Investigate it at runtime: use the \`genie-react\` CLI for React and TanStack Query introspection (the genie skill explains it) and \`agent-browser\` to drive the page. Both are on PATH. ${instructions}

End your final message with a fenced json block in exactly this shape:
\`\`\`json
{"component": "<React component that misbehaves>", "cause": "<one-sentence root cause>", "file": "<project-relative path of the file that needs the fix>"}
\`\`\`
`
}
