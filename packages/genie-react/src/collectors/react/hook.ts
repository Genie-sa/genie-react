// Side-effect entry — import as the page's very first module so the DevTools hook installs BEFORE React loads and commit callbacks are delivered.
import 'bippy/install-hook-only'
import { isProductionBuild } from '../../production-build'
import { MAXIMUM_RENDER_OBSERVATION_BUDGET } from '../../protocol/react-observation-schema'
import { installProxyTagging } from '../causal/proxy-tagging'
import { installErrorCapture, uninstallErrorCapture } from './error-tracker'
import { guardCommitStream } from './hook-guard'
import { disposeHydrationTracking, startHydrationTracking } from './hydration-tracker'
import { disposeUnmountPruning, ensureUnmountPruning } from './overrides'
import { disposeRefreshTracking, startRefreshTracking } from './refresh-tracker'
import { clearRenders, disposeRenderTracking, startRenderTracking } from './render-tracker'
import { disposeSuspenseCapture, startSuspenseCapture } from './suspense-capture'

const instrumented = !isProductionBuild()
if (instrumented) {
  // First, so every app Proxy created after this entry is recognised and never reflected on.
  installProxyTagging()
  installErrorCapture()
  startRefreshTracking()
  startRenderTracking()
  if (requestsObservationFromLoad()) clearRenders({ budget: MAXIMUM_RENDER_OBSERVATION_BUDGET })
  startSuspenseCapture()
  startHydrationTracking()
  ensureUnmountPruning()
}
// Guard LAST, once every bippy registration is final, so the trapped upstream is the complete dispatcher.
const unguardCommitStream = instrumented ? guardCommitStream() : () => {}

/** A window a tool opens starts after the page has loaded, so `_genie_observe` in the page URL is how an agent observes the load itself: it opens a window before React's first commit, with the largest budget so the first mount is not cut short. */
function requestsObservationFromLoad(): boolean {
  try {
    return new URLSearchParams(globalThis.location?.search ?? '').has('_genie_observe')
  } catch {
    return false
  }
}

/** Explicit module teardown; Vite registers it through the separate ESM-only hook-hmr entry. */
export function disposeHookInstrumentation(): void {
  if (!instrumented) return
  unguardCommitStream()
  uninstallErrorCapture()
  disposeUnmountPruning()
  disposeRenderTracking()
  disposeSuspenseCapture()
  disposeHydrationTracking()
  disposeRefreshTracking()
}
