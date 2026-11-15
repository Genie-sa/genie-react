import { cn } from '../../lib/cn'

const PALETTE = [
  'bg-indigo-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
  'bg-violet-500',
]

export function Avatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  const color =
    PALETTE[[...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % PALETTE.length]
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white',
        color,
        className,
      )}
    >
      {initials}
    </span>
  )
}
