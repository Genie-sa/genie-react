import { join } from 'node:path'
import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vitest.config'

const babelDirectory = process.env.GENIE_BABEL_DIR
if (!babelDirectory)
  throw new Error('Set GENIE_BABEL_DIR to a directory with @babel/core 8 installed')

// The workspace keeps Babel 7 because Expo and React Native resolve their @babel/core peer from it; Babel 8 stays outside the lockfile.
export default mergeConfig(
  base,
  defineConfig({
    resolve: {
      alias: [
        {
          find: /^@babel\/core$/,
          replacement: join(babelDirectory, 'node_modules/@babel/core/lib/index.js'),
        },
      ],
    },
  }),
)
