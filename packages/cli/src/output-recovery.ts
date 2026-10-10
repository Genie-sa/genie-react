import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { OutputSuggestion, Overflow, OverflowRecovery } from './result-selection'

export const SPILL_DIRECTORY = '.genie/out'
const RETAINED_SPILLS = 20
const MAX_SUGGESTED_BYTES = 50_000_000
const MIN_SUGGESTED_BRANCH_BYTES = 1_024

export interface CallInvocation {
  /** CLI words before the tool arguments, e.g. `['call', 'react_get_renders']`. */
  command: string[]
  args?: Record<string, unknown>
  /** Flags that must survive into every suggested retry, such as `--session`. */
  flags: string[]
  /** The caller's own `--select`; its envelope paths cannot be re-selected from the original result. */
  select?: string
}

/** Keep the complete oversized result on disk (Playwright CLI style) and point the agent at narrower retries. */
export function recoverOverflow(
  overflow: Overflow,
  invocation: CallInvocation,
  { cwd, label, maxBytes }: { cwd: string; label: string; maxBytes: number },
): OverflowRecovery {
  return {
    outputPath: spillOutput(cwd, label, overflow.serialized),
    suggestions: overflowSuggestions(overflow, invocation, maxBytes),
  }
}

export function overflowSuggestions(
  overflow: Overflow,
  invocation: CallInvocation,
  maxBytes: number,
): OutputSuggestion[] {
  const suggestions: OutputSuggestion[] = []
  const args = invocation.args
  if (args?.view === 'full') {
    suggestions.push(
      suggestion(invocation, 'Request the bounded summary view.', { ...args, view: 'summary' }),
    )
  }
  if (args && typeof args.limit === 'number' && args.limit > 1) {
    const limit = Math.max(1, Math.floor((args.limit * maxBytes * 0.8) / overflow.originalBytes))
    if (limit < args.limit) {
      suggestions.push(
        suggestion(invocation, `Request at most ${limit} records.`, { ...args, limit }),
      )
    }
  }
  const branch =
    invocation.select === undefined
      ? overflow.largestPaths.find(
          (path) => path.bytes >= MIN_SUGGESTED_BRANCH_BYTES && path.bytes < maxBytes,
        )
      : undefined
  if (branch) {
    suggestions.push(
      suggestion(invocation, `Read only ${branch.path} (${branch.bytes} bytes).`, args, [
        '--select',
        branch.path,
      ]),
    )
  }
  const heaviest = overflow.largestPaths[0]
  if (
    invocation.select === undefined &&
    heaviest?.items !== undefined &&
    heaviest.items > 0 &&
    heaviest !== branch
  ) {
    suggestions.push(
      suggestion(invocation, `Inspect one item of ${heaviest.path}.`, args, [
        '--select',
        `${heaviest.path}/0`,
      ]),
    )
  }
  if (overflow.originalBytes <= MAX_SUGGESTED_BYTES) {
    suggestions.push(
      suggestion(invocation, 'Accept the complete result on stdout.', args, [
        '--max-bytes',
        String(overflow.originalBytes),
      ]),
    )
  }
  return suggestions
}

function suggestion(
  invocation: CallInvocation,
  reason: string,
  args: Record<string, unknown> | undefined,
  extraFlags: string[] = [],
): OutputSuggestion {
  const argv = [
    'genie-react',
    ...invocation.command,
    ...(args === undefined ? [] : [JSON.stringify(args)]),
    ...invocation.flags,
    ...(invocation.select === undefined ? [] : ['--select', invocation.select]),
    ...extraFlags,
  ]
  return { reason, argv, command: argv.map(shellQuote).join(' ') }
}

function spillOutput(cwd: string, label: string, serialized: string): string | undefined {
  const directory = join(cwd, SPILL_DIRECTORY)
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 80)
  const path = join(directory, `${safeLabel}-${Date.now()}-${process.pid}.json`)
  try {
    mkdirSync(directory, { recursive: true, mode: 0o700 })
    writeFileSync(path, `${serialized}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    pruneSpills(directory)
    return path
  } catch {
    return undefined
  }
}

function pruneSpills(directory: string): void {
  const spills = readdirSync(directory)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({
      path: join(directory, name),
      modified: statSync(join(directory, name)).mtimeMs,
    }))
    .sort((left, right) => right.modified - left.modified)
  for (const stale of spills.slice(RETAINED_SPILLS)) rmSync(stale.path, { force: true })
}

export function shellQuote(value: string): string {
  if (/^[a-zA-Z0-9_./:-]+$/.test(value)) return value
  return `'${value.replaceAll("'", `'\\''`)}'`
}
