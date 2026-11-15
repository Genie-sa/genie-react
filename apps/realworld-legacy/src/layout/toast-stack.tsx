import { useEffect } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { type Toast, toastDismissed } from '../store/ui'

const TOAST_LIFETIME_MS = 4000

function ToastMessage({ toast }: { toast: Toast }) {
  const dispatch = useAppDispatch()
  useEffect(() => {
    const timer = setTimeout(() => dispatch(toastDismissed(toast.id)), TOAST_LIFETIME_MS)
    return () => clearTimeout(timer)
  }, [dispatch, toast.id])
  return (
    <div className={`toast toast--${toast.tone}`} role="status">
      {toast.message}
    </div>
  )
}

export function ToastStack() {
  const toasts = useAppSelector((state) => state.ui.toasts)
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <ToastMessage key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
