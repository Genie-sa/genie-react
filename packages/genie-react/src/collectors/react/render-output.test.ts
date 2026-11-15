import type { Fiber } from 'bippy'
import { describe, expect, it } from 'vitest'
import { createCommitWorkBudget } from './commit-budget'
import {
  attributeCommitOutput,
  type CommitRenderFacts,
  classifyHostProp,
  gradeRender,
  type OutputTally,
} from './render-output'
import { defaultWorkTags } from './work-tags'

const UPDATE = 0b100
const CHILD_DELETION = 0b1_0000

interface FakeFiber {
  tag: number
  type: unknown
  flags: number
  index: number
  memoizedProps: unknown
  alternate: FakeFiber | null
  child: FakeFiber | null
  sibling: FakeFiber | null
  return: FakeFiber | null
  lanes: number
}

function fiber(
  tag: number,
  type: unknown,
  props: unknown,
  previousProps: unknown = props,
  flags = 0,
): FakeFiber {
  const node: FakeFiber = {
    tag,
    type,
    flags,
    index: 0,
    memoizedProps: props,
    alternate: null,
    child: null,
    sibling: null,
    return: null,
    lanes: 0,
  }
  node.alternate = { ...node, memoizedProps: previousProps, flags: 0, alternate: node }
  return node
}

function host(type: string, props: object, previousProps: object = props): FakeFiber {
  return fiber(defaultWorkTags.HostComponent, type, props, previousProps, UPDATE)
}

function component(name: string): FakeFiber {
  return fiber(
    defaultWorkTags.FunctionComponent,
    Object.assign(() => null, { displayName: name }),
    {},
  )
}

function link(parent: FakeFiber, ...children: FakeFiber[]): FakeFiber {
  parent.child = children[0] ?? null
  children.forEach((child, index) => {
    child.return = parent
    child.index = index
    if (child.alternate) child.alternate.index = index
    child.sibling = children[index + 1] ?? null
  })
  return parent
}

const facts = (overrides: Partial<CommitRenderFacts> = {}): CommitRenderFacts => ({
  propsEquivalent: false,
  ownUpdate: false,
  changedContexts: [],
  effects: 0,
  effectsComplete: true,
  ...overrides,
})

function attribute(
  rendered: FakeFiber[],
  renderFacts: [FakeFiber, CommitRenderFacts][] = [],
  operationLimit?: number,
): Map<Fiber, OutputTally> {
  return attributeCommitOutput({
    rendered: new Set(rendered as unknown as Fiber[]),
    facts: new Map(renderFacts as unknown as [Fiber, CommitRenderFacts][]),
    commitWork:
      operationLimit === undefined ? undefined : createCommitWorkBudget({ operationLimit }),
  })
}

const tallyOf = (tallies: Map<Fiber, OutputTally>, node: FakeFiber) =>
  tallies.get(node as unknown as Fiber)

describe('host prop classification mirrors the renderer diff', () => {
  it.each<[string, unknown, unknown, ReturnType<typeof classifyHostProp>]>([
    ['onClick', () => 1, () => 2, 'callback'],
    ['onClick', null, () => 2, 'callback'],
    ['ref', () => 1, () => 2, 'callback'],
    ['formAction', () => 1, () => 2, 'callback'],
    ['onClick', 'alert(1)', () => 2, 'unknown'],
    ['style', { color: 'red', padding: 4 }, { color: 'red', padding: 4 }, 'none'],
    ['style', { color: 'red' }, { color: 'blue' }, 'write'],
    ['style', [{ flex: 1 }, { margin: 2 }], [{ flex: 1 }, { margin: 2 }], 'none'],
    ['className', 'a', 'b', 'write'],
    ['children', 1, '1', 'none'],
    ['children', 'a', 'b', 'write'],
    ['children', 'text', { $$typeof: Symbol.for('react.element') }, 'write'],
    ['children', [1], [2], 'none'],
    ['dangerouslySetInnerHTML', { __html: '<b>1</b>' }, { __html: '<b>1</b>' }, 'none'],
    ['dangerouslySetInnerHTML', { __html: '<b>1</b>' }, { __html: '<b>2</b>' }, 'write'],
    ['data-when', new Date(1), new Date(1), 'unknown'],
    ['autoFocus', true, false, 'none'],
  ])('%s %o -> %o is %s', (key, before, after, expected) => {
    expect(classifyHostProp(key, before, after)).toBe(expected)
  })
})

