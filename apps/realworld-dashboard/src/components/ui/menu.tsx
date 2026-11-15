import { MoreHorizontal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

export interface MenuItem {
  id: string
  label: string
  tone?: 'default' | 'danger'
  disabled?: boolean
  onSelect: () => void
}

export function ActionMenu({ label, items }: { label: string; items: readonly MenuItem[] }) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
      >
        <MoreHorizontal className="size-4" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
              className={cn(
                'block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40 dark:hover:bg-slate-800',
                item.tone === 'danger' && 'text-rose-600',
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
