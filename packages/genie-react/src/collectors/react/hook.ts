// Side-effect entry — import as the page's very first module so the DevTools hook installs BEFORE React loads and commit callbacks are delivered.
import 'bippy/install-hook-only'
import { isProductionBuild } from '../../production-build'
import { installProxyTagging } from '../causal/proxy-tagging'
import { installErrorCapture, uninstallErrorCapture } from './error-tracker'
import { guardCommitStream } from './hook-guard'
import { disposeUnmountPruning, ensureUnmountPruning } from './overrides'
import { disposeRefreshTracking, startRefreshTracking } from './refresh-tracker'
import { disposeRenderTracking, startRenderTracking } from './render-tracker'

const instrumented = !isProductionBuild()
if (instrumented) {
  // First, so every app Proxy created after this entry is recognised and never reflected on.
  installProxyTagging()
  installErrorCapture()
  startRefreshTracking()
  startRenderTracking()
  ensureUnmountPruning()
}
// Guard LAST, once every bippy registration is final, so the trapped upstream is the complete dispatcher.
const unguardCommitStream = instrumented ? guardCommitStream() : () => {}

/** Explicit module teardown; Vite registers it through the separate ESM-only hook-hmr entry. */
export function disposeHookInstrumentation(): void {
  if (!instrumented) return
  unguardCommitStream()
  uninstallErrorCapture()
  disposeUnmountPruning()
  disposeRenderTracking()
  disposeRefreshTracking()
}
