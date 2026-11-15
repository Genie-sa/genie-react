import { createFileRoute } from '@tanstack/react-router'
import { InventoryPage } from '../../features/inventory/inventory-page'
import { inventorySearchSchema } from '../../features/inventory/inventory-search'

export const Route = createFileRoute('/_app/inventory')({
  validateSearch: inventorySearchSchema,
  component: InventoryPage,
})
