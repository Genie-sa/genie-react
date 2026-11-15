import { type ComponentProps, type ReactNode, useId } from 'react'
import { cn } from '../../lib/cn'

const CONTROL =
  'block w-full rounded-md border border-slate-300 bg-white px-3 text-sm shadow-xs placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none disabled:bg-slate-100 aria-invalid:border-rose-500 dark:border-slate-700 dark:bg-slate-900'

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn(CONTROL, 'min-h-24 py-2', className)} {...props} />
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL, 'h-9 pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Checkbox({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <input
      type="checkbox"
      className={cn(
        'size-4 rounded border-slate-300 accent-indigo-600 dark:border-slate-600',
        className,
      )}
      {...props}
    />
  )
}

export function Field({
  label,
  error,
  hint,
  children,
}: {
  label: string
  error?: string
  hint?: string
  children: (id: string) => ReactNode
}) {
  const id = useId()
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs font-medium text-slate-700 dark:text-slate-300">
        {label}
      </label>
      {children(id)}
      {error ? (
        <p role="alert" className="text-xs text-rose-600">
          {error}
        </p>
      ) : (
        hint && <p className="text-xs text-slate-500">{hint}</p>
      )}
    </div>
  )
}
