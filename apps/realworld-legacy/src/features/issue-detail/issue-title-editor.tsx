import { Component, type FormEvent } from 'react'
import { connect } from 'react-redux'
import type { Issue } from '../../api/types'
import { service } from '../../api/service'
import type { AppDispatch } from '../../store'

interface IssueTitleEditorProps {
  issue: Issue
  saveTitle: (key: string, title: string) => unknown
}

interface IssueTitleEditorState {
  isEditing: boolean
  draft: string
}

class IssueTitleEditor extends Component<IssueTitleEditorProps, IssueTitleEditorState> {
  state: IssueTitleEditorState = { isEditing: false, draft: this.props.issue.title }

  componentDidUpdate(prevProps: IssueTitleEditorProps) {
    if (prevProps.issue !== this.props.issue) {
      this.setState({ draft: this.props.issue.title })
    }
  }

  startEditing = () => this.setState({ isEditing: true })

  cancel = () => this.setState({ isEditing: false, draft: this.props.issue.title })

  save = (event: FormEvent) => {
    event.preventDefault()
    const title = this.state.draft.trim()
    if (title && title !== this.props.issue.title) this.props.saveTitle(this.props.issue.key, title)
    this.setState({ isEditing: false })
  }

  render() {
    const { issue } = this.props
    if (!this.state.isEditing) {
      return (
        <h1 className="issue-title">
          <button
            type="button"
            className="issue-title__display"
            onClick={this.startEditing}
            title="Click to rename"
          >
            {issue.title}
          </button>
        </h1>
      )
    }
    return (
      <form className="issue-title issue-title--editing" onSubmit={this.save}>
        <input
          aria-label="Issue title"
          value={this.state.draft}
          onChange={(event) => this.setState({ draft: event.target.value })}
        />
        <button type="submit">Save</button>
        <button type="button" onClick={this.cancel}>
          Cancel
        </button>
      </form>
    )
  }
}

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  saveTitle: (key: string, title: string) =>
    dispatch(service.endpoints.updateIssue.initiate({ key, changes: { title } })),
})

export default connect(null, mapDispatchToProps)(IssueTitleEditor)
