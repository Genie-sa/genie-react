// The Vite-plugin-injected entry (`genie-react/client`): client core + React collector only, so it stays importable before React loads and without TanStack installed.
export {
  defineGenieTool,
  type GenieAppTool,
  type GenieToolDefinition,
  GenieToolError,
  registerGenieTools,
} from './app-tools'
export * from './client'
export * from './collectors/react'
