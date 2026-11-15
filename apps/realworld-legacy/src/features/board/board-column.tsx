import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { IssueStatus } from '../../api/types'
import { selectCardsForColumn } from '../../store/board-selectors'
import { useAppSelector } from '../../store/hooks'
import { BoardCard } from './board-card'

interface BoardColumnProps {
  status: IssueStatus
  title: string
}

export function BoardColumn({ status, title }: BoardColumnProps) {
  const navigate = useNavigate()
  const cards = useAppSelector((state) => selectCardsForColumn(state, status))
  const openIssue = useCallback((key: string) => navigate(`/issues/${key}`), [navigate])

  return (
    <section className="board-column" aria-label={title}>
      <header className="board-column__header">
        <h2>{title}</h2>
        <span className="board-column__count">{cards.length}</span>
      </header>
      <ol className="board-column__cards">
        {cards.map((issue) => (
          <BoardCard key={issue.id} issue={issue} onOpen={openIssue} />
        ))}
      </ol>
    </section>
  )
}
