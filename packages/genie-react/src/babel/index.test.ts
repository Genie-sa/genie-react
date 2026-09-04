import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { transformSync } from '@babel/core'
import { describe, expect, it } from 'vitest'
import genieComponentNames from './index'

const reactUrl = pathToFileURL(createRequire(import.meta.url).resolve('react')).href

async function compile(source: string, envName = 'development', isDev?: boolean) {
  const result = transformSync(source, {
    configFile: false,
    babelrc: false,
    envName,
    caller: { name: 'genie-name-test', ...(isDev === undefined ? {} : { isDev }) },
    plugins: [genieComponentNames],
  })
  if (!result?.code) throw new Error('Babel produced no module')
  const code = result.code.replaceAll(/(['"])react\1/g, JSON.stringify(reactUrl))
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
}

describe('development memo names', () => {
  it.each([
    ['import { memo } from "react"', 'memo'],
    ['import { memo as remember } from "react"', 'remember'],
    ['import * as React from "react"', 'React.memo'],
    ['import React from "react"', 'React.memo'],
  ])('names an anonymous memo using its lexical binding: %s', async (imports, memo) => {
    const module = await compile(`${imports}; export const FriendListRow = ${memo}(() => null)`)
    expect(module.FriendListRow.displayName).toBe('FriendListRow')
    expect(module.FriendListRow.type()).toBeNull()
  })

  it('preserves named inner functions and explicit display names with multiple declarations', async () => {
    const module = await compile(`
      import { memo } from 'react'
      export const Named = memo(function InnerRow() { return null }), Arrow = memo(() => null)
      export const Anonymous = memo(function () { return null })
      export const Existing = memo(() => null), alreadyNamed = Existing.displayName = 'ExistingName'
      Arrow.displayName = 'CustomRow'
    `)
    expect(module.Named.displayName).toBeUndefined()
    expect(module.Named.type.name).toBe('InnerRow')
    expect(module.Arrow.displayName).toBe('CustomRow')
    expect(module.Anonymous.displayName).toBe('Anonymous')
    expect(module.Existing.displayName).toBe('ExistingName')
  })

  it('does not annotate unrelated or shadowed calls named memo', async () => {
    const module = await compile(`
      import { memo } from 'react'
      function build(memo) { const LocalRow = memo(() => null); return LocalRow }
      function buildNamespace(React) { const LocalRow = React.memo(() => null); return LocalRow }
      function unrelated(fn) { return Object.freeze({ type: fn }) }
      export const LocalRow = build(unrelated)
      export const OtherRow = unrelated(() => null)
      export const NamespaceRow = buildNamespace({ memo: unrelated })
    `)
    expect(module.LocalRow.displayName).toBeUndefined()
    expect(module.OtherRow.displayName).toBeUndefined()
    expect(module.NamespaceRow.displayName).toBeUndefined()
  })

  it('does not annotate another package export named memo', async () => {
    const packageUrl = `data:text/javascript,${encodeURIComponent('export function memo(fn) { return Object.freeze({ type: fn }) }')}`
    const module = await compile(
      `import { memo } from '${packageUrl}'; export const OtherRow = memo(() => null)`,
    )
    expect(module.OtherRow.displayName).toBeUndefined()
  })

  it.each([
    ['production', undefined],
    ['test', undefined],
    ['development', false],
  ])('emits no names for a non-development build: %s, Metro dev %s', async (envName, isDev) => {
    const module = await compile(
      `import { memo } from 'react'; export const ReleaseRow = memo(() => null)`,
      envName,
      isDev,
    )
    expect(module.ReleaseRow.displayName).toBeUndefined()
    expect(module.ReleaseRow.type.name).toBe('')
  })

  it('does not move metadata out of a conditional declaration or loop initializer', async () => {
    const module = await compile(`
      import { memo } from 'react'
      if (false) var ConditionalRow = memo(() => null)
      for (let LoopRow = memo(() => null), once = false; once;) {}
      export { ConditionalRow }
    `)
    expect(module.ConditionalRow).toBeUndefined()
  })
})

describe('Expo preset integration', () => {
  it.each([
    true,
    false,
  ])('preserves lexical memo names only in a Metro development build: %s', (isDev) => {
    const projectRoot = fileURLToPath(new URL('../../../../examples/expo-demo/', import.meta.url))
    const expoRequire = createRequire(`${projectRoot}/package.json`)
    const caller = { name: 'metro', isDev, isHMREnabled: true, platform: 'ios', projectRoot }
    const result = transformSync(
      `
      import { memo } from 'react'
      export const FriendListRow = memo(({ value }: { value: number }) => value)
      export const NamedRow = memo(function InnerRow() { return null })
      export const CustomRow = memo(() => null)
      CustomRow.displayName = 'ExplicitRow'
    `,
      {
        configFile: false,
        babelrc: false,
        filename: `${projectRoot}/row.tsx`,
        envName: isDev ? 'development' : 'production',
        caller,
        plugins: [genieComponentNames],
        presets: [expoRequire.resolve('babel-preset-expo')],
      },
    )
    if (!result?.code) throw new Error('Expo preset produced no module')
    const exported: Record<string, { displayName?: string; type: { name: string } }> = {}
    new Function('require', 'exports', '$RefreshReg$', result.code)(
      createRequire(import.meta.url),
      exported,
      () => {},
    )
    expect(exported.FriendListRow?.displayName).toBe(isDev ? 'FriendListRow' : undefined)
    expect(exported.NamedRow?.type.name).toBe('InnerRow')
    expect(exported.CustomRow?.displayName).toBe('ExplicitRow')
  })
})
