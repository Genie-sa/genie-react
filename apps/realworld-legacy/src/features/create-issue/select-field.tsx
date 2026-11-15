import { useField } from 'formik'
import type { ReactNode } from 'react'

export function SelectField({
  name,
  label,
  children,
}: {
  name: string
  label: string
  children: ReactNode
}) {
  const [field] = useField<string>(name)
  return (
    <div className="form-field">
      <label htmlFor={`field-${name}`}>{label}</label>
      <select id={`field-${name}`} {...field}>
        {children}
      </select>
    </div>
  )
}
