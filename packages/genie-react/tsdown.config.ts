import { defineConfig } from 'tsdown'

const shared = {
  format: ['esm'],
  dts: true,
  treeshake: true,
  fixedExtension: false,
} satisfies Parameters<typeof defineConfig>[0]

// Browser and Node entries build separately; browser entries share chunks, so the injected client and <Genie /> get one module instance per page.
export default defineConfig([
  {
    ...shared,
    entry: {
      index: 'src/react/index.ts',
      hook: 'src/collectors/react/hook.ts',
      'hook-hmr': 'src/collectors/react/hook-hmr.ts',
      client: 'src/client-entry.ts',
      collectors: 'src/collectors/index.ts',
      'collectors/query': 'src/collectors/query.ts',
      'collectors/router': 'src/collectors/router.ts',
      native: 'src/native/index.ts',
      navigation: 'src/navigation/index.ts',
      'react-freeze': 'src/react-freeze.ts',
      script: 'src/script.ts',
      next: 'src/next/index.ts',
      protocol: 'src/protocol/index.ts',
    },
    platform: 'neutral',
    clean: true,
    deps: {
      // Zod is private to the browser runtime so a host's Zod 3/4 cannot satisfy Genie schemas or prevent the app from mounting.
      alwaysBundle: ['zod'],
      onlyBundle: ['zod'],
      dts: { neverBundle: ['zod'] },
      neverBundle: [/^bippy/, /^react/, /^@tanstack\//, /^genie-react\//, 'superjson', 'ws'],
    },
  },
  {
    ...shared,
    entry: {
      vite: 'src/vite/index.ts',
      hub: 'src/hub/index.ts',
    },
    platform: 'node',
    clean: false,
    deps: { neverBundle: ['vite', 'ws', 'zod', 'superjson'] },
  },
  {
    format: ['esm', 'cjs'],
    entry: { babel: 'src/babel/index.ts' },
    platform: 'node',
    dts: true,
    fixedExtension: true,
    clean: false,
  },
  {
    format: ['iife'],
    entry: { 'client.global': 'src/client-global.ts' },
    platform: 'browser',
    dts: false,
    minify: true,
    treeshake: true,
    fixedExtension: false,
    clean: false,
    // Self-contained on purpose: the hub serves this single file to pages with no bundler integration.
    deps: { alwaysBundle: [/./], onlyBundle: false },
  },
])
