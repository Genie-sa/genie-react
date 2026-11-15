import { newId, type ToolOutput } from '../../protocol'
import { sourceNameOf } from './component-name'
import type { NodeId, reactFindComponentsContract } from './contracts'
import { findAllRootFibers, findByName, findFiberById, matchDetail } from './fiber'
import {
  classifyFibersWithinBudget,
  type FiberClassification,
  isHiddenByAppOnly,
  ownershipCoverage,
} from './source'

type FindComponentsOutput = ToolOutput<typeof reactFindComponentsContract>

export interface FindComponentsQuery {
  component?: string
  query?: string
  exact: boolean
  limit: number
  appOnly: boolean
  cursor?: string
}

interface FrozenMatch {
  id: NodeId
  name: string
  path: string
  classification: FiberClassification
}

interface SearchSnapshot {
  expiresAt: number
  matches: FrozenMatch[]
  ownershipCoverage: FindComponentsOutput['ownershipCoverage']
  scanTruncated: boolean
}

const SCAN_LIMIT = 5000
const SNAPSHOT_LIMIT = 3
const SNAPSHOT_TTL_MS = 5 * 60_000
const UNCLASSIFIED: FiberClassification = { source: null, ownership: 'unknown', isLibrary: false }
const CURSOR_PATTERN = /^([0-9a-f-]{36}):([1-9][0-9]*)$/

const snapshots = new Map<string, SearchSnapshot>()

/** Search every live root by display name. A result with more matches than `limit` freezes the match order behind `nextCursor`, so later pages neither repeat nor skip a match, and a match that unmounted in between is counted instead of returned. */
export async function findComponents(query: FindComponentsQuery): Promise<FindComponentsOutput> {
  for (const [id, snapshot] of snapshots) {
    if (snapshot.expiresAt <= Date.now()) snapshots.delete(id)
  }
  if (query.cursor) return continueSearch(query.cursor, query.limit)

  const found = findAllRootFibers().flatMap((root) =>
    findByName(root, query.component ?? query.query ?? '', query.exact, SCAN_LIMIT + 1),
  )
  const scanTruncated = found.length > SCAN_LIMIT
  found.length = Math.min(found.length, SCAN_LIMIT)
  const { classes } = await classifyFibersWithinBudget(found.map(({ fiber }) => fiber))
  const matches = found.flatMap(({ id, name, path }, index) => {
    const classification = classes[index] ?? UNCLASSIFIED
    if (query.appOnly && isHiddenByAppOnly(classification.ownership)) return []
    return [{ id, name, path, classification }]
  })
  const snapshot: SearchSnapshot = {
    expiresAt: Date.now() + SNAPSHOT_TTL_MS,
    matches,
    ownershipCoverage: ownershipCoverage(classes.map((entry) => entry.ownership)),
    scanTruncated,
  }
  let snapshotId: string | null = null
  if (matches.length > query.limit) {
    snapshotId = newId()
    snapshots.set(snapshotId, snapshot)
    const oldest = snapshots.keys().next().value
    if (snapshots.size > SNAPSHOT_LIMIT && oldest !== undefined) snapshots.delete(oldest)
  }
  return page(snapshotId, snapshot, 0, query.limit)
}

function continueSearch(cursor: string, limit: number): FindComponentsOutput {
  const parsed = CURSOR_PATTERN.exec(cursor)
  const snapshotId = parsed?.[1]
  const snapshot = snapshotId ? snapshots.get(snapshotId) : undefined
  const offset = Number(parsed?.[2])
  if (!snapshotId || !snapshot || !Number.isSafeInteger(offset)) {
    throw new Error(
      'Component search cursor is invalid, expired, or evicted. Run react_find_components without cursor to start a fresh search.',
    )
  }
  return page(snapshotId, snapshot, offset, limit)
}

function page(
  snapshotId: string | null,
  snapshot: SearchSnapshot,
  offset: number,
  limit: number,
): FindComponentsOutput {
  const roots = findAllRootFibers()
  const primary = roots[0] ?? null
  const matches: FindComponentsOutput['matches'] = []
  let unmountedSinceSearch = 0
  let next = offset
  while (next < snapshot.matches.length && matches.length < limit) {
    const match = snapshot.matches[next] as FrozenMatch
    next += 1
    const fiber = primary ? findFiberById(primary, match.id) : null
    if (!fiber) {
      unmountedSinceSearch += 1
      continue
    }
    const { kind, props } = matchDetail(fiber, 1)
    const { source, isLibrary } = match.classification
    const sourceName = sourceNameOf(match.name)
    matches.push({
      id: match.id,
      name: match.name,
      ...(sourceName === undefined ? {} : { sourceName }),
      path: match.path,
      kind,
      props,
      source,
      isLibrary,
    })
  }
  const remaining = snapshot.matches.length - next
  return {
    matches,
    ownershipCoverage: snapshot.ownershipCoverage,
    omittedByLimit: remaining,
    scanTruncated: snapshot.scanTruncated,
    nextCursor: snapshotId && remaining > 0 ? `${snapshotId}:${next}` : null,
    unmountedSinceSearch,
  }
}
