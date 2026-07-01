import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (pkg: string) =>
  fileURLToPath(new URL(`./packages/${pkg}/src/index.ts`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@genie-react/core': src('core'),
      '@genie-react/bridge': src('bridge'),
      '@genie-react/client': src('client'),
      '@genie-react/react-collector': src('react-collector'),
      '@genie-react/tanstack-collector': src('tanstack-collector'),
      '@genie-react/devtools-plugin': src('devtools-plugin'),
      '@genie-react/memory': src('memory'),
      '@genie-react/cli': src('cli'),
    },
  },
  test: {
    include: ['packages/*/src/**/*.test.ts'],
  },
})
