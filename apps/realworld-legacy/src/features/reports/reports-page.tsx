import { Component } from 'react'
import { connect } from 'react-redux'
import type { ReportRange } from '../../api/types'
import { PageHeader } from '../../components/page-header'
import { type RouterProps, withRouter } from '../../hocs/with-router'
import type { RootState } from '../../store'
import CycleTimeWidget from './cycle-time-widget'
import NoteComposer from './note-composer'
import ReportDataLoader from './report-data-loader'
import ReportNotesList from './report-notes-list'
import ReportProjectPicker from './report-project-picker'
import ReportRangePicker from './report-range-picker'
import { loadReports } from './state/actions'
import { ThroughputWidget } from './throughput-widget'
import { WidgetBoundary } from './widget-boundary'
import { WorkloadWidget } from './workload-widget'

interface ReportsPageProps extends RouterProps {
  range: ReportRange
  loadReports: (projectKey: string, range: ReportRange) => unknown
}

const DEFAULT_PROJECT = 'CORE'

function projectFromSearch(search: string): string {
  return new URLSearchParams(search).get('project') ?? DEFAULT_PROJECT
}

class ReportsPage extends Component<ReportsPageProps> {
  componentDidMount() {
    this.props.loadReports(projectFromSearch(this.props.router.location.search), this.props.range)
  }

  componentDidUpdate(prevProps: ReportsPageProps) {
    const project = projectFromSearch(this.props.router.location.search)
    if (project !== projectFromSearch(prevProps.router.location.search)) {
      this.props.loadReports(project, this.props.range)
    }
  }

  render() {
    const projectKey = projectFromSearch(this.props.router.location.search)
    return (
      <div className="reports-page">
        <PageHeader
          title="Reports"
          actions={
            <>
              <ReportProjectPicker projectKey={projectKey} />
              <ReportRangePicker projectKey={projectKey} />
            </>
          }
        />
        <ReportDataLoader>
          {({ status, throughput, cycleTime, workload, error }) => (
            <div className="report-grid" aria-busy={status === 'loading'}>
              {status === 'failed' && <p className="form-error">{error}</p>}
              <WidgetBoundary name="Throughput">
                {throughput && <ThroughputWidget report={throughput} />}
              </WidgetBoundary>
              <WidgetBoundary name="Cycle time">
                {cycleTime && <CycleTimeWidget report={cycleTime} />}
              </WidgetBoundary>
              <WidgetBoundary name="Workload">
                {workload && <WorkloadWidget report={workload} />}
              </WidgetBoundary>
            </div>
          )}
        </ReportDataLoader>
        <section className="report-notes">
          <h2>Notes</h2>
          <ReportNotesList />
          <NoteComposer />
        </section>
      </div>
    )
  }
}

const mapStateToProps = (state: RootState) => ({ range: state.reports.range })

export default withRouter(connect(mapStateToProps, { loadReports })(ReportsPage))
