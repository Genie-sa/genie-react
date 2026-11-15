import { connect } from 'react-redux'
import type { Project } from '../../api/types'
import { type RouterProps, withRouter } from '../../hocs/with-router'
import type { RootState } from '../../store'

interface ReportProjectPickerProps extends RouterProps {
  projectKey: string
  projects: Record<string, Project>
}

function ReportProjectPicker({ projectKey, projects, router }: ReportProjectPickerProps) {
  return (
    <select
      aria-label="Report project"
      value={projectKey}
      onChange={(event) => router.navigate({ search: `?project=${event.target.value}` })}
    >
      {Object.values(projects).map((project) => (
        <option key={project.key} value={project.key}>
          {project.name}
        </option>
      ))}
    </select>
  )
}

export default withRouter(
  connect((state: RootState) => ({ projects: state.projects.byKey }))(ReportProjectPicker),
)
