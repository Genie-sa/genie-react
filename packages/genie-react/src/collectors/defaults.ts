import type { QueryClient } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import type { GenieCollector } from '../client'
import { pluginPassthroughCollector } from './devtools-passthrough'
import { memoryCollector } from './memory'
import { perfCollector } from './perf'
import { type ReduxStoreLike, reduxCollector } from './redux/index'
import { requestWatchCollector } from './request-watch'
import { queryCollector, routerCollector } from './tanstack'
import { timelineCollector } from './timeline'
import { type AppStateLike, visibilityCollector } from './visibility'

export interface DefaultCollectorOptions {
  plugins?: readonly string[]
  queryClient?: QueryClient
  router?: AnyRouter
  appState?: AppStateLike
  reduxStore?: ReduxStoreLike
}

/** Every collector wired beyond the session/react core — the single list the web and native entries share, so a new default ships to both platforms at once. */
export function defaultAppCollectors(options: DefaultCollectorOptions): GenieCollector[] {
  const collectors: GenieCollector[] = [
    memoryCollector(),
    perfCollector(),
    visibilityCollector({ appState: options.appState }),
    pluginPassthroughCollector({ plugins: options.plugins }),
    timelineCollector(options),
    requestWatchCollector(),
  ]
  if (options.router) collectors.push(routerCollector(options.router))
  if (options.queryClient) collectors.push(queryCollector(options.queryClient))
  if (options.reduxStore) collectors.push(reduxCollector(options.reduxStore))
  return collectors
}
