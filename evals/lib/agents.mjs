import { join } from 'node:path'

export const AGENTS = /** @type {const} */ (['claude', 'codex'])

const GENIE_COMMANDS = ['genie-react', 'pnpm exec genie-react', 'npx genie-react']
const SHELL_HELPERS = [
  'cd',
  'export',
  'sleep',
  'echo',
  'cat',
  'head',
  'tail',
  'grep',
  'jq',
  'wc',
  'sort',
  'ls',
]

/**
 * @typedef {'claude' | 'codex'} AgentName
 * @typedef {{
 *   agent: AgentName,
 *   mode: 'diagnose' | 'fix',
 *   dir: string,
 *   model: string | undefined,
 *   maxTurns: number,
 *   maxBudgetUsd: number,
 *   browserSession: string,
 *   hiddenPaths: string[],
 * }} AgentRunOptions
 * @typedef {{ command: string, args: string[], env: NodeJS.ProcessEnv }} AgentCommand
 */

/**
 * Builds the agent environment: local bins on PATH, an isolated browser session, and no inherited nesting markers.
 * The skill suggests `pnpm exec`; disabling pnpm's pre-run install (npm_ prefix for pnpm 10, pnpm_ for 11+) keeps it off the linked node_modules.
 * @param {AgentRunOptions} options
 * @returns {NodeJS.ProcessEnv}
 */
function agentEnv({ dir, browserSession }) {
  /** @type {NodeJS.ProcessEnv} */
  const env = {
    ...process.env,
    PATH: `${join(dir, 'node_modules/.bin')}:${process.env.PATH ?? ''}`,
    AGENT_BROWSER_SESSION: browserSession,
    AGENT_BROWSER_ALLOWED_DOMAINS: '127.0.0.1,localhost',
    npm_config_verify_deps_before_run: 'false',
    pnpm_config_verify_deps_before_run: 'false',
  }
  for (const key of ['CLAUDECODE', 'CLAUDE_CODE_ENTRYPOINT', 'GENIE_SESSION', 'GENIE_BRIDGE_URL']) {
    delete env[key]
  }
  return env
}

/**
 * Restricts Claude to the Genie CLI, agent-browser, and file tools; the prompt is sent on stdin.
 * @param {AgentRunOptions} options
 * @returns {AgentCommand}
 */
function claudeCommand(options) {
  const fileTools =
    options.mode === 'fix' ? ['Read', 'Edit', 'Grep', 'Glob'] : ['Read', 'Grep', 'Glob']
  const allowed = [
    ...GENIE_COMMANDS.map((command) => `Bash(${command} *)`),
    'Bash(agent-browser *)',
    ...SHELL_HELPERS.map((command) => `Bash(${command} *)`),
    ...fileTools,
    'Skill',
  ]
  return {
    command: 'claude',
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
      '--strict-mcp-config',
      '--no-session-persistence',
      '--tools',
      ['Bash', ...fileTools, 'Skill'].join(','),
      '--allowedTools',
      ...allowed,
      '--disallowedTools',
      ...options.hiddenPaths.map((path) => `Read(/${path}/**)`),
    ],
    env: agentEnv(options),
  }
}

/**
 * Codex has no per-command allowlist, so the sandbox bounds writes and the grader flags edits in diagnose mode.
 * @param {AgentRunOptions} options
 * @returns {AgentCommand}
 */
function codexCommand(options) {
  return {
    command: 'codex',
    args: [
      'exec',
      '--json',
      '--ephemeral',
      '--skip-git-repo-check',
      '-C',
      options.dir,
      '-s',
      'workspace-write',
      '-c',
      'sandbox_workspace_write.network_access=true',
      ...(options.model ? ['-m', options.model] : []),
      '-',
    ],
    env: agentEnv(options),
  }
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

The app is already running at ${url} (Vite dev server with hot reload). Investigate it at runtime: use the \`genie-react\` CLI for React and TanStack Query introspection (the genie skill explains it) and \`agent-browser\` to drive the page. Both are on PATH. ${instructions}

End your final message with a fenced json block in exactly this shape:
\`\`\`json
{"component": "<React component that misbehaves>", "cause": "<one-sentence root cause>", "file": "<project-relative path of the file that needs the fix>"}
\`\`\`
`
}
