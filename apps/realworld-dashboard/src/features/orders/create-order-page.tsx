import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useFieldArray, useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '../../api/endpoints'
import { ORDER_PRIORITIES, type OrderPriority } from '../../api/types'
import { usePreferences } from '../../app/preferences'
import { referenceDataOptions } from '../../app/query-client'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Field, Input, Select, Textarea } from '../../components/ui/form-controls'
import { CustomerCombobox } from '../customers/customer-combobox'
import { useCreateOrder } from './order-queries'
import { ProductPicker } from './product-picker'

const newOrderSchema = z.object({
  customerId: z.string().min(1, 'Choose a customer'),
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  priority: z.enum(ORDER_PRIORITIES as [OrderPriority, ...OrderPriority[]]),
  shippingAddress: z.string().trim().min(5, 'Enter a full shipping address').max(200),
  notes: z.string().max(2_000, 'Notes are limited to 2,000 characters'),
  lines: z
    .array(
      z.object({
        productId: z.string(),
        name: z.string(),
        unitPrice: z.number(),
        quantity: z
          .number({ error: 'Enter a quantity' })
          .int('Whole units only')
          .min(1, 'At least 1')
          .max(999, 'At most 999'),
      }),
    )
    .min(1, 'Add at least one product'),
})

type NewOrderValues = z.infer<typeof newOrderSchema>

const DEFAULT_VALUES: NewOrderValues = {
  customerId: '',
  warehouseId: '',
  priority: 'standard',
  shippingAddress: '',
  notes: '',
  lines: [],
}

export function CreateOrderPage() {
  const navigate = useNavigate()
  const { formatMoney } = usePreferences()
  const createOrder = useCreateOrder()
  const products = useQuery({
    queryKey: ['reference', 'products'],
    queryFn: ({ signal }) => api.products(signal),
    staleTime: 5 * 60_000,
  })
  const warehouses = useQuery({
    queryKey: ['reference', 'warehouses'],
    queryFn: ({ signal }) => api.warehouses(signal),
    ...referenceDataOptions,
  })
  const form = useForm<NewOrderValues>({
    resolver: zodResolver(newOrderSchema),
    defaultValues: DEFAULT_VALUES,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const values = form.watch()
  const { errors } = form.formState

  const subtotal = values.lines.reduce(
    (sum, line) => sum + line.unitPrice * (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  )
  const units = values.lines.reduce(
    (sum, line) => sum + (Number.isFinite(line.quantity) ? line.quantity : 0),
    0,
  )

  const submit = form.handleSubmit((input) => {
    createOrder.mutate(
      {
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        priority: input.priority,
        shippingAddress: input.shippingAddress,
        notes: input.notes,
        lines: input.lines.map(({ productId, quantity }) => ({ productId, quantity })),
      },
      {
        onSuccess: (order) =>
          void navigate({ to: '/orders/$orderId', params: { orderId: order.id } }),
      },
    )
  })

  return (
    <form onSubmit={submit} noValidate className="space-y-6 p-6">
      <Link
        to="/orders"
        className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
      >
        <ArrowLeft className="size-4" />
        All orders
      </Link>
      <h1 className="text-xl font-semibold">New order</h1>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Customer and fulfillment" />
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer" error={errors.customerId?.message}>
                {(id) => (
                  <CustomerCombobox
                    id={id}
                    value={values.customerId}
                    onChange={(customerId) =>
                      form.setValue('customerId', customerId, {
                        shouldValidate: true,
                        shouldDirty: true,
                      })
                    }
                  />
                )}
              </Field>
              <Field label="Warehouse" error={errors.warehouseId?.message}>
                {(id) => (
                  <Select
                    id={id}
                    aria-invalid={Boolean(errors.warehouseId)}
                    {...form.register('warehouseId')}
                  >
                    <option value="">Select a warehouse</option>
                    {warehouses.data?.map((warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.name} ({warehouse.region})
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
                  <Input
                    id={id}
                    aria-invalid={Boolean(errors.shippingAddress)}
                    {...form.register('shippingAddress')}
                  />
                )}
              </Field>
            </CardBody>
          </Card>
          <Card>
            <CardHeader
              title="Products"
              description={errors.lines?.message ?? errors.lines?.root?.message}
            />
            <CardBody className="space-y-4">
              <ProductPicker
                products={products.data ?? []}
                selectedIds={values.lines.map((line) => line.productId)}
                onPick={(product) =>
                  lines.append({
                    productId: product.id,
                    name: product.name,
                    unitPrice: product.unitPrice,
                    quantity: 1,
                  })
                }
              />
              {lines.fields.length > 0 && (
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {lines.fields.map((field, index) => (
                      <tr key={field.id}>
                        <td className="py-2">{field.name}</td>
                        <td className="w-28 py-2">
                          <Input
                            type="number"
                            aria-label={`Quantity for ${field.name}`}
                            aria-invalid={Boolean(errors.lines?.[index]?.quantity)}
                            min={1}
                            {...form.register(`lines.${index}.quantity`, { valueAsNumber: true })}
                          />
                        </td>
                        <td className="w-28 py-2 text-right tabular-nums">
                          {formatMoney(field.unitPrice)}
                        </td>
                        <td className="w-10 py-2 text-right">
                          <button
                            type="button"
                            aria-label={`Remove ${field.name}`}
                            onClick={() => lines.remove(index)}
                            className="rounded p-1 text-slate-400 hover:text-rose-600"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notes" />
            <CardBody>
              <Field label="Notes for the warehouse team" error={errors.notes?.message}>
                {(id) => (
                  <Textarea
                    id={id}
                    aria-invalid={Boolean(errors.notes)}
                    {...form.register('notes')}
                  />
                )}
              </Field>
            </CardBody>
          </Card>
        </div>
        <aside>
          <Card className="sticky top-6">
            <CardHeader title="Summary" />
            <CardBody className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Lines</span>
                <span className="tabular-nums">{values.lines.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Units</span>
                <span className="tabular-nums">{units}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-3 text-base font-semibold dark:border-slate-800">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMoney(subtotal)}</span>
              </div>
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                loading={createOrder.isPending}
              >
                Create order
              </Button>
            </CardBody>
          </Card>
        </aside>
      </div>
    </form>
  )
}
