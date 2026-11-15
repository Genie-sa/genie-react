import { describe, expect, it } from 'vitest'
import { HOLD_IDLE_MS, OwnershipLedger, TAB_CLAIM_IDLE_MS } from './ownership-ledger'

const scope = { tabKey: 'tab', documentId: 'doc' }

const clockedLedger = () => {
  let now = 1_000_000
  const ledger = new OwnershipLedger(() => now)
  return { ledger, advance: (ms: number) => (now += ms) }
}

describe('OwnershipLedger', () => {
  it('releases another caller hold only after it has been idle for the full hold period', () => {
    const { ledger, advance } = clockedLedger()
    ledger.overridesApplied('doc', 'holder')
    advance(HOLD_IDLE_MS - 1)
    ledger.recordDocumentUse('doc', 'holder')
    advance(HOLD_IDLE_MS - 1)
    expect(ledger.overrideHolders('doc', 'other')).toEqual({
      otherCallers: 1,
      ageMs: HOLD_IDLE_MS - 1,
    })
    advance(2)
    expect(ledger.overrideHolders('doc', 'other')).toBeNull()
    expect(ledger.overrideHolders('doc', 'holder')).toBeNull()
  })

  it('lets a tab claim lapse after the claim period so a stale agent cannot fence a tab forever', () => {
    const { ledger, advance } = clockedLedger()
    ledger.recordTabUse('tab', 'gone')
    expect(ledger.isClaimedByOthers('tab', 'newcomer')).toBe(true)
    expect(ledger.isClaimedByOthers('tab', 'gone')).toBe(false)
    advance(TAB_CLAIM_IDLE_MS + 1)
    expect(ledger.isClaimedByOthers('tab', 'newcomer')).toBe(false)
  })

  it('never fences a caller off a tab it used itself, even while others use it', () => {
    const { ledger } = clockedLedger()
    ledger.recordTabUse('tab', 'a')
    ledger.recordTabUse('tab', 'b')
    expect(ledger.isClaimedByOthers('tab', 'a')).toBe(false)
    expect(ledger.otherTabUsers('tab', 'a')).toBe(1)
  })

  it('reports the first disturbance of a window, not a later one', () => {
    const { ledger, advance } = clockedLedger()
    ledger.windowStarted(scope, 'owner', 'observation:1', 'react_clear_renders')
    advance(10)
    expect(ledger.windowInterrupted(scope, 'other', 'changed-state', 'react_override_props')).toBe(
      1,
    )
    advance(10)
    expect(ledger.windowStarted(scope, 'other', 'observation:2', 'react_clear_renders')).toBe(0)
    expect(ledger.windowConflict(scope, 'owner', 'observation:2')).toEqual({
      resource: 'render-window',
      cause: 'changed-state',
      tool: 'react_override_props',
      ageMs: 10,
    })
  })

  it('forgets the state a closed document held but remembers that its windows are gone', () => {
    const { ledger } = clockedLedger()
    ledger.windowStarted(scope, 'owner', 'observation:1', 'react_clear_renders')
    ledger.overridesApplied('doc', 'other')
    ledger.forgetDocument('doc')
    expect(ledger.overrideHolders('doc', 'owner')).toBeNull()
    expect(ledger.windowConflict({ tabKey: 'tab', documentId: 'next-doc' }, 'owner', null)).toEqual(
      { resource: 'render-window', cause: 'reloaded' },
    )
  })

  it('does not let a call on a new document disturb a window claimed on the old one', () => {
    const { ledger } = clockedLedger()
    ledger.windowStarted(scope, 'owner', 'observation:1', 'react_clear_renders')
    const next = { tabKey: 'tab', documentId: 'next-doc' }
    expect(ledger.windowStarted(next, 'other', 'observation:1', 'react_clear_renders')).toBe(0)
  })

  it('bounds the callers and tabs it tracks', () => {
    const { ledger } = clockedLedger()
    for (let index = 0; index < 1_000; index += 1) {
      ledger.recordTabUse(`tab-${index}`, `caller-${index}`)
      ledger.windowStarted(scope, `caller-${index}`, `observation:${index}`, 'react_clear_renders')
    }
    expect(ledger.otherTabUsers('tab-0', 'x')).toBe(0)
    expect(ledger.otherTabUsers('tab-999', 'x')).toBe(1)
    expect(ledger.windowConflict(scope, 'caller-0', 'observation:999')).toBeNull()
    expect(ledger.windowConflict(scope, 'caller-998', 'observation:999')?.cause).toBe('restarted')
  })
})
