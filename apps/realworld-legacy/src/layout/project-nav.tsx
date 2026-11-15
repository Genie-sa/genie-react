import classNames from 'classnames'
import { Component } from 'react'
import { connect } from 'react-redux'
import { Link } from 'react-router-dom'
import type { Project } from '../api/types'
import type { RootState } from '../store'
import { boardProjectChanged } from '../store/board'
import { fetchProjects } from '../store/projects'

interface ProjectNavProps {
  projects: Project[]
  activeKey: string
  status: RootState['projects']['status']
  fetchProjects: () => unknown
  boardProjectChanged: (key: string) => unknown
}

class ProjectNav extends Component<ProjectNavProps> {
  componentDidMount() {
    if (this.props.status === 'idle') this.props.fetchProjects()
  }

  render() {
    const { projects, activeKey } = this.props
    return (
      <section className="project-nav">
        <h2 className="project-nav__title">Projects</h2>
        <ul>
          {projects.map((project) => (
            <li key={project.key}>
              <Link
                to="/board"
                className={classNames('project-nav__link', { active: project.key === activeKey })}
                onClick={() => this.props.boardProjectChanged(project.key)}
              >
                <span className="project-nav__key">{project.key}</span>
                {project.name}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    )
  }
}

const mapStateToProps = (state: RootState) => ({
  projects: Object.values(state.projects.byKey),
  activeKey: state.board.projectKey,
  status: state.projects.status,
})

export default connect(mapStateToProps, { fetchProjects, boardProjectChanged })(ProjectNav)
