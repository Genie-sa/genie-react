import { renderCaptureComparisonText } from './capture-output'
import { renderRenderCausesText, renderRenderReportText } from './render-output'
import { renderStatusText } from './session-output'
import { encodeText } from './text-output'
import { renderTimelineText } from './timeline-output'
import { renderTreeText } from './tree-output'

/** Tools whose results have a structure-aware text layout; every other result uses the generic encoder. */
export const TOOL_TEXT_RENDERERS: Readonly<Record<string, (value: unknown) => string>> = {
  react_get_tree: renderTreeText,
  react_get_renders: renderRenderReportText,
  react_render_causes: renderRenderCausesText,
  timeline_read: renderTimelineText,
  devtools_capture_compare: renderCaptureComparisonText,
  devtools_status: renderStatusText,
}

export function renderToolText(tool: string, value: unknown): string {
  const render = Object.hasOwn(TOOL_TEXT_RENDERERS, tool) ? TOOL_TEXT_RENDERERS[tool] : undefined
  return (render ?? encodeText)(value)
}
