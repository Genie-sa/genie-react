// Side-effect entry: install the React DevTools hook BEFORE React loads, then start commit
// instrumentation. Import this as the very first module on the page (e.g. a <head> module script)
// so React registers a renderer with our hook and delivers commit callbacks.
import 'bippy/install-hook-only'
import { installErrorCapture } from './error-tracker'
import { startRenderTracking } from './render-tracker'

installErrorCapture()
startRenderTracking()
