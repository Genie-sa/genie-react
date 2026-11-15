import { Form, Formik } from 'formik'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '../../components/button'
import { FormField } from '../../components/form-field'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { type Credentials, signIn } from '../../store/session'

const INITIAL_VALUES: Credentials = { email: '', password: '' }

function validate(values: Credentials) {
  const errors: Partial<Record<keyof Credentials, string>> = {}
  if (!values.email) errors.email = 'Enter your work email'
  else if (!values.email.includes('@')) errors.email = 'That does not look like an email address'
  if (!values.password) errors.password = 'Enter your password'
  return errors
}

export function LoginPage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const location = useLocation()
  const { status, error } = useAppSelector((state) => state.session)
  const destination = (location.state as { from?: string } | null)?.from ?? '/board'

  if (status === 'signed-in') return <Navigate to={destination} replace />

  return (
    <div className="login">
      <div className="login__card">
        <h1>Sign in to Acme Tracker</h1>
        <Formik
          initialValues={INITIAL_VALUES}
          validate={validate}
          onSubmit={async (values) => {
            const result = await dispatch(signIn(values))
            if (signIn.fulfilled.match(result)) navigate(destination, { replace: true })
          }}
        >
          {({ isSubmitting }) => (
            <Form noValidate>
              <FormField name="email" label="Email" type="email" autoComplete="username" />
              <FormField
                name="password"
                label="Password"
                type="password"
                autoComplete="current-password"
              />
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>
            </Form>
          )}
        </Formik>
        <p className="muted">Demo account: dana@acme.test / password</p>
      </div>
    </div>
  )
}
