import { afterEach, describe, expect, it, vi } from 'vitest'

describe('genie-react/tools', () => {
  afterEach(() => {
    vi.doUnmock('@tanstack/react-query')
    vi.doUnmock('@tanstack/react-router')
    vi.resetModules()
  })

  it('loads without TanStack installed', async () => {
    vi.resetModules()
    vi.doMock('@tanstack/react-query', () => {
      throw new Error('genie-react/tools imported @tanstack/react-query')
    })
    vi.doMock('@tanstack/react-router', () => {
      throw new Error('genie-react/tools imported @tanstack/react-router')
    })

    const tools = await import('./tools')

    expect(Object.keys(tools).sort()).toEqual([
      'GenieToolError',
      'defineGenieTool',
      'registerGenieTools',
      'useGenieTool',
      'useGenieTools',
    ])
  })
})
