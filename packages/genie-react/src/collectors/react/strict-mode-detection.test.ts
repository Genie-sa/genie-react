// @vitest-environment jsdom
import './hook'
import { createElement, type ReactNode, StrictMode } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { mount, startCollector, unmountAll } from '../../test-support/react-app'
import { getStrictModeStatus } from './measurement-environment'

const genie = startCollector()

function Leaf(): ReactNode {
  return createElement('span', null, 'leaf')
}

function Panel({ children }: { children?: ReactNode }): ReactNode {
  return createElement('section', null, children)
}

afterEach(unmountAll)

describe('StrictMode detection from fiber mode bits', () => {
  it('reports on when every mounted component renders under StrictMode', async () => {
    await mount(createElement(StrictMode, null, createElement(Panel, null, createElement(Leaf))))

    expect(getStrictModeStatus()).toBe('on')
    expect((await genie.call<{ strictMode: string }>('react_clear_renders', {})).strictMode).toBe(
      'on',
    )
  })

  it('reports off for a tree without StrictMode', async () => {
    await mount(createElement(Panel, null, createElement(Leaf)))

    expect(getStrictModeStatus()).toBe('off')
  })

  it('reports partial when StrictMode wraps only part of the tree', async () => {
    await mount(createElement(Panel, null, createElement(StrictMode, null, createElement(Leaf))))

    expect(getStrictModeStatus()).toBe('partial')
  })

  it('stays unknown when no component is mounted instead of claiming off', () => {
    expect(getStrictModeStatus([])).toBe('unknown')
  })
})
