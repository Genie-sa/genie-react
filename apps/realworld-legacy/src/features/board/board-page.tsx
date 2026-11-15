import { useEffect } from 'react'
import { PageHeader } from '../../components/page-header'
import { Spinner } from '../../components/spinner'
import { BOARD_COLUMNS } from '../../store/board-selectors'
import { fetchBoard } from '../../store/board'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { BoardColumn } from './board-column'
import { BoardToolbar } from './board-toolbar'

export function BoardPage() {
  const dispatch = useAppDispatch()
  const projectKey = useAppSelector((state) => state.board.projectKey)
  const status = useAppSelector((state) => state.board.status)
  const projectName = useAppSelector(
    (state) => state.projects.byKey[projectKey]?.name ?? projectKey,
  )

  useEffect(() => {
    dispatch(fetchBoard(projectKey))
  }, [dispatch, projectKey])

  return (
    <div className="board-page">
      <PageHeader title={`${projectName} board`} actions={<BoardToolbar />} />
      {status === 'loading' && <Spinner label="Loading board" />}
      <div className="board">
        {BOARD_COLUMNS.map((column) => (
          <BoardColumn key={column.status} status={column.status} title={column.title} />
        ))}
      </div>
    </div>
  )
}
