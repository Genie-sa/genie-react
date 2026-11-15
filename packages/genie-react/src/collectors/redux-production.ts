// Resolved through the `production` export condition, so a production bundle carries no Redux instrumentation.
import type { GenieCollector } from '../client/collector'

export function reduxCollector(): GenieCollector {
  return { meta: { id: 'redux', title: 'Redux' } }
}
