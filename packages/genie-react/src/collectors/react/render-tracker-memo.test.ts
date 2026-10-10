// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { type Fiber, getFiberFromHostInstance, getLatestFiber } from 'bippy'
import { Component, createElement, forwardRef, memo, PureComponent, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createCommitAnalysisBudget } from './render-commit-budget'
import { clearRenders, getRenders, recordRender } from './render-tracker'
import { canBailOutOnProps } from './work-tags'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

interface RowProps {
  id: string
  style: { color: string }
  onSelect?: () => void
}

const row = ({ id, style }: RowProps): ReactNode =>
  createElement('span', { 'data-testid': id, style }, id)

function Plain(props: RowProps): ReactNode {
  return row(props)
}
const SimpleMemoRow = memo(function SimpleMemoRow(props: RowProps): ReactNode {
  return row(props)
})
const CallbackRow = memo(function CallbackRow(props: RowProps): ReactNode {
  return row(props)
})
const MixedRow = memo(function MixedRow(props: RowProps): ReactNode {
  return row(props)
})
const ForwardMemoRow = memo(
  forwardRef<HTMLSpanElement, RowProps>(function ForwardMemoRow(props, _ref): ReactNode {
    return row(props)
  }),
)
class PureRow extends PureComponent<RowProps> {
  override render(): ReactNode {
    return row(this.props)
  }
}
// Genie never calls user code to learn what a custom shouldComponentUpdate compares.
class AlwaysUpdateRow extends Component<RowProps> {
  override shouldComponentUpdate(): boolean {
    return true
  }
  override render(): ReactNode {
    return row(this.props)
  }
}

const STABLE_STYLE = { color: 'red' }

function App(): ReactNode {
  return createElement(
    'div',
    null,
    createElement(Plain, { id: 'plain', style: { color: 'red' } }),
    createElement(SimpleMemoRow, { id: 'simple', style: { color: 'red' } }),
    createElement(CallbackRow, { id: 'callback', style: STABLE_STYLE, onSelect: () => {} }),
    createElement(MixedRow, { id: 'mixed', style: { color: 'red' }, onSelect: () => {} }),
    createElement(ForwardMemoRow, { id: 'forward', style: { color: 'red' } }),
    createElement(PureRow, { id: 'pure', style: { color: 'red' } }),
    createElement(AlwaysUpdateRow, { id: 'always', style: { color: 'red' } }),
  )
}

function ownerFiber(host: Element, owner: unknown): Fiber {
  const hostFiber = getFiberFromHostInstance(host)
  let fiber: Fiber | null = hostFiber ? getLatestFiber(hostFiber) : null
  while (fiber && fiber.elementType !== owner && fiber.type !== owner) fiber = fiber.return
  if (!fiber) throw new Error('owner fiber not found')
  return fiber
}

beforeEach(() => clearRenders())

describe('memo-aware render causes against a live React tree', () => {
  it('attributes prop churn to memo and pure components only', async () => {
    const view = render(createElement(App))
    await act(async () => view.rerender(createElement(App)))

    const host = (id: string) => view.getByTestId(id)
    const app = ownerFiber(host('plain'), App)
    const fibers = {
      Plain: ownerFiber(host('plain'), Plain),
      SimpleMemoRow: ownerFiber(host('simple'), SimpleMemoRow),
      CallbackRow: ownerFiber(host('callback'), CallbackRow),
      MixedRow: ownerFiber(host('mixed'), MixedRow),
      ForwardMemoRow: ownerFiber(host('forward'), ForwardMemoRow),
      PureRow: ownerFiber(host('pure'), PureRow),
      AlwaysUpdateRow: ownerFiber(host('always'), AlwaysUpdateRow),
    }
    expect(
      Object.fromEntries(Object.entries(fibers).map(([name, f]) => [name, canBailOutOnProps(f)])),
    ).toEqual({
      Plain: false,
      SimpleMemoRow: true,
      CallbackRow: true,
      MixedRow: true,
      ForwardMemoRow: true,
      PureRow: true,
      AlwaysUpdateRow: true,
    })

    const budget = createCommitAnalysisBudget(undefined, { now: () => 0 })
    budget.currentCommitEvidence.renderedFibers.add(app)
    for (const fiber of Object.values(fibers)) {
      recordRender(
        fiber,
        'update',
        undefined,
        budget.work,
        budget.currentCommitEvidence,
        budget.attributionWork,
      )
    }

    const reports = await getRenders({ sort: 'renders', limit: 20 })
    const byName = new Map(reports.map((entry) => [entry.name, entry]))
    expect(byName.get('Plain')).toMatchObject({
      necessity: 'unknown',
      referenceOnlyPropRenders: 0,
      causes: [
        { kind: 'parent', parentName: 'App' },
        { kind: 'props', name: 'style', referenceOnly: true },
      ],
    })
    expect(byName.get('SimpleMemoRow')).toMatchObject({
      necessity: 'unknown',
      referenceOnlyPropRenders: 1,
      causes: [{ kind: 'props', name: 'style', referenceOnly: true }],
    })
    expect(byName.get('CallbackRow')).toMatchObject({
      referenceOnlyPropRenders: 0,
      functionIdentityPropRenders: 1,
      causes: [{ kind: 'props', name: 'onSelect', referenceOnly: false }],
    })
    expect(byName.get('MixedRow')).toMatchObject({
      referenceOnlyPropRenders: 0,
      functionIdentityPropRenders: 1,
      undeterminedReferencePropRenders: 0,
    })
    expect(byName.get('ForwardMemoRow')).toMatchObject({ referenceOnlyPropRenders: 1 })
    expect(byName.get('PureRow')).toMatchObject({
      necessity: 'unknown',
      referenceOnlyPropRenders: 1,
      causes: [{ kind: 'props', name: 'style', referenceOnly: true }],
    })
    expect(byName.get('AlwaysUpdateRow')).toMatchObject({ referenceOnlyPropRenders: 1 })
  })
})
