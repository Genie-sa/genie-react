import { describe, expect, it } from 'vitest'
import {
  capabilityFor,
  dataLibraryOfFile,
  describeSettledValue,
  parseReactVersion,
  type RendererEvidence,
  thenableStatus,
} from './suspense-debug-info'

const development = (reactVersion: string | null): RendererEvidence => ({
  reactVersion,
  bundle: 'development',
  hasRenderer: true,
  hasDebugInfoField: true,
})

describe('capabilityFor', () => {
  it.each([
    ['19.3.1', 'available', null],
    ['19.2.0', 'available', null],
    ['19.3.0-canary-4a1b2c3-20261101', 'available', null],
    ['20.0.0', 'available', null],
    ['19.1.1', 'partial', 'react-19.0-19.1'],
    ['19.0.0', 'partial', 'react-19.0-19.1'],
    ['0.0.0-experimental-4a1b2c3', 'partial', 'unrecognized-react-version'],
    [null, 'partial', 'unrecognized-react-version'],
  ])('React %s in development is %s', (version, asyncDebugInfo, reason) => {
    expect(capabilityFor(development(version))).toMatchObject({ asyncDebugInfo, reason })
  })

  it('refuses React 18 even when a development build reports a debug field', () => {
    expect(capabilityFor(development('18.3.1'))).toMatchObject({
      asyncDebugInfo: 'unavailable',
      reason: 'react-before-19',
    })
  })

  it('refuses a production build whatever its version claims', () => {
    expect(
      capabilityFor({ ...development('19.3.1'), bundle: 'production', hasDebugInfoField: false }),
    ).toMatchObject({ asyncDebugInfo: 'unavailable', reason: 'production-build' })
  })

  it('trusts the fiber shape over a version string when the debug field is missing', () => {
    expect(
      capabilityFor({ ...development('19.3.1'), bundle: 'unknown', hasDebugInfoField: false }),
    ).toMatchObject({
      asyncDebugInfo: 'unavailable',
      reason: 'debug-fields-missing',
    })
  })

  it('reports no renderer only when neither a renderer nor a fiber exists', () => {
    expect(
      capabilityFor({
        reactVersion: null,
        bundle: 'unknown',
        hasRenderer: false,
        hasDebugInfoField: null,
      }),
    ).toMatchObject({ asyncDebugInfo: 'unavailable', reason: 'no-react-renderer' })
  })
})

describe('parseReactVersion', () => {
  it('reads major and minor and rejects the experimental 0.0.0 channel', () => {
    expect(parseReactVersion('19.2.7')).toEqual({ major: 19, minor: 2 })
    expect(parseReactVersion('0.0.0-experimental-abc')).toBeNull()
    expect(parseReactVersion('next')).toBeNull()
  })
})

describe('reading app-owned promises', () => {
  it('never runs a getter on a thenable', () => {
    let reads = 0
    const hostile = Object.defineProperty(Promise.resolve(1), 'status', {
      get() {
        reads += 1
        throw new Error('app getter ran')
      },
    })
    expect(thenableStatus(hostile)).toBe('unknown')
    expect(reads).toBe(0)
  })

  it('describes settled values by identifier and ignores getters and short strings', () => {
    expect(describeSettledValue({ url: 'https://api.example.test/a' })).toBe(
      'https://api.example.test/a',
    )
    expect(describeSettledValue(new Error('quota exceeded'))).toBe('quota exceeded')
    expect(describeSettledValue({ id: 42 })).toBe('42')
    expect(describeSettledValue('ok')).toBeNull()
    expect(describeSettledValue('x'.repeat(400))?.length).toBe(160)
    const secretive = Object.defineProperty({}, 'url', {
      get() {
        throw new Error('getter ran')
      },
    })
    expect(describeSettledValue(secretive)).toBeNull()
  })
})

describe('dataLibraryOfFile', () => {
  it.each([
    '/app/node_modules/@tanstack/query-core/build/modern/query.js',
    '/app/node_modules/.pnpm/@tanstack+react-query@5.101.2/node_modules/@tanstack/react-query/build/modern/useBaseQuery.js',
    'http://localhost:5173/node_modules/.vite/deps/@tanstack_react-query.js?v=1',
    '/app/node_modules/swr/dist/index.mjs',
    'http://localhost:5173/node_modules/.vite/deps/swr_infinite.js',
    '/app/node_modules/@apollo/client/react/hooks/useSuspenseQuery.js',
    '/app/node_modules/relay-runtime/lib/store.js',
  ])('recognizes %s', (file) => {
    expect(dataLibraryOfFile(file)).toBe(true)
  })

  it.each([
    '/app/src/queries/swr-like.ts',
    '/app/src/tanstack/query.ts',
    '/app/src/@tanstack/react-query/useOrders.ts',
    '/app/node_modules/swr-devtools/dist/index.js',
    'http://localhost:5173/node_modules/.vite/deps/swr-devtools.js?v=1',
    '/app/node_modules/react-dom/cjs/react-dom-client.development.js',
    null,
  ])('does not claim %s', (file) => {
    expect(dataLibraryOfFile(file)).toBe(false)
  })
})
