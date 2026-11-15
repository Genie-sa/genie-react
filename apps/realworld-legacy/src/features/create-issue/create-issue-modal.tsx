import { Form, Formik } from 'formik'
import { useCallback } from 'react'
import { useGetUsersQuery } from '../../api/service'
import type { IssuePriority } from '../../api/types'
import { PRIORITY_LABELS } from '../../components/badges'
import { Button } from '../../components/button'
import { FormField } from '../../components/form-field'
import { Modal } from '../../components/modal'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { createIssue } from '../../store/issues'
import { createIssueToggled, toastShown } from '../../store/ui'
import { SelectField } from './select-field'

interface CreateIssueValues {
  projectKey: string
  title: string
  description: string
  priority: IssuePriority
  assigneeId: string
}

function validate(values: CreateIssueValues) {
  const errors: Partial<Record<keyof CreateIssueValues, string>> = {}
  if (!values.title.trim()) errors.title = 'Give the issue a title'
  else if (values.title.length > 140) errors.title = 'Keep the title under 140 characters'
  return errors
}

export function CreateIssueModal() {
  const dispatch = useAppDispatch()
  const { data: users = [] } = useGetUsersQuery()
  const projects = useAppSelector((state) => state.projects.byKey)
  const defaultProject = useAppSelector((state) => state.board.projectKey)
  const close = useCallback(() => dispatch(createIssueToggled(false)), [dispatch])

  const initialValues: CreateIssueValues = {
    projectKey: defaultProject,
    title: '',
    description: '',
    priority: 'medium',
    assigneeId: '',
  }

  return (
    <Modal title="Create issue" onClose={close}>
      <Formik
        initialValues={initialValues}
        validate={validate}
        onSubmit={async (values) => {
          const result = await dispatch(
            createIssue({ ...values, assigneeId: values.assigneeId || null }),
          )
          if (createIssue.fulfilled.match(result)) {
            dispatch(toastShown('success', `Created ${result.payload.key}`))
            close()
          } else {
            dispatch(toastShown('error', 'Could not create the issue'))
          }
        }}
      >
        {({ isSubmitting }) => (
          <Form noValidate className="create-issue">
            <SelectField name="projectKey" label="Project">
              {Object.values(projects).map((project) => (
                <option key={project.key} value={project.key}>
                  {project.name}
                </option>
              ))}
            </SelectField>
            <FormField name="title" label="Title" placeholder="Short summary" />
            <FormField name="description" label="Description" multiline />
            <SelectField name="priority" label="Priority">
              {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField name="assigneeId" label="Assignee">
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </SelectField>
            <div className="create-issue__actions">
              <Button variant="ghost" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                Create issue
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  )
}
