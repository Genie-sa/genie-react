import type { ReactNode } from 'react'
import * as React from 'react'
import { createRoot } from 'react-dom/client'
import * as testUtils from 'react-dom/test-utils'
import type { CollectorContext } from '../client'
import { reactCollector } from '../collectors/react/collector'

type Act = (callback: () => void | Promise<void>) => Promise<void>

/** React 18.3+ exports act from react; React 18.0-18.2 only from react-dom/test-utils. */
const reactAct = ((React as { act?: Act }).act ?? (testUtils as { act?: Act }).act) as Act

/** Real createRoot + act harness, independent of @testing-library so it runs against any aliased React 18 or 19 copy. */
export async function act(callback: () => void | Promise<void> = () => {}): Promise<void> {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  await reactAct(async () => {
    await callback()
  })
}

export interface MountedApp {
  container: HTMLElement
  render(node: ReactNode): Promise<void>
  unmount(): Promise<void>
}

const mounted = new Set<MountedApp>()

export async function mount(node: ReactNode): Promise<MountedApp> {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  const app: MountedApp = {
    container,
    render: (next) => act(() => root.render(next)),
    async unmount() {
      if (!mounted.delete(app)) return
      await act(() => root.unmount())
      container.remove()
    },
  }
  mounted.add(app)
  await app.render(node)
  return app
}

export async function unmountAll(): Promise<void> {
  for (const app of [...mounted]) await app.unmount()
}

export async function click(target: Element | null): Promise<void> {
  if (!target) throw new Error('click target is missing')
  await act(() => {
    target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

export function byText(container: ParentNode, text: string): HTMLElement {
  const match = [...container.querySelectorAll<HTMLElement>('*')].find(
    (element) => element.children.length === 0 && element.textContent === text,
  )
  if (!match) throw new Error(`No element with text ${JSON.stringify(text)}`)
  return match
}

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

/** Calls collector tools through their public contracts, the way the bridge does. */
export function startCollector(): {
  call<T>(name: string, input?: unknown): Promise<T>
  stop(): void
} {
  const collector = reactCollector()
  const stop = collector.start?.(context)
  return {
    async call<T>(name: string, input: unknown = {}): Promise<T> {
      const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
      if (!tool) throw new Error(`Missing tool ${name}`)
      return (await tool.handler(tool.contract.input.parse(input) as never, context)) as T
    },
    stop() {
      if (typeof stop === 'function') stop()
    },
  }
}
