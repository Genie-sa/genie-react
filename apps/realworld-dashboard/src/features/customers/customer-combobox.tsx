import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Input } from '../../components/ui/form-controls'
import { useDebouncedValue } from '../../lib/use-debounced-value'
import { customerQuery, customersListQuery } from './customer-queries'

const OPTION_LIMIT = 8

export function CustomerCombobox({
  id,
  value,
  onChange,
}: {
  id: string
  value: string
  onChange: (customerId: string) => void
}) {
  const [term, setTerm] = useState('')
  const [open, setOpen] = useState(false)
  const debouncedTerm = useDebouncedValue(term.trim(), 200)
  const selected = useQuery({ ...customerQuery(value), enabled: value !== '' })
  const options = useQuery({
    ...customersListQuery({ page: 1, pageSize: OPTION_LIMIT, q: debouncedTerm }),
    enabled: open && debouncedTerm.length > 0,
    placeholderData: keepPreviousData,
  })

  return (
    <div className="relative">
      <Input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        placeholder="Search accounts"
        value={open ? term : (selected.data?.name ?? '')}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onChange={(event) => setTerm(event.target.value)}
      />
      {open && options.data && options.data.items.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 w-full rounded-md border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {options.data.items.map((customer) => (
            <li key={customer.id} role="option" aria-selected={customer.id === value}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(customer.id)
                  setTerm('')
                  setOpen(false)
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {customer.name}
                <span className="ml-2 text-xs text-slate-500">{customer.region}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
