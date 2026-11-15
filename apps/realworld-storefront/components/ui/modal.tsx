'use client'

import { useRouter } from 'next/navigation'
import { type ReactNode, useEffect, useRef } from 'react'

export function RouteModal({ title, children }: { title: string; children: ReactNode }): ReactNode {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: only backdrop clicks land on the dialog itself, and Escape already closes a modal dialog natively.
    <dialog
      ref={dialogRef}
      className="modal"
      aria-label={title}
      onClose={() => router.back()}
      onClick={(event) => {
        if (event.target === event.currentTarget) dialogRef.current?.close()
      }}
    >
      <div className="modal-body">
        <button
          type="button"
          className="modal-close"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
        >
          ×
        </button>
        {children}
      </div>
    </dialog>
  )
}
