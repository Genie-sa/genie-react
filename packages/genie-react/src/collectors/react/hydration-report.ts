import { type Fiber, type FiberRoot, isCompositeFiber, isHostFiber } from 'bippy'
import { z } from 'zod'
import { defineAgentToolContract, roundMilliseconds } from '../../protocol'
import { describeOtherRoot, nameOf, registerFiber } from './fiber'
import {
  type HydrationOutcome,
  type HydrationReport,
  type HydrationSnapshot,
  hydrationSnapshot,
} from './hydration-tracker'
import { getDocumentCommitId } from './observation'

const reportKinds = [
  'text-mismatch',
  'html-mismatch',
  'attribute-mismatch',
  'hydration-error',
  'server-render-error',
  'recoverable-error',
] as const

const componentSchema = z
  .object({
    id: z
      .number()
      .int()
      .describe(
        'Component ID when the fiber was recorded; it may no longer resolve after a re-render.',
      ),
    name: z.string(),
  })
  .nullable()

const reportSchema = z.object({
  index: z.number().int().nonnegative(),
  kind: z
    .enum(reportKinds)
    .describe(
      "text-mismatch and html-mismatch: React's 'Hydration failed' error, after which it renders the tree on the client. attribute-mismatch: React's warning that only attributes differed; React 19 keeps the server attributes and does not patch them. hydration-error: another error React reported while hydrating. server-render-error: the server gave up on a Suspense boundary, so React rendered it on the client. recoverable-error: an error React recovered from by rendering again, passed to onRecoverableError.",
    ),
  regenerated: z
    .boolean()
    .nullable()
    .describe(
      'true: Genie saw React delete the server HTML of the boundary or root this report came from. false: it hydrated, or the report was a warning. null: Genie did not see that boundary hydrate.',
    ),
  message: z.string().describe('First line of the message React reported.'),
  digest: z
    .string()
    .nullable()
    .describe(
      "The error's digest when the server failed a boundary. Next.js uses BAILOUT_TO_CLIENT_SIDE_RENDERING when it renders a client-only part on the client on purpose, such as next/dynamic with ssr:false.",
    ),
  differences: z
    .array(
      z.object({
        under: z.string().nullable().describe('Nearest element or component in the diff.'),
        client: z.string().nullable(),
        server: z.string().nullable(),
      }),
    )
    .describe(
      "Pairs from React's development diff, client next to server; empty when React gave no diff.",
    ),
  diff: z.string().nullable().describe("React's development diff verbatim, bounded."),
  component: componentSchema.describe(
    'The component at or above the fiber React reported for, read from the renderer while it reported; null on React 18, which reports outside any fiber.',
  ),
  element: z
    .string()
    .nullable()
    .describe('The host element React reported for, such as "strong", when it was one.'),
  boundaryId: z
    .number()
    .int()
    .nullable()
    .describe('Nearest Suspense boundary above that component; null when none or unknown.'),
  componentStack: z.array(z.string()).describe('Component stack React passed, top first, bounded.'),
  atMs: z.number(),
  documentCommitId: z.number().int().nonnegative(),
})

const clientRenderSchema = z.object({
  scope: z.enum(['boundary', 'root']),
  boundaryId: z.number().int().nullable(),
  name: z
    .string()
    .describe('Suspense `name` prop, else "Suspense"; the root component for a root.'),
  evidence: z.literal('exact'),
  basis: z
    .enum(['server-html-deleted', 'root-forced-client-render'])
    .describe(
      "server-html-deleted: React deleted the boundary's DehydratedFragment, the fiber holding its server HTML. root-forced-client-render: React flagged the root to render on the client after hydration failed outside every boundary.",
    ),
  reportIndexes: z
    .array(z.number().int().nonnegative())
    .describe(
      'Reports React raised for this boundary or root. Empty means React discarded the server HTML without reporting an error.',
    ),
  atMs: z.number(),
  documentCommitId: z.number().int().nonnegative(),
})

