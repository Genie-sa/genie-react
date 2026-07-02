// Side-effect entry — import as the page's very first module so the DevTools hook installs BEFORE React loads and commit callbacks are delivered.
import 'bippy/install-hook-only'
import { installErrorCapture } from './error-tracker'
import { guardCommitStream } from './hook-guard'
import { ensureUnmountPruning } from './overrides'
import { startRenderTracking } from './render-tracker'

installErrorCapture()
startRenderTracking()
ensureUnmountPruning()
// Guard LAST, once every bippy registration is final, so the trapped upstream is the complete dispatcher.
guardCommitStream()
