import { defineCollector, defineCollectorTool, type GenieCollector } from '@genie-react/client'
import { getRDTHook, overrideProps } from 'bippy'
import {
  reactClearRendersContract,
  reactDomForComponentContract,
  reactEffectAuditContract,
  reactErrorStateContract,
  reactFindComponentsContract,
  reactGetRendersContract,
  reactGetTreeContract,
  reactInspectComponentContract,
  reactInspectContextContract,
  reactOverridePropsContract,
  reactProfileReportContract,
  reactProfileStartContract,
} from './contracts'
import { getEffectAudit } from './effect-tracker'
import { getErrorState } from './error-tracker'
import {
  buildTree,
  contextsForFiber,
  domForFiber,
  findByName,
  findFiberById,
  findRootFiber,
  inspectFiber,
} from './fiber'
import {
  clearRenders,
  getCommitCount,
  getRenderSummary,
  getRenders,
  isTracking,
  startRenderTracking,
} from './render-tracker'

/**
 * React collector: component tree, search, inspection, live prop overrides, and — once commit
 * instrumentation is active (see `@genie-react/react-collector/hook`) — why-did-render + profiling.
 */
export function reactCollector(): GenieCollector {
  return defineCollector({
    meta: { id: 'react', title: 'React', description: 'Tree, inspect, renders, profiling' },
    capabilities: ['react'],
    appInfo: () => {
      const reactVersion = detectReactVersion()
      return reactVersion ? { reactVersion } : {}
    },
    start: () => {
      // Fallback for setups that did not load the hook early — captures future commits only.
      startRenderTracking()
    },
    tools: [
      defineCollectorTool({
        contract: reactGetTreeContract,
        handler: ({ depth, includeHost, maxNodes, appOnly }) => {
          const root = findRootFiber()
          if (!root)
            return { rootId: null, nodes: [], total: 0, truncated: false, truncatedBy: null }
          return buildTree(root, { depth, includeHost, maxNodes, appOnly })
        },
      }),
      defineCollectorTool({
        contract: reactFindComponentsContract,
        handler: ({ query, exact, limit }) => {
          const root = findRootFiber()
          return { matches: root ? findByName(root, query, exact, limit) : [] }
        },
      }),
      defineCollectorTool({
        contract: reactInspectComponentContract,
        handler: ({ id, path, depth }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return inspectFiber(fiber, { path, depth })
        },
      }),
      defineCollectorTool({
        contract: reactOverridePropsContract,
        handler: ({ id, props }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found.`)
          overrideProps(fiber, props)
          return { ok: true }
        },
      }),
      defineCollectorTool({
        contract: reactDomForComponentContract,
        handler: ({ id, limit }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return domForFiber(fiber, { limit })
        },
      }),
      defineCollectorTool({
        contract: reactInspectContextContract,
        handler: ({ id, depth }) => {
          const root = findRootFiber()
          const fiber = root ? findFiberById(root, id) : null
          if (!fiber) throw new Error(`Component ${id} not found (it may have unmounted).`)
          return contextsForFiber(fiber, { depth })
        },
      }),
      defineCollectorTool({
        contract: reactGetRendersContract,
        handler: async ({ component, sort, limit, appOnly }) => {
          const [summary, components] = await Promise.all([
            getRenderSummary(appOnly),
            getRenders({ component, sort, limit, appOnly }),
          ])
          return { tracking: isTracking(), commits: getCommitCount(), summary, components }
        },
      }),
      defineCollectorTool({
        contract: reactEffectAuditContract,
        handler: async ({ component, onlyHot, appOnly, limit }) => ({
          tracking: isTracking(),
          commits: getCommitCount(),
          components: await getEffectAudit({ component, onlyHot, appOnly, limit }),
        }),
      }),
      defineCollectorTool({
        contract: reactErrorStateContract,
        handler: ({ includeSource, limit }) => getErrorState({ includeSource, limit }),
      }),
      defineCollectorTool({
        contract: reactClearRendersContract,
        handler: () => {
          clearRenders()
          return { ok: true, tracking: isTracking() }
        },
      }),
      defineCollectorTool({
        contract: reactProfileStartContract,
        handler: () => {
          startRenderTracking()
          clearRenders()
          return { ok: true, tracking: isTracking() }
        },
      }),
      defineCollectorTool({
        contract: reactProfileReportContract,
        handler: async ({ limit }) => {
          const [bySelfTime, byRenders, byUnnecessary, byUnstable] = await Promise.all([
            getRenders({ sort: 'selfTime', limit }),
            getRenders({ sort: 'renders', limit }),
            getRenders({ sort: 'unnecessary', limit }),
            getRenders({ sort: 'unstable', limit }),
          ])
          return {
            commits: getCommitCount(),
            tracking: isTracking(),
            slowest: bySelfTime.map((r) => ({
              id: r.id,
              name: r.name,
              selfTime: r.selfTime,
              renders: r.renders,
            })),
            mostRerendered: byRenders.map((r) => ({
              id: r.id,
              name: r.name,
              renders: r.renders,
              unnecessary: r.unnecessary,
            })),
            mostUnnecessary: byUnnecessary
              .filter((r) => r.unnecessary > 0)
              .map((r) => ({
                id: r.id,
                name: r.name,
                unnecessary: r.unnecessary,
                renders: r.renders,
              })),
            mostUnstable: byUnstable
              .filter((r) => r.unstableRenders > 0)
              .map((r) => ({
                id: r.id,
                name: r.name,
                unstableRenders: r.unstableRenders,
                renders: r.renders,
              })),
          }
        },
      }),
    ],
  })
}

function detectReactVersion(): string | undefined {
  try {
    const hook = getRDTHook()
    if (hook?.renderers) {
      for (const renderer of hook.renderers.values()) {
        if (renderer.version) return renderer.version
      }
    }
  } catch {
    // hook not available
  }
  return undefined
}
