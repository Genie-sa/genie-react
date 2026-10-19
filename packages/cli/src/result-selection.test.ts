import { describe, expect, it } from 'vitest'
import {
  largestJsonPaths,
  ResultSelectionError,
  renderBoundedJson,
  selectResult,
} from './result-selection'

describe('nested result selection', () => {
  const result = {
    sections: {
      react: {
        components: [
          { name: 'A', renders: 2 },
          { name: 'B', renders: 3 },
        ],
      },
    },
    complete: true,
  }

  it('supports JSON Pointer and dotted wildcard paths with omission accounting', () => {
    expect(selectResult(result, '/sections/react/components/0/name')).toMatchObject({
      selection: {
        matchedPaths: ['/sections/react/components/0/name'],
        matchedPathCount: 1,
        omittedPathCount: 4,
      },
      result: 'A',
    })
    expect(selectResult(result, 'sections.react.components[*].name')).toMatchObject({
      selection: { matchedPathCount: 2, omittedPathCount: 3 },
      result: ['A', 'B'],
    })
  })

  it('lists each wildcard match path once, aligned with the result values', () => {
    const selected = selectResult(result, 'sections.react.components[*].name')
    expect(selected.selection.matchedPaths).toEqual([
      '/sections/react/components/0/name',
      '/sections/react/components/1/name',
    ])
    expect(JSON.stringify(selected).split('/sections/react/components/0/name')).toHaveLength(2)
  })

  it('returns an empty selection when a wildcard runs over an empty collection', () => {
    expect(selectResult({ components: [] }, 'components[*].name')).toMatchObject({
      status: 'ok',
      selection: { matchedPathCount: 0, matchedPaths: [] },
      result: [],
    })
    expect(selectResult({ groups: {} }, '/groups/*')).toMatchObject({ result: [] })
  })

  it('still rejects a wildcard path whose items lack the field', () => {
    expect(() => selectResult(result, 'sections.react.components[*].missing')).toThrow(
      ResultSelectionError,
    )
  })

  it('rejects no-match paths with bounded recovery guidance', () => {
    expect(() => selectResult(result, '/missing')).toThrow(ResultSelectionError)
    expect(() => selectResult(result, '/missing')).toThrow('/sections')
  })

  it('replaces oversized output with a bounded machine envelope', () => {
    const output = renderBoundedJson(
      { rows: Array.from({ length: 100 }, () => 'x'.repeat(50)) },
      512,
    )
    expect(Buffer.byteLength(`${output}\n`, 'utf8')).toBeLessThanOrEqual(512)
    expect(JSON.parse(output)).toMatchObject({
      schemaVersion: '2.0',
      status: 'truncated',
      reason: 'max_bytes',
      maxBytes: 512,
    })
  })

  it('names the heaviest selectable branches instead of their containers', () => {
    const bundle = {
      sections: {
        renders: {
          status: 'ok',
          result: { components: Array.from({ length: 40 }, () => 'x'.repeat(100)) },
        },
        effects: { status: 'ok', result: { events: ['x'.repeat(500)] } },
      },
      name: 'click',
    }
    expect(largestJsonPaths(bundle)).toEqual([
      { path: '/sections/renders/result/components', bytes: 4121, items: 40 },
      { path: '/sections/effects/result/events', bytes: 504, items: 1 },
      { path: '/name', bytes: 7 },
      { path: '/sections/renders/status', bytes: 4 },
      { path: '/sections/effects/status', bytes: 4 },
    ])
  })

  it('carries recovery hints and drops optional envelope detail to stay within the limit', () => {
    const value = { rows: Array.from({ length: 100 }, () => 'x'.repeat(50)) }
    const suggestions = [{ reason: 'Smaller page.', command: 'genie-react call t', argv: ['t'] }]
    const roomy = JSON.parse(
      renderBoundedJson(value, 2_000, (overflow) => {
        expect(overflow.largestPaths[0]).toMatchObject({ path: '/rows', items: 100 })
        return { outputPath: '/tmp/out.json', suggestions }
      }),
    )
    expect(roomy).toMatchObject({
      outputPath: '/tmp/out.json',
      largestPaths: [{ path: '/rows', items: 100 }],
      suggestions,
      topLevelPaths: ['/rows'],
    })
    const tight = renderBoundedJson(value, 512, () => ({
      outputPath: '/tmp/out.json',
      suggestions,
    }))
    expect(Buffer.byteLength(`${tight}\n`)).toBeLessThanOrEqual(512)
    expect(JSON.parse(tight)).toMatchObject({ status: 'truncated', outputPath: '/tmp/out.json' })
  })
})
