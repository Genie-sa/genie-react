import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { api } from '../../api/endpoints'
import type { StockLevel } from '../../api/types'
import { referenceDataOptions } from '../../app/query-client'
import { Button } from '../../components/ui/button'
import { Field, Input, Select } from '../../components/ui/form-controls'
import { Modal } from '../../components/ui/overlay'
import { useAdjustStock } from './inventory-queries'

const REASONS = [
  'Cycle count',
  'Damaged goods',
  'Received shipment',
  'Customer return',
  'Transfer',
] as const

const adjustmentSchema = z.object({
  warehouseId: z.string().min(1, 'Choose a warehouse'),
  delta: z
    .number({ error: 'Enter a whole number' })
    .int('Whole units only')
    .refine((value) => value !== 0, 'Adjustment cannot be zero'),
  reason: z.enum(REASONS),
})

type AdjustmentValues = z.infer<typeof adjustmentSchema>

export function AdjustStockModal({ level, onClose }: { level: StockLevel; onClose: () => void }) {
  const adjust = useAdjustStock()
  const warehouses = useQuery({
    queryKey: ['reference', 'warehouses'],
    queryFn: ({ signal }) => api.warehouses(signal),
    ...referenceDataOptions,
  })
  const form = useForm<AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: { warehouseId: '', delta: 0, reason: 'Cycle count' },
  })
  const { errors } = form.formState
  const warehouseId = form.watch('warehouseId')
  const delta = form.watch('delta')
  const current = warehouseId ? (level.onHand[warehouseId] ?? 0) : null

  const submit = form.handleSubmit((values) =>
    adjust.mutate({ productId: level.productId, adjustment: values }, { onSuccess: onClose }),
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={`Adjust ${level.sku}`}
      description={level.name}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="adjust-stock-form"
            variant="primary"
            loading={adjust.isPending}
          >
            Apply adjustment
          </Button>
        </>
      }
    >
      <form id="adjust-stock-form" onSubmit={submit} noValidate className="space-y-4">
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
                  {warehouse.name} · {level.onHand[warehouse.id] ?? 0} on hand
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Adjustment"
          error={errors.delta?.message}
          hint={
            current === null || !Number.isFinite(delta)
              ? 'Use a negative number to remove units'
              : `New on-hand quantity: ${current + delta}`
          }
        >
          {(id) => (
            <Input
              id={id}
              type="number"
              aria-invalid={Boolean(errors.delta)}
              {...form.register('delta', { valueAsNumber: true })}
            />
          )}
        </Field>
        <Field label="Reason" error={errors.reason?.message}>
          {(id) => (
            <Select id={id} {...form.register('reason')}>
              {REASONS.map((reason) => (
                <option key={reason} value={reason}>
                  {reason}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </form>
    </Modal>
  )
}
