import { cn } from '../../lib/cn'

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex gap-1 border-b border-slate-200 dark:border-slate-800"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={item.id === value}
          onClick={() => onChange(item.id)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
            item.id === value
              ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200',
          )}
        >
          {item.label}
          {item.count !== undefined && (
            <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs dark:bg-slate-800">
              {item.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
