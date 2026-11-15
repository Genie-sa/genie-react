import type { InputHTMLAttributes, ReactNode } from 'react'

export function TextField({
  label,
  error,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string
  name: string
  error?: string
}): ReactNode {
  const errorId = `${input.name}-error`
  return (
    <label className="field">
      <span>{label}</span>
      <input
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
      />
      {error ? (
        <span id={errorId} className="field-error">
          {error}
        </span>
      ) : null}
    </label>
  )
}
