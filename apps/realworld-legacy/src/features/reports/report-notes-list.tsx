import { PureComponent } from 'react'
import { connect } from 'react-redux'
import type { RootState } from '../../store'
import { removeReportNote } from './state/actions'
import { selectReportNotes } from './state/selectors'
import type { ReportNote } from './state/types'

interface ReportNotesListProps {
  notes: ReportNote[]
  removeReportNote: (id: string) => unknown
}

class ReportNotesList extends PureComponent<ReportNotesListProps> {
  render() {
    const { notes } = this.props
    if (notes.length === 0) return <p className="muted">No notes for this report yet</p>
    return (
      <ul className="report-notes__list">
        {notes.map((note) => (
          <li key={note.id} className="report-note">
            <span>{note.text}</span>
            <span className="muted">
              {note.authorName} · {note.range}
            </span>
            <button
              type="button"
              className="link-button"
              onClick={() => this.props.removeReportNote(note.id)}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    )
  }
}

export default connect((state: RootState) => ({ notes: selectReportNotes(state) }), {
  removeReportNote,
})(ReportNotesList)
