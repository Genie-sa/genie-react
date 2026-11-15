import { X } from 'lucide-react'
import { type ReactNode, useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'

interface OverlayProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
}

function useEscape(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])
}

function OverlayFrame({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  placement,
}: OverlayProps & { placement: 'center' | 'right' }) {
  const titleId = useId()
  useEscape(open, onClose)
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-40 flex">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-950/40"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          'relative z-10 flex flex-col bg-white shadow-xl dark:bg-slate-900',
          placement === 'center'
            ? 'm-auto max-h-[85vh] w-full max-w-lg rounded-lg'
            : 'ml-auto h-full w-full max-w-md',
        )}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div>
            <h2 id={titleId} className="text-base font-semibold">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-800">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}

export function Modal(props: OverlayProps) {
  return <OverlayFrame {...props} placement="center" />
}

export function Drawer(props: OverlayProps) {
  return <OverlayFrame {...props} placement="right" />
}
