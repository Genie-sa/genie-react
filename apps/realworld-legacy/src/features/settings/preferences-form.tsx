import { Form, Formik } from 'formik'
import { useUpdatePreferencesMutation } from '../../api/service'
import type { Preferences } from '../../api/types'
import { Button } from '../../components/button'
import { FormField } from '../../components/form-field'
import { useAppDispatch } from '../../store/hooks'
import { toastShown } from '../../store/ui'
import { SelectField } from '../create-issue/select-field'

export function PreferencesForm({ preferences }: { preferences: Preferences }) {
  const dispatch = useAppDispatch()
  const [updatePreferences] = useUpdatePreferencesMutation()
  return (
    <Formik
      initialValues={preferences}
      enableReinitialize
      validate={(values) =>
        values.displayName.trim() ? {} : { displayName: 'Display name is required' }
      }
      onSubmit={async (values) => {
        await updatePreferences(values).unwrap()
        dispatch(toastShown('success', 'Preferences saved'))
      }}
    >
      {({ isSubmitting, dirty }) => (
        <Form className="preferences-form">
          <FormField name="displayName" label="Display name" />
          <SelectField name="density" label="Density">
            <option value="comfortable">Comfortable</option>
            <option value="compact">Compact</option>
          </SelectField>
          <SelectField name="emailDigest" label="Email digest">
            <option value="off">Off</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </SelectField>
          <Button type="submit" variant="primary" disabled={isSubmitting || !dirty}>
            Save preferences
          </Button>
        </Form>
      )}
    </Formik>
  )
}
