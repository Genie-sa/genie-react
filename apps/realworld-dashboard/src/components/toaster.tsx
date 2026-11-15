import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useToastStore } from '../app/toasts'
import { cn } from '../lib/cn'

const ICONS = { success: CheckCircle2, error: XCircle, info: Info } as const
const TONES = { success: 'text-emerald-500', error: 'text-rose-500', info: 'text-sky-500' } as const

export function Toaster() {
  const toasts = useToastStore((state) => state.toasts)
  const dismiss = useToastStore((state) => state.dismiss)
  return (
    <ol
      aria-live="polite"
      aria-label="Notifications"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-80 flex-col gap-2"
    >
      {toasts.map((toast) => {
        const Icon = ICONS[toast.tone]
        return (
          <li
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className="pointer-events-auto flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <Icon className={cn('mt-0.5 size-4 shrink-0', TONES[toast.tone])} />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{toast.title}</p>
              {toast.description && <p className="text-slate-500">{toast.description}</p>}
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => dismiss(toast.id)}
              className="text-slate-400 hover:text-slate-700"
            >
              <X className="size-4" />
            </button>
          </li>
        )
      })}
    </ol>
  )
}
