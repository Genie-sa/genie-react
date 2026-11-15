import { quickFilterChanged } from '../../store/board'
import { useAppDispatch, useAppSelector } from '../../store/hooks'

export function BoardToolbar() {
  const dispatch = useAppDispatch()
  const quickFilter = useAppSelector((state) => state.board.quickFilter)
  return (
    <div className="board-toolbar">
      <input
        type="search"
        aria-label="Filter cards"
        placeholder="Filter cards"
        value={quickFilter}
        onChange={(event) => dispatch(quickFilterChanged(event.target.value))}
      />
    </div>
  )
}
