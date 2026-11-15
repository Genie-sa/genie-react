import type { FormEvent } from 'react'
import { Button } from '../../components/button'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { viewApplied } from '../../store/issues'
import { draftNameChanged, viewDeleted, viewSaved } from '../../store/saved-views'

export function SavedViews() {
  const dispatch = useAppDispatch()
  const draftName = useAppSelector((state) => state.savedViews.draftName)
  const views = useAppSelector((state) => state.savedViews.views)
  const filters = useAppSelector((state) => state.issues.filters)
  const sort = useAppSelector((state) => state.issues.sort)

  const save = (event: FormEvent) => {
    event.preventDefault()
    if (draftName.trim()) dispatch(viewSaved(draftName.trim(), filters, sort))
  }

  return (
    <div className="saved-views">
      <form className="saved-views__form" onSubmit={save}>
        <input
          aria-label="View name"
          placeholder="Save current filters as…"
          value={draftName}
          onChange={(event) => dispatch(draftNameChanged(event.target.value))}
        />
        <Button type="submit" size="sm" disabled={!draftName.trim()}>
          Save view
        </Button>
      </form>
      {views.length > 0 && (
        <ul className="saved-views__list">
          {views.map((view) => (
            <li key={view.id}>
              <button
                type="button"
                className="link-button"
                onClick={() => dispatch(viewApplied(view))}
              >
                {view.name}
              </button>
              <button
                type="button"
                aria-label={`Delete ${view.name}`}
                className="link-button"
                onClick={() => dispatch(viewDeleted(view.id))}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
