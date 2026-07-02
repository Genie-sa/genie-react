import { describe, expect, it, vi } from 'vitest'
import { trapHandler } from './hook-guard'

function hookWith(handler: (...args: unknown[]) => void): Record<string, unknown> {
  return { onCommitFiberRoot: handler }
}

describe('trapHandler', () => {
  it('keeps the original handler firing after a later writer assigns over it', () => {
    const original = vi.fn()
    const hook = hookWith(original)
    trapHandler(hook, 'onCommitFiberRoot')

    const laterWriter = vi.fn()
    hook.onCommitFiberRoot = laterWriter
    ;(hook.onCommitFiberRoot as (...args: unknown[]) => void)(1, 'root')

    expect(original).toHaveBeenCalledWith(1, 'root')
    expect(laterWriter).toHaveBeenCalledWith(1, 'root')
  })

  it('does not recurse when the later writer wraps and calls the previous handler', () => {
    const original = vi.fn()
    const hook = hookWith(original)
    trapHandler(hook, 'onCommitFiberRoot')

    const previous = hook.onCommitFiberRoot as (...args: unknown[]) => void
    const wrapping = vi.fn((...args: unknown[]) => previous(...args))
    hook.onCommitFiberRoot = wrapping
    ;(hook.onCommitFiberRoot as (...args: unknown[]) => void)('x')

    expect(original).toHaveBeenCalledTimes(1)
    expect(wrapping).toHaveBeenCalledTimes(1)
  })

  it('leaves non-function handlers untouched', () => {
    const hook: Record<string, unknown> = { onCommitFiberRoot: undefined }
    trapHandler(hook, 'onCommitFiberRoot')
    expect(hook.onCommitFiberRoot).toBeUndefined()
  })
})
