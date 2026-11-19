import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clearSourceCache, resolveHookCallsite } from './source'

const TELEMETRY_URL = 'http://127.0.0.1:5216/src/lib/telemetry.ts?t=1795061730389'

/** Vite serves `src/lib/telemetry.ts` with `useEffect` on line 7 and an inline map naming the file relative to the module; the map sends that line to line 11 of the source. */
function viteModuleWithMap(): Response {
  const map = { version: 3, sources: ['telemetry.ts'], names: [], mappings: ';;;;;;AAUE' }
  const encoded = Buffer.from(JSON.stringify(map)).toString('base64')
  return new Response(`export {}\n//# sourceMappingURL=data:application/json;base64,${encoded}\n`)
}

beforeEach(() => clearSourceCache())
afterEach(() => vi.unstubAllGlobals())

describe('source file names from a Vite dev server', () => {
  it('keeps /src on a served module under a short directory such as src/lib', async () => {
    vi.stubGlobal('fetch', () => Promise.reject(new Error('no network in tests')))

    const source = await resolveHookCallsite({
      fileName: TELEMETRY_URL,
      lineNumber: 7,
      columnNumber: 2,
      functionName: 'usePageView',
    })

    expect(source).toMatchObject({ file: '/src/lib/telemetry.ts', role: 'hook-callsite' })
  })

  it('keeps /src on the file a module map names relative to the module', async () => {
    vi.stubGlobal('fetch', async () => viteModuleWithMap())

    const source = await resolveHookCallsite({
      fileName: TELEMETRY_URL,
      lineNumber: 7,
      columnNumber: 2,
      functionName: 'usePageView',
    })

    expect(source?.file).toBe('/src/lib/telemetry.ts')
  })
})
