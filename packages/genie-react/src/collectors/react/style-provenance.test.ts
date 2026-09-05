import { describe, expect, it } from 'vitest'
import {
  describeElementStyles,
  indexStyleRules,
  isStyleMarkerClass,
  parseStyleSources,
  styleObjectsFor,
  styleProvenanceStatus,
} from './style-provenance'

describe('parseStyleSources', () => {
  it('splits the package prefix from the file — only the trailing :line is positional', () => {
    expect(parseStyleSources('@scope/pkg:src/PricingCard.tsx:5')).toEqual([
      { package: '@scope/pkg', file: 'src/PricingCard.tsx', line: 5 },
    ])
  })

  it('preserves application order across entries', () => {
    expect(parseStyleSources('a.tsx:1; b.tsx:2; a.tsx:9')).toEqual([
      { package: null, file: 'a.tsx', line: 1 },
      { package: null, file: 'b.tsx', line: 2 },
      { package: null, file: 'a.tsx', line: 9 },
    ])
  })

  it('reports a null line for entries without a trailing line number', () => {
    expect(parseStyleSources('injected-styles')).toEqual([
      { package: null, file: 'injected-styles', line: null },
    ])
  })

  it('drops empty segments and returns [] for null input', () => {
    expect(parseStyleSources('a.tsx:1;; ')).toEqual([{ package: null, file: 'a.tsx', line: 1 }])
    expect(parseStyleSources(null)).toEqual([])
  })
})

describe('styleObjectsFor', () => {
  it('names each source from the positionally matching marker class', () => {
    const objects = styleObjectsFor(
      ['Card__styles.root', 'x1', 'Card__emphasis.featured', 'x2'],
      parseStyleSources('app:src/Card.tsx:5; app:src/Card.tsx:29'),
    )
    expect(objects.map((o) => [o.name, o.line])).toEqual([
      ['styles.root', 5],
      ['emphasis.featured', 29],
    ])
  })

  it('leaves names null when marker and source counts disagree', () => {
    const objects = styleObjectsFor(['Card__styles.root'], parseStyleSources('a.tsx:1; b.tsx:2'))
    expect(objects.map((o) => o.name)).toEqual([null, null])
  })

  it('falls back to marker names alone when data-style-src is absent', () => {
    expect(styleObjectsFor(['Card__styles.root', 'x1'], [])).toEqual([
      { name: 'styles.root', package: null, file: null, line: null },
    ])
  })

  it('recognises marker classes and rejects atomic/utility classes', () => {
    expect(isStyleMarkerClass('PricingCard__styles.card')).toBe(true)
    expect(isStyleMarkerClass('borderColor-x1xsh3er')).toBe(false)
    expect(isStyleMarkerClass('md:flex')).toBe(false)
  })
})

// Duck-typed CSSOM: enough shape for the walker, no jsdom parser limitations around @layer / :not(#\#).
const declaration = (entries: Record<string, string>): CSSStyleDeclaration =>
  ({
    cssText: Object.entries(entries)
      .map(([property, value]) => `${property}: ${value};`)
      .join(' '),
  }) as unknown as CSSStyleDeclaration

const styleRule = (selectorText: string, entries: Record<string, string>): CSSRule =>
  ({ selectorText, style: declaration(entries) }) as unknown as CSSRule

const groupRule = (rules: CSSRule[], extra: Record<string, unknown> = {}): CSSRule =>
  ({ cssRules: rules, ...extra }) as unknown as CSSRule

const fakeDocument = (rules: CSSRule[], computed: Record<string, string> = {}): Document =>
  ({
    styleSheets: [{ cssRules: rules }],
    defaultView: {
      getComputedStyle: () => ({
        getPropertyValue: (name: string) => computed[name] ?? '',
      }),
    },
  }) as unknown as Document

const fakeElement = (opts: {
  classes: string[]
  styleSrc?: string
  inline?: Record<string, string>
  doc: Document
}): Element => {
  const inline = opts.inline ?? {}
  const inlineKeys = Object.keys(inline)
  return {
    classList: opts.classes,
    getAttribute: (name: string) => (name === 'data-style-src' ? (opts.styleSrc ?? null) : null),
    ownerDocument: opts.doc,
    style: {
      length: inlineKeys.length,
      item: (i: number) => inlineKeys[i] ?? '',
      getPropertyValue: (name: string) => inline[name] ?? '',
    },
  } as unknown as Element
}

