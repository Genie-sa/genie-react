import { describe, expect, it } from 'vitest'
import { movedPageLocation } from './moved-pages'

describe('movedPageLocation', () => {
  it('sends a removed page to its new section', () => {
    expect(movedPageLocation('/docs/setup/nextjs')).toBe('/docs/getting-started/install#nextjs')
  })

  it('keeps a markdown request on a markdown URL without the fragment', () => {
    expect(movedPageLocation('/docs/setup/nextjs.md')).toBe('/docs/getting-started/install.md')
    expect(movedPageLocation('/docs/getting-started.md')).toBe('/docs/getting-started/install.md')
  })

  it('leaves pages that still exist alone', () => {
    expect(movedPageLocation('/docs/tools/timeline')).toBeNull()
    expect(movedPageLocation('/docs/getting-started/install')).toBeNull()
    expect(movedPageLocation('/docs/index.md')).toBeNull()
  })
})
