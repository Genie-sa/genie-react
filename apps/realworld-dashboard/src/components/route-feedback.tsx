import { type ErrorComponentProps, Link, useRouter } from '@tanstack/react-router'
import { ErrorPanel } from './ui/feedback'

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter()
  const retry = () => {
    reset()
    void router.invalidate()
  }
  return (
    <div className="p-6">
      <ErrorPanel
        title="This page could not be loaded"
        message={error instanceof Error ? error.message : 'Unknown error'}
        onRetry={retry}
      />
    </div>
  )
}

export function NotFound() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 text-center">
      <p className="text-4xl font-semibold text-slate-300">404</p>
      <p className="text-sm text-slate-500">We couldn’t find that page.</p>
      <Link to="/" className="text-sm font-medium text-indigo-600 hover:underline">
        Back to dashboard
      </Link>
    </div>
  )
}
