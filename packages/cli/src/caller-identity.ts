import { createHash } from 'node:crypto'
import { lstatSync, realpathSync } from 'node:fs'
import { join } from 'node:path'
import { ancestorDirectories, BridgeConfigError } from './discovery'

export const CALLER_ENV = 'GENIE_AGENT'

/** Session IDs coding-agent harnesses export to the commands they run; each run, and so each agent, has its own. */
const HARNESS_SESSIONS = [
  { source: 'claude-code', variable: 'CLAUDE_CODE_SESSION_ID' },
  { source: 'codex', variable: 'CODEX_THREAD_ID' },
] as const

const AGENT_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

export type CallerSource = 'env' | (typeof HARNESS_SESSIONS)[number]['source'] | 'worktree'

export interface CallerIdentity {
  /** Absent when nothing identifies the caller; the hub then treats it like every other caller without one. */
  id?: string
  source?: CallerSource
}

/** The identity every CLI process of one agent shares: `GENIE_AGENT`, else the harness session, else the git worktree. Harness and worktree values are hashed, so the hub and other agents never see them. */
export function resolveCallerIdentity(
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
): CallerIdentity {
  const named = env[CALLER_ENV]
  if (named !== undefined && named !== '') {
    if (!AGENT_NAME.test(named)) {
      throw new BridgeConfigError(
        `${CALLER_ENV} must be 1 to 64 letters, digits, ".", "_" or "-", starting with a letter or digit.`,
      )
    }
    return { id: `agent:${named}`, source: 'env' }
  }
  for (const { source, variable } of HARNESS_SESSIONS) {
    const value = env[variable]
    if (value) return { id: `${source}:${digest(value)}`, source }
  }
  const worktree = worktreeRoot(cwd)
  return worktree === null ? {} : { id: `worktree:${digest(worktree)}`, source: 'worktree' }
}

/** The nearest directory with a `.git` entry: a directory in a main checkout, a file in a linked worktree or submodule. */
export function worktreeRoot(cwd: string): string | null {
  for (const directory of ancestorDirectories(cwd)) {
    try {
      lstatSync(join(directory, '.git'))
      return realpathSync(directory)
    } catch {
      // No .git here; keep walking up.
    }
  }
  return null
}

function digest(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 16)
}
