// @vitest-environment jsdom

// biome-ignore-all lint/correctness/useExhaustiveDependencies: the effect depends on an object the parent re-creates on every render, which is the case under test

import './hook'
import { createElement, type ReactNode, useEffect, useState } from 'react'
import { afterAll, afterEach, expect, it, vi } from 'vitest'
import { byText, click, mount, startCollector, unmountAll } from '../../test-support/react-app'

vi.mock('bippy/source', () => ({
  getSource: async () => null,
  isSourceFile: (file: string) => !file.includes('/node_modules/'),
  normalizeFileName: (file: string) => file,
  getFiberHooks: () => [],
  symbolicateStack: async (frames: unknown[]) => frames,
}))

const genie = startCollector()
afterEach(unmountAll)
afterAll(() => genie.stop())

function Quote({ destination }: { destination: { country: string } }): ReactNode {
  const [failed, setFailed] = useState(false)
  useEffect(() => {}, [destination])
  return createElement(
    'button',
    {
      type: 'button',
      onClick: () => {
        setFailed(true)
        setFailed(false)
      },
    },
    `retry ${String(failed)} ${destination.country}`,
  )
}

function Checkout(): ReactNode {
  const [text, setText] = useState('')
  return createElement(
    'div',
    null,
    createElement('button', { type: 'button', onClick: () => setText(`${text}x`) }, 'type'),
    createElement(Quote, { destination: { country: 'NO' } }),
  )
}

// Two updates that cancel out make React render the child and then bail out, which keeps the previous effect queue beside the new hook list.
it('names the changed slot on every run after the child rendered and bailed out in between', async () => {
  const app = await mount(createElement(Checkout))
  await genie.call('react_clear_renders', { budget: { timeLimitMs: 500, adaptive: false } })
  for (let keystroke = 0; keystroke < 4; keystroke += 1) {
    await click(byText(app.container, 'type'))
    await click(byText(app.container, 'retry false NO'))
  }
  const timeline = await genie.call<{
    events: { componentName: string; changedDependencySlots: number[] }[]
  }>('react_effect_timeline', { component: 'Quote', limit: 50, appOnly: false })
  const slots = timeline.events.map((event) => event.changedDependencySlots)
  expect(slots).toHaveLength(4)
  expect(slots).toEqual([[0], [0], [0], [0]])
})
