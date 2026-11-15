export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="spinner" role="status">
      <span className="spinner__dot" aria-hidden />
      <span className="spinner__label">{label}…</span>
    </div>
  )
}
