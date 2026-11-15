import { Component } from 'react'
import { connect } from 'react-redux'
import type { Issue } from '../../api/types'
import { Pagination } from '../../components/pagination'
import { Spinner } from '../../components/spinner'
import { type RouterProps, withRouter } from '../../hocs/with-router'
import type { RootState } from '../../store'
import { selectIssuePage } from '../../store/issue-selectors'
import {
  type IssueSort,
  PAGE_SIZES,
  pageChanged,
  pageSizeChanged,
  selectionToggled,
  type SortField,
  sortChanged,
} from '../../store/issues'
import { IssueRow } from './issue-row'
import { IssueTableHeader } from './issue-table-header'

interface IssueTableProps extends RouterProps {
  rows: Issue[]
  total: number
  pageCount: number
  page: number
  pageSize: number
  sort: IssueSort
  selectedIds: string[]
  status: RootState['issues']['status']
  pageChanged: (page: number) => unknown
  pageSizeChanged: (size: number) => unknown
  selectionToggled: (id: string) => unknown
  sortChanged: (field: SortField) => unknown
}

class IssueTable extends Component<IssueTableProps> {
  openIssue = (key: string) => this.props.router.navigate(`/issues/${key}`)

  render() {
    const { rows, total, page, pageCount, pageSize, sort, selectedIds, status } = this.props
    if (status === 'loading' || status === 'idle') return <Spinner label="Loading issues" />
    return (
      <div className="issue-table">
        <table>
          <IssueTableHeader sort={sort} onSort={this.props.sortChanged} />
          <tbody>
            {rows.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                selected={selectedIds.includes(issue.id)}
                onToggle={() => this.props.selectionToggled(issue.id)}
                onOpen={this.openIssue}
              />
            ))}
          </tbody>
        </table>
        <footer className="issue-table__footer">
          <span>
            {total === 0
              ? 'No issues match these filters'
              : `Showing ${page * pageSize + 1}–${Math.min(total, (page + 1) * pageSize)} of ${total}`}
          </span>
          <label>
            Rows per page{' '}
            <select
              value={pageSize}
              onChange={(event) => this.props.pageSizeChanged(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <Pagination page={page} pageCount={pageCount} onChange={this.props.pageChanged} />
        </footer>
      </div>
    )
  }
}

const mapStateToProps = (state: RootState) => {
  const { rows, total, pageCount } = selectIssuePage(state)
  return {
    rows,
    total,
    pageCount,
    page: state.issues.page,
    pageSize: state.issues.pageSize,
    sort: state.issues.sort,
    selectedIds: state.issues.selectedIds,
    status: state.issues.status,
  }
}

export default withRouter(
  connect(mapStateToProps, { pageChanged, pageSizeChanged, selectionToggled, sortChanged })(
    IssueTable,
  ),
)
