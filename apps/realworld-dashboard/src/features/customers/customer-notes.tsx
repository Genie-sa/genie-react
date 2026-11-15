import { useState } from 'react'
import type { Customer } from '../../api/types'
import { usePermissions } from '../../app/permissions'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Textarea } from '../../components/ui/form-controls'
import { useUpdateCustomer } from './customer-queries'

export function CustomerNotes({ customer }: { customer: Customer }) {
  const { can } = usePermissions()
  const update = useUpdateCustomer()
  const [draft, setDraft] = useState(customer.notes)
  const dirty = draft !== customer.notes

  return (
    <Card>
      <CardHeader
        title="Account notes"
        description="Shared with everyone who works this account"
        actions={
          can('customers.edit') && (
            <Button
              size="sm"
              variant="primary"
              disabled={!dirty}
              loading={update.isPending}
              onClick={() => update.mutate({ id: customer.id, update: { notes: draft } })}
            >
              Save notes
            </Button>
          )
        }
      />
      <CardBody>
        <Textarea
          aria-label="Account notes"
          value={draft}
          readOnly={!can('customers.edit')}
          onChange={(event) => setDraft(event.target.value)}
        />
      </CardBody>
    </Card>
  )
}
