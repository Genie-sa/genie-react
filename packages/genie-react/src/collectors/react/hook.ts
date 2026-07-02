// Side-effect entry — import as the page's very first module so the DevTools hook installs BEFORE React loads and commit callbacks are delivered.
import 'bippy/install-hook-only'
import { installErrorCapture } from './error-tracker'
import { guardCommitStream } from './hook-guard'
import { startRenderTracking } from './render-tracker'

installErrorCapture()
startRenderTracking()
// Guard LAST, once bippy's instrumentation is final, so the trapped upstream is the real dispatcher.
guardCommitStream()
