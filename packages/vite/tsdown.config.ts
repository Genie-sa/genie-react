import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  treeshake: true,
  fixedExtension: false,
  platform: 'node',
  external: [/^@genie-react\//, 'vite'],
})
