import { forwardRef, createElement as h, memo, type ReactNode } from 'react'

export function Card(): ReactNode {
  return h('div', { id: 'card' }, h(CardTitle, null))
}

export function CardTitle(): ReactNode {
  return h('h2', null, 'title')
}

export const Badge = memo(function Badge(): ReactNode {
  return h('i', null, 'badge')
})

export const Field = forwardRef<HTMLInputElement>(function Field(_props, ref) {
  return h('input', { ref })
})

function renderRow(label: string): ReactNode {
  return h(Row, { key: label, label })
}

function Row({ label }: { label: string }): ReactNode {
  return h('li', null, label)
}

export function Page(): ReactNode {
  return h(
    'main',
    null,
    h(Card, null),
    h(Badge, null),
    h(Field, null),
    h('ul', null, ['a', 'b'].map(renderRow)),
  )
}
