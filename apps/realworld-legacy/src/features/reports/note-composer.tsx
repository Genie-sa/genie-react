import { Component, type FormEvent } from 'react'
import { connect } from 'react-redux'
import type { ReportRange } from '../../api/types'
import { Button } from '../../components/button'
import { type CurrentUserProps, withCurrentUser } from '../../hocs/with-current-user'
import type { RootState } from '../../store'
import { addReportNote } from './state/actions'

interface NoteComposerProps extends CurrentUserProps {
  range: ReportRange
  addReportNote: (text: string, authorName: string, range: ReportRange) => unknown
}

class NoteComposer extends Component<NoteComposerProps, { text: string }> {
  state = { text: '' }

  submit = (event: FormEvent) => {
    event.preventDefault()
    const text = this.state.text.trim()
    if (!text) return
    this.props.addReportNote(text, this.props.currentUser?.name ?? 'Someone', this.props.range)
    this.setState({ text: '' })
  }

  render() {
    return (
      <form className="note-composer" onSubmit={this.submit}>
        <input
          aria-label="Report note"
          placeholder="Add a note for this report"
          value={this.state.text}
          onChange={(event) => this.setState({ text: event.target.value })}
        />
        <Button type="submit" size="sm">
          Add note
        </Button>
      </form>
    )
  }
}

export default withCurrentUser(
  connect((state: RootState) => ({ range: state.reports.range }), { addReportNote })(NoteComposer),
)
