import { useField } from 'formik'

interface FormFieldProps {
  name: string
  label: string
  type?: 'text' | 'email' | 'password'
  placeholder?: string
  autoComplete?: string
  multiline?: boolean
}

export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  autoComplete,
  multiline = false,
}: FormFieldProps) {
  const [field, meta] = useField<string>(name)
  const id = `field-${name}`
  return (
    <div className="form-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? (
        <textarea id={id} rows={4} placeholder={placeholder} {...field} />
      ) : (
        <input
          id={id}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          {...field}
        />
      )}
      {meta.touched && meta.error && <span className="form-field__error">{meta.error}</span>}
    </div>
  )
}
