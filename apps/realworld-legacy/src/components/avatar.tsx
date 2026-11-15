const PALETTE = ['#4f6bed', '#d9534f', '#3c9d6b', '#c27c0e', '#8e44ad', '#16a2b8']

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  const color = PALETTE[name.length % PALETTE.length]
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: color, fontSize: size * 0.42 }}
      title={name}
    >
      {initialsOf(name)}
    </span>
  )
}