export const reactHydrationContract = defineAgentToolContract({
  name: 'react_hydration',
  title: 'Hydration mismatches and client re-renders',
  description:
    "Report whether server-rendered HTML hydrated or React threw it away and rendered on the client, and what React said differed. clientRendered lists each Suspense boundary or root React rendered again on the client, read from the fibers (exact), with the reports React raised for it: an empty reportIndexes means React discarded the server HTML silently, which happens when an update, such as state set in a provider's mount effect, reaches a boundary before it hydrates. reports lists hydration errors React passed to onRecoverableError and its attribute-mismatch warnings, with the client and server values from React's development diff and the component React named. Evidence starts when the page loads; Genie must load before React hydrates.",
  group: 'react.render',
  input: z.object({ limit: z.number().int().min(1).max(100).default(20) }),
  output: z.object({
    roots: z.array(
      z.object({
        rootComponent: z.string().nullable(),
        outcome: z
          .enum(['hydrated', 'client-rendered', 'hydrating', 'not-server-rendered', 'unknown'])
          .describe(
            'hydrating: server HTML is still waiting to hydrate. not-server-rendered: created on the client. unknown: Genie first saw the root after its first commit.',
          ),
      }),
    ),
    counts: z.object({
      boundariesHydrated: z.number().int().nonnegative(),
      boundariesClientRendered: z.number().int().nonnegative(),
      rootsClientRendered: z.number().int().nonnegative(),
      reports: z.number().int().nonnegative(),
    }),
    clientRendered: z.array(clientRenderSchema),
    reports: z.array(reportSchema),
    omittedByLimit: z.number().int().nonnegative(),
    coverage: z.object({
      complete: z
        .boolean()
        .describe('Genie watched every root from its first commit and hydration has finished.'),
      hydrationInProgress: z.boolean(),
      rootsSeenLate: z
        .number()
        .int()
        .nonnegative()
        .describe('Roots first seen after their first commit.'),
      reportsBounded: z
        .boolean()
        .describe('Genie keeps the latest 100 reports and outcomes; older ones may be gone.'),
    }),
    documentCommitId: z.number().int().nonnegative(),
    hint: z.string().nullable(),
  }),
  annotations: { readOnlyHint: true },
})

export type HydrationToolReport = z.infer<typeof reactHydrationContract.output>

function boundaryName(fiber: Fiber): string {
  const props = fiber.memoizedProps as { name?: unknown } | null
  return typeof props?.name === 'string' && props.name.length > 0
    ? props.name.slice(0, 120)
    : 'Suspense'
}

function sameFiber(left: Fiber | undefined | null, right: Fiber | undefined | null): boolean {
  return !!left && !!right && (left === right || left.alternate === right)
}

function nearestComposite(fiber: Fiber | null): Fiber | null {
  let node = fiber
  while (node && !isCompositeFiber(node)) node = node.return
  return node
}

function rootComponentName(root: FiberRoot): string | null {
  return describeOtherRoot(root.current)[0]?.name ?? null
}

function rootOutcome(
  entry: HydrationSnapshot['roots'][number],
): HydrationToolReport['roots'][number]['outcome'] {
  if (entry.outcome) return entry.outcome.outcome
  if (entry.serverRendered === null) return 'unknown'
  const hydrating =
    (entry.root.current.memoizedState as { isDehydrated?: unknown } | null)?.isDehydrated === true
  return hydrating ? 'hydrating' : entry.serverRendered ? 'hydrated' : 'not-server-rendered'
}

interface Target {
  scope: 'boundary' | 'root'
  fiber: Fiber | null
  root: FiberRoot
  outcome: HydrationOutcome
  atMs: number
  documentCommitId: number
}

function targetsOf(snapshot: HydrationSnapshot): Target[] {
  return [
    ...snapshot.roots.flatMap(({ root, outcome }) =>
      outcome ? [{ scope: 'root' as const, fiber: null, ...outcome, root }] : [],
    ),
    ...snapshot.boundaries.flatMap((entry) => {
      const fiber = entry.boundary.deref()
      return fiber ? [{ scope: 'boundary' as const, ...entry, fiber }] : []
    }),
  ]
}

/** The boundary or root a report belongs to: the boundary above the fiber React reported it for or, when React gave no fiber (React 18), the one target of its root that React rendered on the client in the commit that reported it, since React reports a commit's recoverable errors right after that commit. */
function targetOf(report: HydrationReport, targets: Target[]): Target | null {
  const boundary = report.boundary?.deref()
  if (boundary) {
    return (
      targets.find((target) => target.scope === 'boundary' && sameFiber(target.fiber, boundary)) ??
      null
    )
  }
  if (!report.root) return null
  const sameCommit = targets.filter(
    (target) =>
      target.root === report.root &&
      target.outcome === 'client-rendered' &&
      target.documentCommitId === report.documentCommitId,
  )
  if (sameCommit.length === 1) return sameCommit[0] ?? null
  return (
    targets.find(
      (target) => target.scope === 'root' && target.root === report.root && sameCommit.length === 0,
    ) ?? null
  )
}

