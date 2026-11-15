import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { ORDER_PRIORITIES, ORDER_STATUSES, type Order } from '../../api/types'
import { Button } from '../../components/ui/button'
import { Field, Select, Textarea } from '../../components/ui/form-controls'
import { Drawer } from '../../components/ui/overlay'
import { useUpdateOrder } from './order-queries'
import { ORDER_STATUS_META } from './order-status'

const orderEditSchema = z.object({
  status: z.enum(ORDER_STATUSES as [Order['status'], ...Order['status'][]]),
  priority: z.enum(ORDER_PRIORITIES as [Order['priority'], ...Order['priority'][]]),
  shippingAddress: z.string().trim().min(5, 'Enter a full shipping address').max(200),
  notes: z.string().max(2_000, 'Notes are limited to 2,000 characters'),
})

type OrderEditValues = z.infer<typeof orderEditSchema>

export function OrderEditDrawer({
  order,
  open,
  onClose,
}: {
  order: Order
  open: boolean
  onClose: () => void
}) {
  const update = useUpdateOrder(order.id)
  const form = useForm<OrderEditValues>({
    resolver: zodResolver(orderEditSchema),
    defaultValues: {
      status: order.status,
      priority: order.priority,
      shippingAddress: order.shippingAddress,
      notes: order.notes,
    },
  })
  const { errors, isDirty } = form.formState

  const submit = form.handleSubmit((values) => {
    update.mutate(values, {
      onSuccess: (saved) => {
        form.reset({
          status: saved.status,
          priority: saved.priority,
          shippingAddress: saved.shippingAddress,
          notes: saved.notes,
        })
        onClose()
      },
    })
  })

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Edit ${order.number}`}
      description="Changes apply immediately for everyone working this order."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="order-edit-form"
            loading={update.isPending}
            disabled={!isDirty}
          >
            Save changes
          </Button>
        </>
      }
    >
      <form id="order-edit-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Status" error={errors.status?.message}>
          {(id) => (
            <Select id={id} {...form.register('status')}>
              {ORDER_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {ORDER_STATUS_META[status].label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Priority" error={errors.priority?.message}>
          {(id) => (
            <Select id={id} {...form.register('priority')}>
              {ORDER_PRIORITIES.map((priority) => (
                <option key={priority} value={priority}>
                  {priority}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Shipping address" error={errors.shippingAddress?.message}>
          {(id) => (
            <Textarea
              id={id}
              rows={2}
              className="min-h-0"
              aria-invalid={Boolean(errors.shippingAddress)}
              {...form.register('shippingAddress')}
            />
          )}
        </Field>
        <Field
          label="Internal notes"
          error={errors.notes?.message}
          hint="Visible to your team only"
        >
          {(id) => (
            <Textarea id={id} aria-invalid={Boolean(errors.notes)} {...form.register('notes')} />
          )}
        </Field>
      </form>
    </Drawer>
  )
}