describe('indexStyleRules + describeElementStyles', () => {
  const doc = fakeDocument(
    [
      groupRule(
        [
          styleRule('.borderColor-x1a', { 'border-color': 'rgb(228, 81, 30)' }),
          styleRule('.color-x2b:not(#\\#):hover', { color: 'var(--accent-x9z)' }),
          groupRule([styleRule('.padding-x3c', { padding: '28px' })], {
            conditionText: '(min-width: 48rem)',
            media: {},
          }),
          styleRule('.compound-a.compound-b', { gap: '1px' }),
        ],
        { name: 'priority2' },
      ),
    ],
    { '--accent-x9z': '#e4511e' },
  )
  const index = indexStyleRules(doc)

  it('resolves each atomic class to its declaration, condition, and tokens', () => {
    const info = describeElementStyles(
      fakeElement({
        classes: ['Card__styles.root', 'borderColor-x1a', 'color-x2b', 'padding-x3c'],
        styleSrc: 'app:src/Card.tsx:5',
        doc,
      }),
      index,
    )
    expect(info.styleObjects).toEqual([
      { name: 'styles.root', package: 'app', file: 'src/Card.tsx', line: 5 },
    ])
    expect(info.declarations).toEqual([
      {
        property: 'border-color',
        value: 'rgb(228, 81, 30)',
        condition: null,
        className: 'borderColor-x1a',
        tokens: [],
      },
      {
        property: 'color',
        value: 'var(--accent-x9z)',
        condition: ':hover',
        className: 'color-x2b',
        tokens: [{ variable: '--accent-x9z', name: 'accent', value: '#e4511e' }],
      },
      {
        property: 'padding',
        value: '28px',
        condition: '@media (min-width: 48rem)',
        className: 'padding-x3c',
        tokens: [],
      },
    ])
    expect(info.unresolvedClasses).toEqual([])
  })

  it('reports shorthands as authored instead of expanding them into longhands', () => {
    const shorthandDoc = fakeDocument([
      styleRule('.padding-x9', { padding: '20px' }),
      styleRule('.borderColor-x8', { 'border-color': 'red' }),
    ])
    const info = describeElementStyles(
      fakeElement({ classes: ['padding-x9', 'borderColor-x8'], doc: shorthandDoc }),
      indexStyleRules(shorthandDoc),
    )
    expect(info.declarations.map((d) => `${d.property}: ${d.value}`)).toEqual([
      'padding: 20px',
      'border-color: red',
    ])
  })

  it('skips compound selectors unless every class is present, and reports unmatched classes', () => {
    const info = describeElementStyles(
      fakeElement({ classes: ['compound-a', 'card', 'md:flex'], doc }),
      index,
    )
    expect(info.declarations).toEqual([])
    expect(info.unresolvedClasses).toEqual(['card', 'md:flex'])
  })

  it('surfaces inline custom properties as dynamic values', () => {
    const info = describeElementStyles(
      fakeElement({ classes: [], inline: { '--x-width': '40%', color: 'red' }, doc }),
      index,
    )
    expect(info.dynamic).toEqual([{ variable: '--x-width', value: '40%' }])
  })
})

describe('styleProvenanceStatus', () => {
  const emptyInfo = { styleObjects: [], declarations: [], dynamic: [], unresolvedClasses: [] }

  it('explains how to enable provenance when nothing is emitted', () => {
    const status = styleProvenanceStatus([emptyInfo])
    expect(status.system).toBe('none')
    expect(status.hint).toContain('debug: true')
  })

  it('asks for debug mode when only marker classes are present', () => {
    const markerOnly = {
      ...emptyInfo,
      styleObjects: [{ name: 'styles.root', package: null, file: null, line: null }],
    }
    const status = styleProvenanceStatus([markerOnly])
    expect(status).toMatchObject({ system: 'stylex', styleSrc: false })
    expect(status.hint).toContain('data-style-src')
  })

  it('is silent when file:line provenance is present', () => {
    const info = {
      ...emptyInfo,
      styleObjects: [{ name: null, package: null, file: 'a.tsx', line: 1 }],
    }
    expect(styleProvenanceStatus([info])).toEqual({ system: 'stylex', styleSrc: true, hint: null })
  })
})