/** Joins what React reported with what Genie saw it do to the server HTML. */
export function getHydrationReport({ limit }: { limit: number }): HydrationToolReport {
  const snapshot = hydrationSnapshot()
  const targets = targetsOf(snapshot)
  const reportTargets = snapshot.reports.map((report) => targetOf(report, targets))
  const reports = snapshot.reports.map((report, index) => {
    const source = report.source?.deref() ?? null
    const composite = nearestComposite(source)
    const boundary = report.boundary?.deref() ?? null
    const target = reportTargets[index]
    return {
      index,
      kind: report.kind,
      regenerated:
        report.kind === 'attribute-mismatch'
          ? false
          : target
            ? target.outcome === 'client-rendered'
            : null,
      message: report.message,
      digest: report.digest,
      differences: report.differences,
      diff: report.diff,
      component: composite ? { id: registerFiber(composite), name: nameOf(composite) } : null,
      element: source && isHostFiber(source) ? nameOf(source) : null,
      boundaryId: boundary ? registerFiber(boundary) : null,
      componentStack: report.componentStack,
      atMs: roundMilliseconds(report.atMs),
      documentCommitId: report.documentCommitId,
    }
  })
  const clientRendered = targets
    .filter((target) => target.outcome === 'client-rendered')
    .map((target) => ({
      scope: target.scope,
      boundaryId: target.fiber ? registerFiber(target.fiber) : null,
      name: target.fiber ? boundaryName(target.fiber) : (rootComponentName(target.root) ?? 'root'),
      evidence: 'exact' as const,
      basis:
        target.scope === 'root'
          ? ('root-forced-client-render' as const)
          : ('server-html-deleted' as const),
      reportIndexes: reportTargets.flatMap((reportTarget, index) =>
        reportTarget === target ? [index] : [],
      ),
      atMs: roundMilliseconds(target.atMs),
      documentCommitId: target.documentCommitId,
    }))
  const roots = snapshot.roots.map((entry) => ({
    rootComponent: rootComponentName(entry.root),
    outcome: rootOutcome(entry),
  }))
  const rootsSeenLate = roots.filter((root) => root.outcome === 'unknown').length
  const hydrationInProgress =
    snapshot.watching || roots.some((root) => root.outcome === 'hydrating')
  const listedReports = reports.slice(-limit)
  const listedClientRenders = clientRendered.slice(0, limit)
  return {
    roots,
    counts: {
      boundariesHydrated: snapshot.boundaries.filter((entry) => entry.outcome === 'hydrated')
        .length,
      boundariesClientRendered: snapshot.boundaries.filter(
        (entry) => entry.outcome === 'client-rendered',
      ).length,
      rootsClientRendered: snapshot.roots.filter(
        (entry) => entry.outcome?.outcome === 'client-rendered',
      ).length,
      reports: reports.length,
    },
    clientRendered: listedClientRenders,
    reports: listedReports,
    omittedByLimit:
      reports.length - listedReports.length + clientRendered.length - listedClientRenders.length,
    coverage: {
      complete: rootsSeenLate === 0 && !hydrationInProgress,
      hydrationInProgress,
      rootsSeenLate,
      reportsBounded: snapshot.reports.length >= 100 || snapshot.boundaries.length >= 100,
    },
    documentCommitId: getDocumentCommitId(),
    hint: hintFor(clientRendered, reports),
  }
}

const MISMATCH_KINDS = new Set(['text-mismatch', 'html-mismatch'])
const DELIBERATE_CLIENT_RENDER = 'BAILOUT_TO_CLIENT_SIDE_RENDERING'

function hintFor(
  clientRendered: HydrationToolReport['clientRendered'],
  reports: HydrationToolReport['reports'],
): string | null {
  const reportOf = (entry: HydrationToolReport['clientRendered'][number]) =>
    entry.reportIndexes.map((index) => reports.find((report) => report.index === index))
  const where = (entry: HydrationToolReport['clientRendered'][number]) =>
    entry.scope === 'root'
      ? `the root <${entry.name}>`
      : `<Suspense name="${entry.name}"> #${entry.boundaryId}`
  const rank = (entry: HydrationToolReport['clientRendered'][number]) => {
    const linked = reportOf(entry)
    if (linked.some((report) => report && MISMATCH_KINDS.has(report.kind))) return 0
    if (linked.length === 0) return 1
    return linked.every((report) => report?.digest === DELIBERATE_CLIENT_RENDER) ? 3 : 2
  }
  const first = [...clientRendered].sort((left, right) => rank(left) - rank(right))[0]
  if (first && rank(first) !== 1) {
    const linked = reportOf(first)
    const report =
      linked.find((candidate) => candidate && MISMATCH_KINDS.has(candidate.kind)) ?? linked[0]
    const component = report?.component ? ` in <${report.component.name}>` : ''
    const difference = report?.differences[0]
    const differs = difference
      ? `: server sent ${JSON.stringify(difference.server)}, client rendered ${JSON.stringify(difference.client)}`
      : ''
    return `React discarded the server HTML of ${where(first)} and rendered it on the client after "${report?.message ?? 'a hydration error'}"${component}${differs}`
  }
  if (first) {
    return `React discarded the server HTML of ${where(first)} and rendered it on the client without reporting an error; this happens when an update, such as state set in a mount effect of a provider above it, reaches the boundary before it hydrates (inferred)`
  }
  const warning = reports.find((report) => report.kind === 'attribute-mismatch')
  if (warning) {
    return `React hydrated with mismatched attributes${warning.component ? ` in <${warning.component.name}>` : ''} and kept the server values: ${warning.message}`
  }
  return null
}
