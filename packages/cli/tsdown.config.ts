import { readFileSync } from 'node:fs'
import { defineConfig, type UserConfig } from 'tsdown'

const runtime = JSON.parse(
  readFileSync(new URL('../genie-react/package.json', import.meta.url), 'utf8'),
)

const shared = {
  format: ['esm'],
  treeshake: true,
  fixedExtension: false,
  platform: 'node',
  // genie-react and the CLI release in lockstep, so the inlined protocol reports the same version as the installed package.
  define: { __GENIE_REACT_VERSION__: JSON.stringify(runtime.version) },
  deps: {
    // Each file costs a resolve, a read and a compile on every run, so the call path ships inline; the hub server stays a package import that only `hub` and `capture export` load.
    alwaysBundle: [/^genie-react\/(protocol|hub\/token)$/],
    onlyBundle: ['ws', 'zod', 'superjson', 'copy-anything', 'is-what'],
    neverBundle: ['genie-react/hub', 'bufferutil', 'utf-8-validate'],
    dts: { neverBundle: [/^genie-react/, 'ws'] },
  },
} satisfies UserConfig

// The executable and the library build separately, and each command's static imports share one chunk: rolldown would otherwise split code shared with lazily loaded commands into many small files.
export default defineConfig([
  {
    ...shared,
    entry: ['src/cli.ts'],
    dts: false,
    clean: true,
    outputOptions: {
      codeSplitting: {
        includeDependenciesRecursively: true,
        groups: [
          { name: 'private-directory', test: /[\\/]hub[\\/]private-directory\.ts$/, priority: 3 },
          { name: 'cli-main', test: /[\\/]src[\\/]cli-main\.ts$/, priority: 2 },
          { name: 'agent', test: /[\\/]src[\\/]agent\.ts$/, priority: 1 },
        ],
      },
    },
  },
  { ...shared, entry: ['src/index.ts'], dts: true, clean: false },
])
