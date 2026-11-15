import { mkdirSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const testRuntimeDir = join(tmpdir(), 'genie-react-vitest-runtime')
mkdirSync(testRuntimeDir, { recursive: true, mode: 0o700 })

const entry = (path: string) =>
  fileURLToPath(new URL(`./packages/genie-react/src/${path}`, import.meta.url))

const runtimeVersion: string = JSON.parse(
  readFileSync(new URL('./packages/genie-react/package.json', import.meta.url), 'utf8'),
).version

export default defineConfig({
  define: { __GENIE_REACT_VERSION__: JSON.stringify(runtimeVersion) },
  resolve: {
    alias: [
      { find: 'genie-react/protocol', replacement: entry('protocol/index.ts') },
      { find: 'genie-react/client', replacement: entry('client-entry.ts') },
      { find: 'genie-react/collectors', replacement: entry('collectors/index.ts') },
      { find: 'genie-react/hook', replacement: entry('collectors/react/hook.ts') },
      { find: 'genie-react/hub/token', replacement: entry('hub/token.ts') },
      { find: 'genie-react/hub', replacement: entry('hub/index.ts') },
      { find: 'genie-react/vite', replacement: entry('vite/index.ts') },
      { find: /^genie-react$/, replacement: entry('react/index.ts') },
    ],
  },
  test: {
    // Hubs started by tests publish agent tokens here instead of beside the developer's real ones.
    // CLI tests run in-process, so they must never reach the developer's agent-browser sessions.
    env: {
      XDG_RUNTIME_DIR: testRuntimeDir,
      GENIE_AGENT_BROWSER: join(testRuntimeDir, 'no-agent-browser'),
    },
    include: [
      'packages/*/src/**/*.test.ts',
      'apps/docs/src/**/*.test.ts',
      'evals/lib/**/*.test.ts',
      'evals/realworld/**/*.test.ts',
    ],
  },
})
