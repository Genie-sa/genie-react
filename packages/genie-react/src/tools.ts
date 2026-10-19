// App-tool API without <Genie />, so Next.js, React Native, and other non-Vite apps import it whether or not TanStack is installed.
export {
  defineGenieTool,
  type GenieAppTool,
  type GenieToolDefinition,
  GenieToolError,
  registerGenieTools,
} from './app-tools'
export { type UseGenieToolOptions, useGenieTool, useGenieTools } from './react/use-genie-tool'
