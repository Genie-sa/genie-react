import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

const reactDirectory = process.env.GENIE_REACT_DIR
if (!reactDirectory)
  throw new Error('Set GENIE_REACT_DIR to a directory with react and react-dom installed')
const modules = join(reactDirectory, 'node_modules')
const REACT_BINDINGS = ['react-redux', 'react-redux-9']

// Runs the real-React corpora against another React install; the harness avoids @testing-library so no copy of React 19 leaks in.
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: [
        { find: /^react$/, replacement: join(modules, 'react/index.js') },
        { find: /^react\/(.*)$/, replacement: join(modules, 'react/$1') },
        { find: /^react-dom$/, replacement: join(modules, 'react-dom/index.js') },
        { find: /^react-dom\/(.*)$/, replacement: join(modules, 'react-dom/$1') },
        // React bindings installed beside this React, so their own `require('react')` reaches it too.
        ...REACT_BINDINGS.filter((name) => existsSync(join(modules, name))).map((name) => ({
          find: new RegExp(`^${name}$`),
          replacement: join(modules, name),
        })),
      ],
    },
  }),
)
