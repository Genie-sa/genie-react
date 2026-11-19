import type { VerifyTarget } from '../../protocol'
import type { CohortRecord, InstanceRecord, TargetEvidence } from './evidence'
import { type Refusal, refuse } from './outcome'

export function sourceMatches(file: string | null, source: string | undefined): boolean {
  if (source === undefined) return true
  if (file === null) return false
  const normalized = source.replace(/^\.?\//, '')
  return file === normalized || file.endsWith(`/${normalized}`)
}

function keyMatches(key: string | null, target: VerifyTarget): boolean {
  return target.key === undefined || key === target.key
}

export interface MatchedTarget {
  records: InstanceRecord[]
  mountIds: ReadonlySet<string>
  /** Instances of the same name whose source could not be resolved, so a source-narrowed target cannot exclude them. */
  unresolved: number
  beginInstances: CohortRecord[]
  endInstances: CohortRecord[]
  /** Instances of the name a cohort read left out past its limit, so their source, key and state are unknown. */
  omittedInstances: number
  active: boolean
}

/** Instances of the claim target among the window's records, with the facts every claim kind checks before it can pass. */
export function matchTarget(evidence: TargetEvidence): MatchedTarget {
  const { target } = evidence.resolution
  const belongs = (entry: { key: string | null; sourceFile: string | null }) =>
    keyMatches(entry.key, target) && sourceMatches(entry.sourceFile, target.source)
  const allRecords = evidence.renders?.records ?? []
  const records = allRecords.filter(belongs)
  const beginInstances = evidence.resolution.begin.instances.filter(belongs)
  const endInstances = (evidence.end?.instances ?? []).filter(belongs)
  const unresolved =
    target.source === undefined
      ? 0
      : [
          ...allRecords,
          ...evidence.resolution.begin.instances,
          ...(evidence.end?.instances ?? []),
        ].filter((entry) => keyMatches(entry.key, target) && entry.sourceFile === null).length
  const rendering = (instance: CohortRecord) => instance.renderingState === 'mounted-rendering'
  return {
    records,
    mountIds: new Set(
      [...records, ...beginInstances, ...endInstances].map((entry) => entry.mountId),
    ),
    unresolved,
    beginInstances,
    endInstances,
    omittedInstances: Math.max(
      evidence.resolution.begin.omittedByLimit,
      evidence.end?.omittedByLimit ?? 0,
    ),
    active:
      beginInstances.some(rendering) ||
      endInstances.some(rendering) ||
      records.some((record) => record.renders > 0),
  }
}

/** Distinct source files among same-named instances seen during the window; more than one means two components share the name. */
function windowSources(evidence: TargetEvidence): string[] {
  const { target } = evidence.resolution
  const files = [
    ...(evidence.renders?.records ?? []),
    ...evidence.resolution.begin.instances,
    ...(evidence.end?.instances ?? []),
  ]
    .filter((entry) => keyMatches(entry.key, target))
    .map((entry) => entry.sourceFile)
    .filter((file): file is string => file !== null)
  return [...new Set(files)].sort()
}

/** Refusals about the target itself, in the order an agent should fix them: which component, then whether it was found and active. */
export function targetRefusal(
  evidence: TargetEvidence,
  matched: MatchedTarget,
  stage: 'identity' | 'presence',
): Refusal | null {
  const { target } = evidence.resolution
  if (stage === 'identity') {
    const sources = windowSources(evidence)
    const candidates = target.source === undefined ? sources : []
    if (evidence.resolution.status === 'ambiguous' || candidates.length > 1) {
      return refuse(
        'target_ambiguous',
        `${target.component} names components in ${Math.max(candidates.length, evidence.resolution.candidates.length)} source files; add @<file> to the target.`,
        {
          candidates: candidates.length > 1 ? candidates : evidence.resolution.candidates,
        },
        { action: 'list-target-sources', component: target.component },
      )
    }
    if (matched.unresolved > 0) {
      return refuse(
        'target_ambiguous',
        `${matched.unresolved} ${target.component} instance${matched.unresolved === 1 ? ' has' : 's have'} no resolved source file, so @${target.source} cannot exclude ${matched.unresolved === 1 ? 'it' : 'them'}.`,
        { unresolvedSources: matched.unresolved },
        { action: 'list-target-sources', component: target.component },
      )
    }
    return null
  }
  if (
    matched.records.length === 0 &&
    matched.beginInstances.length === 0 &&
    matched.endInstances.length === 0
  ) {
    return refuse(
      'target_not_found',
      `No ${describeTarget(target)} instance was mounted at begin or rendered in the window; a target Genie cannot see is not a target that did nothing.`,
      { pendingAtBegin: evidence.resolution.status === 'pending' },
      { action: 'find-target', component: target.component },
    )
  }
  if (!matched.active) {
    const states = [...matched.beginInstances, ...matched.endInstances].map(
      (instance) => instance.renderingState,
    )
    return refuse(
      'target_inactive',
      `Every ${describeTarget(target)} instance was frozen, hidden or suspended, so not rendering proves nothing.`,
      { renderingStates: [...new Set(states)] },
      { action: 'begin-again' },
    )
  }
  return null
}

/** Refuses when a cohort read did not list every mounted instance of the name, since the unlisted ones could change the target's identity, presence or remounts. */
export function cohortRefusal(evidence: TargetEvidence, matched: MatchedTarget): Refusal | null {
  if (matched.omittedInstances === 0) return null
  const { component } = evidence.resolution.target
  return refuse(
    'evidence_truncated',
    `${matched.omittedInstances} mounted ${component} instance${matched.omittedInstances === 1 ? ' was' : 's were'} past the cohort limit, so Genie could not check ${matched.omittedInstances === 1 ? 'its' : 'their'} source, key and state. Start from a page that mounts fewer of them, such as a shorter list.`,
    { omittedInstances: matched.omittedInstances },
    { action: 'change-claim' },
  )
}

export function describeTarget(target: VerifyTarget): string {
  const parts = [target.component]
  if (target.key !== undefined) parts.push(`key ${JSON.stringify(target.key)}`)
  if (target.source !== undefined) parts.push(`in ${target.source}`)
  return parts.join(' ')
}
