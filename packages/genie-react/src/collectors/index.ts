// Manual-composition entry (e.g. Query without Router); functions only — re-exporting PluginPassthroughOptions trips a rolldown-plugin-dts chunking bug, and the options shape still types structurally through the signature.
export { pluginPassthroughCollector } from './devtools-passthrough'
export { memoryCollector } from './memory'
export { perfCollector } from './perf'
export { reactCollector } from './react'
export { queryCollector, routerCollector } from './tanstack'
