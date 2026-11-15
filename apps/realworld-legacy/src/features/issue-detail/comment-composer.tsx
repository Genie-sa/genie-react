import type { FormEvent } from 'react'
import { Button } from '../../components/button'

interface CommentComposerProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
}

export function CommentComposer({ value, onChange, onSubmit, disabled }: CommentComposerProps) {
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (value.trim()) onSubmit()
  }
  return (
    <form className="comment-composer" onSubmit={submit}>
      <textarea
        aria-label="Add a comment"
        placeholder="Add a comment…"
        rows={3}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <Button type="submit" variant="primary" size="sm" disabled={disabled || !value.trim()}>
        Comment
      </Button>
    </form>
  )
}
