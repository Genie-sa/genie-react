import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { transformWithOxc } from 'vite'

const require = createRequire(import.meta.url)

interface React18Root {
  render: (element: unknown) => void
  unmount: () => void
}

export interface React18 {
  React: typeof import('react')
  act: (callback: () => unknown) => Promise<void>
  createRoot: (container: Element) => React18Root
}

type ReactDom18 = {
  createRoot: (container: Element) => React18Root
  flushSync: (callback: () => unknown) => void
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: { usingClientEntryPoint: boolean }
}

type React18Build = 'development' | 'production'

const BUILD_FILES: Record<React18Build, { react: string; dom: string }> = {
  development: { react: 'cjs/react.development.js', dom: 'cjs/react-dom.development.js' },
  production: { react: 'cjs/react.production.min.js', dom: 'cjs/react-dom.production.min.js' },
}

const loaded = new Map<React18Build, React18>()

/** React 18.3 with its own react-dom: pnpm binds react-dom-18's `react` peer to the workspace React 19, so react-dom is evaluated with React 18 of the same build supplied as `react`. The production build registers with the DevTools hook as `bundleType` 0, like a framework's own bundled React. */
export function loadReact18(build: React18Build = 'development'): React18 {
  const cached = loaded.get(build)
  if (cached) return cached
  const files = BUILD_FILES[build]
  const React = require(
    join(dirname(require.resolve('react-18/package.json')), files.react),
  ) as typeof import('react') & { act: (callback: () => unknown) => Promise<void> }
  const domFile = join(dirname(require.resolve('react-dom-18/package.json')), files.dom)
  const domRequire = createRequire(domFile)
  const module: { exports: Partial<ReactDom18> } = { exports: {} }
  const evaluate = new Function(
    'exports',
    'require',
    'module',
    '__filename',
    '__dirname',
    'process',
    readFileSync(domFile, 'utf8'),
  )
  evaluate(
    module.exports,
    (id: string) => (id === 'react' ? React : domRequire(id)),
    module,
    domFile,
    dirname(domFile),
    process,
  )
  const dom = module.exports as ReactDom18
  const react18: React18 = {
    React,
    act:
      build === 'development'
        ? async (callback) => {
            await React.act(callback)
          }
        : async (callback) => {
            dom.flushSync(callback)
          },
    createRoot: (container) => {
      const internals = dom.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
      internals.usingClientEntryPoint = true
      try {
        return dom.createRoot(container)
      } finally {
        internals.usingClientEntryPoint = false
      }
    },
  }
  loaded.set(build, react18)
  return react18
}

/** Compiles fixture JSX with Vite's development JSX transform (the `jsxDEV` source metadata a Vite + React 18 app ships) and evaluates it against React 18. */
export async function compileReact18Fixture(
  source: string,
  fileName: string,
): Promise<Record<string, unknown>> {
  const { React } = loadReact18()
  const { code } = await transformWithOxc(source, fileName, {
    lang: 'jsx',
    jsx: { runtime: 'automatic', development: true },
  })
  const exported = [...code.matchAll(/^export (?:function|const) (\w+)/gm)].map((match) => match[1])
  const body = code
    .replace(
      /^import .*react\/jsx-dev-runtime.*$/m,
      'const { jsxDEV: _jsxDEV, Fragment: _Fragment } = runtime;',
    )
    .replace(/^import (\{[^}]*\}) from "react";$/m, 'const $1 = React;')
    .replace(/^export /gm, '')
  return new Function('runtime', 'React', `${body}\nreturn { ${exported.join(', ')} }`)(
    require('react-18/jsx-dev-runtime'),
    React,
  )
}
