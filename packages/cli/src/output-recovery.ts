import { lstatSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import {
  ensurePrivateDirectory,
  genieUserDirectory,
  isOwnedByCurrentUser,
} from 'genie-react/hub/token'
import { genieCommand } from './package-manager'
import type { OutputSuggestion, Overflow, OverflowRecovery } from './result-selection'

const RETAINED_SPILLS = 20
const MAX_SUGGESTED_BYTES = 50_000_000
const MIN_SUGGESTED_BRANCH_BYTES = 1_024
const MAX_SUGGESTED_PATH_LENGTH = 200
const PRIVATE_FILE_MODE = 0o600
const SPILL_NAME = /^[a-zA-Z0-9_.-]{1,80}-\d{13}-\d+\.json$/

export interface CallInvocation {
  /** CLI words before the tool arguments, e.g. `['call', 'react_get_renders']`. */
  command: string[]
  args?: Record<string, unknown>
  /** Flags that must survive into every suggested retry, such as `--session`. */
  flags: string[]
  /** The caller's own `--select`; its envelope paths cannot be re-selected from the original result. */
  select?: string
  /** The caller's explicit `--max-bytes`; retries keep it so they run under the cap they were sized for. */
  maxBytes?: number
}

/** Keep the complete oversized result in a private per-user directory (Playwright CLI style) and point the agent at narrower retries. */
export function recoverOverflow(
  overflow: Overflow,
  invocation: CallInvocation,
  { label, maxBytes }: { label: string; maxBytes: number },
): OverflowRecovery {
  return {
    outputPath: spillOutput(label, overflow.serialized),
    suggestions: overflowSuggestions(overflow, invocation, maxBytes),
  }
}

/** Retry suggestions; app-derived paths appear only as quoted argv values, never in the `reason` text. */
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
  const selectable = invocation.select === undefined
  const branchIndex = selectable
    ? overflow.largestPaths.findIndex(
        ({ path, bytes }) =>
          bytes >= MIN_SUGGESTED_BRANCH_BYTES &&
          bytes < maxBytes &&
          path.length <= MAX_SUGGESTED_PATH_LENGTH,
      )
    : -1
  const branch = overflow.largestPaths[branchIndex]
  if (branch) {
    suggestions.push(
      suggestion(
        invocation,
        `Read only the largest selectable branch (largestPaths[${branchIndex}]).`,
        args,
        { select: branch.path },
      ),
    )
  }
  const heaviest = overflow.largestPaths[0]
  if (
    selectable &&
    heaviest !== branch &&
    heaviest?.items !== undefined &&
    heaviest.items > 0 &&
    heaviest.path.length <= MAX_SUGGESTED_PATH_LENGTH
  ) {
    suggestions.push(
      suggestion(
        invocation,
        'Inspect the first item of the largest array (largestPaths[0]).',
        args,
        {
          select: `${heaviest.path}/0`,
        },
      ),
    )
  }
  if (overflow.originalBytes <= MAX_SUGGESTED_BYTES) {
    suggestions.push(
      suggestion(invocation, 'Accept the complete result on stdout.', args, {
        maxBytes: overflow.originalBytes,
      }),
    )
  }
  return suggestions
}

function suggestion(
  invocation: CallInvocation,
  reason: string,
  args: Record<string, unknown> | undefined,
  overrides: { select?: string; maxBytes?: number } = {},
): OutputSuggestion {
  const select = overrides.select ?? invocation.select
  const maxBytes = overrides.maxBytes ?? invocation.maxBytes
  return {
    reason,
    ...genieCommand([
      ...invocation.command,
      ...(args === undefined ? [] : [JSON.stringify(args)]),
      ...invocation.flags,
      ...(select === undefined ? [] : ['--select', select]),
      ...(maxBytes === undefined ? [] : ['--max-bytes', String(maxBytes)]),
    ]),
  }
}

/** `out` inside the per-user directory that also holds the hub's agent tokens: never inside a project a dev server may serve. */
export function spillDirectory(): string {
  return join(genieUserDirectory(), 'out')
}

function spillOutput(label: string, serialized: string): string | undefined {
  const directory = spillDirectory()
  const safeLabel = label.replace(/[^a-zA-Z0-9_.-]+/g, '-').slice(0, 80)
  const path = join(directory, `${safeLabel}-${Date.now()}-${process.pid}.json`)
  try {
    ensurePrivateDirectory(dirname(directory))
    ensurePrivateDirectory(directory)
    writeFileSync(path, `${serialized}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: PRIVATE_FILE_MODE,
    })
  } catch {
    return undefined
  }
  pruneSpills(directory)
  return path
}

/** Removes only our own regular spill files beyond the newest few; anything else in the directory is left alone. */
function pruneSpills(directory: string): void {
  let names: string[]
  try {
    names = readdirSync(directory).filter((name) => SPILL_NAME.test(name))
  } catch {
    return
  }
  const spills = names.flatMap((name) => {
    const path = join(directory, name)
    try {
      const info = lstatSync(path)
      return info.isFile() && isOwnedByCurrentUser(info.uid)
        ? [{ path, modified: info.mtimeMs }]
        : []
    } catch {
      return []
    }
  })
  spills.sort((left, right) => right.modified - left.modified)
  for (const stale of spills.slice(RETAINED_SPILLS)) {
    try {
      rmSync(stale.path)
    } catch {}
  }
}
