// Resolved through the `production` export condition, so a production bundle carries none of the runtime, its catalog, or its bundled Zod.
import type { GenieAppTool, GenieToolDefinition } from './app-tools'

const noop = (): void => {}

export const Genie = (): null => null
export const useGenieTool = noop
export const useGenieTools = noop
export const registerGenieTools = (..._tools: GenieAppTool[]): (() => void) => noop
export const defineGenieTool = (definition: GenieToolDefinition): GenieToolDefinition => definition

export { GenieToolError } from './app-tools/errors'
