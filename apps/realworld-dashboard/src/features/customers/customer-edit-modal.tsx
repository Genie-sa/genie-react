import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { CUSTOMER_TIERS, type Customer, type CustomerTier } from '../../api/types'
import { Button } from '../../components/ui/button'
import { Field, Input, Select } from '../../components/ui/form-controls'
import { Modal } from '../../components/ui/overlay'
import { useUpdateCustomer } from './customer-queries'

const customerSchema = z.object({
  name: z.string().trim().min(2, 'Account name is required').max(120),
  contactName: z.string().trim().min(2, 'Contact name is required').max(120),
  email: z.email('Enter a valid email address'),
  phone: z.string().trim().min(5, 'Enter a phone number').max(40),
  tier: z.enum(CUSTOMER_TIERS as [CustomerTier, ...CustomerTier[]]),
})

type CustomerValues = z.infer<typeof customerSchema>

export function CustomerEditModal({
  customer,
  onClose,
}: {
  customer: Customer
  onClose: () => void
}) {
  const update = useUpdateCustomer()
  const form = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: customer.name,
      contactName: customer.contactName,
      email: customer.email,
      phone: customer.phone,
      tier: customer.tier,
    },
  })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) =>
    update.mutate({ id: customer.id, update: values }, { onSuccess: onClose }),
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${customer.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="customer-edit-form"
            variant="primary"
            disabled={!isDirty}
            loading={update.isPending}
          >
            Save
          </Button>
        </>
      }
    >
      <form
        id="customer-edit-form"
        onSubmit={submit}
        noValidate
        className="grid gap-4 sm:grid-cols-2"
      >
        <Field label="Account name" error={errors.name?.message}>
          {(id) => <Input id={id} aria-invalid={Boolean(errors.name)} {...form.register('name')} />}
        </Field>
        <Field label="Tier" error={errors.tier?.message}>
          {(id) => (
            <Select id={id} {...form.register('tier')}>
              {CUSTOMER_TIERS.map((tier) => (
                <option key={tier} value={tier}>
                  {tier}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Primary contact" error={errors.contactName?.message}>
          {(id) => (
            <Input
              id={id}
              aria-invalid={Boolean(errors.contactName)}
              {...form.register('contactName')}
            />
          )}
        </Field>
        <Field label="Phone" error={errors.phone?.message}>
          {(id) => (
            <Input id={id} aria-invalid={Boolean(errors.phone)} {...form.register('phone')} />
          )}
        </Field>
        <div className="sm:col-span-2">
          <Field label="Email" error={errors.email?.message}>
            {(id) => (
              <Input
                id={id}
                type="email"
                aria-invalid={Boolean(errors.email)}
                {...form.register('email')}
              />
            )}
          </Field>
        </div>
      </form>
    </Modal>
  )
}