describe('commit output attribution', () => {
  it('counts only the component descendants, never its sibling', () => {
    const owned = host('p', { className: 'a' }, { className: 'b' })
    const sibling = host('p', { className: 'a' }, { className: 'b' })
    const card = link(component('Card'), owned)
    link(fiber(defaultWorkTags.HostRoot, null, {}), card, sibling)

    const tallies = attribute([card, owned, sibling], [[card, facts()]])

    expect(tallyOf(tallies, card)).toMatchObject({ writes: 1, writeLabels: ['p.className'] })
  })

  it('ignores flags under a child React did not reconcile in this commit', () => {
    const stale = host('p', { className: 'a' }, { className: 'b' })
    const bailedOut = link(component('Skipped'), stale)
    const card = link(component('Card'), bailedOut)

    const tallies = attribute([card], [[card, facts()]])

    expect(tallyOf(tallies, card)).toMatchObject({ writes: 0, complete: true })
  })

  it('reads through unreported fragments that React reconciled', () => {
    const text = fiber(defaultWorkTags.HostText, null, 'b', 'a', UPDATE)
    const fragment = link(fiber(defaultWorkTags.Fragment, null, [1], [0]), text)
    const card = link(component('Card'), fragment)

    const tallies = attribute([card, text], [[card, facts()]])

    expect(tallyOf(tallies, card)).toMatchObject({ writes: 1, writeLabels: ['#text'] })
  })

  it('counts a removal on the parent that lost a child', () => {
    const card = component('Card')
    card.flags = CHILD_DELETION

    expect(tallyOf(attribute([card], [[card, facts()]]), card)).toMatchObject({
      writes: 1,
      writeLabels: ['Card:remove-child'],
    })
  })

  it('leaves a child that rendered for its own update in charge of its writes', () => {
    const owned = host('output', { children: 2 }, { children: 1 })
    const counter = link(component('Counter'), owned)
    const page = link(component('Page'), counter)

    const tallies = attribute(
      [page, counter, owned],
      [
        [page, facts()],
        [counter, facts({ propsEquivalent: true, ownUpdate: true })],
      ],
    )

    expect(tallyOf(tallies, counter)?.writes).toBe(1)
    expect(tallyOf(tallies, page)).toMatchObject({ writes: 0, complete: true })
  })

  it('passes up only writes from a child whose inputs were equal', () => {
    const button = host('button', { onClick: () => 2 }, { onClick: () => 1 })
    const row = link(component('Row'), button)
    const list = link(component('List'), row)

    const tallies = attribute(
      [list, row, button],
      [
        [list, facts()],
        [row, facts({ propsEquivalent: true, ownUpdate: false, effects: 1 })],
      ],
    )

    expect(tallyOf(tallies, row)).toMatchObject({ callbackOnlyUpdates: 1, effects: 1 })
    expect(tallyOf(tallies, list)).toMatchObject({ callbackOnlyUpdates: 0, effects: 0 })
  })

  it('never claims complete output when a child cannot say why it rendered', () => {
    const row = component('Row')
    const list = link(component('List'), row)

    const tallies = attribute(
      [list, row],
      [
        [list, facts()],
        [row, facts({ propsEquivalent: true, ownUpdate: null })],
      ],
    )

    expect(tallyOf(tallies, list)?.complete).toBe(false)
  })

  it('marks output incomplete when a rendered child was not analyzed', () => {
    const row = component('Row')
    const list = link(component('List'), row)

    expect(tallyOf(attribute([list, row], [[list, facts()]]), list)?.complete).toBe(false)
  })

  it('marks output incomplete instead of guessing once its budget runs out', () => {
    const owned = host('p', { className: 'a' }, { className: 'b' })
    const card = link(component('Card'), owned)

    const tallies = attribute([card, owned], [[card, facts()]], 1)

    expect(tallyOf(tallies, card)?.complete).toBe(false)
  })
})

describe('necessity grading', () => {
  const output = (overrides: Partial<OutputTally> = {}): OutputTally => ({
    writes: 0,
    callbackOnlyUpdates: 0,
    effects: 0,
    complete: true,
    writeLabels: [],
    callbackLabels: [],
    ...overrides,
  })

  it.each([
    ['a mount', 'mount', false, null, 'necessary', 'mount'],
    ['a host write', 'update', true, output({ writes: 1 }), 'necessary', 'dom-changed'],
    ['equal inputs', 'update', true, null, 'unnecessary', 'inputs-unchanged'],
    ['no output change', 'update', false, output(), 'unnecessary', 'output-unchanged'],
    [
      'new callbacks only',
      'update',
      false,
      output({ callbackOnlyUpdates: 1 }),
      'unknown',
      'callbacks-changed',
    ],
    ['scheduled effects', 'update', false, output({ effects: 1 }), 'unknown', 'effects-scheduled'],
    [
      'partial output',
      'update',
      false,
      output({ complete: false }),
      'unknown',
      'output-incomplete',
    ],
    ['unobserved output', 'update', false, null, 'unknown', 'output-incomplete'],
  ] as const)('grades %s', (_label, phase, equivalent, tally, necessity, necessityReason) => {
    expect(gradeRender(phase, equivalent, tally)).toEqual({ necessity, necessityReason })
  })
})
