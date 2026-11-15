export type Region = 'NA' | 'EMEA' | 'APAC' | 'LATAM'
export type Role = 'admin' | 'manager' | 'agent' | 'viewer'
export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on_hold'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
export type OrderPriority = 'standard' | 'expedited' | 'critical'
export type CustomerTier = 'enterprise' | 'growth' | 'starter'
export type ShipmentStatus = 'label_created' | 'in_transit' | 'out_for_delivery' | 'delivered'
export type BulkOrderAction = 'mark_shipped' | 'hold' | 'cancel'

export const ORDER_STATUSES: readonly OrderStatus[] = [
  'pending',
  'processing',
  'on_hold',
  'shipped',
  'delivered',
  'cancelled',
]
export const REGIONS: readonly Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']
export const ORDER_PRIORITIES: readonly OrderPriority[] = ['standard', 'expedited', 'critical']
export const CUSTOMER_TIERS: readonly CustomerTier[] = ['enterprise', 'growth', 'starter']

export interface User {
  id: string
  name: string
  email: string
  role: Role
  title: string
}

export interface Session {
  token: string
  user: User
}

export interface Warehouse {
  id: string
  name: string
  city: string
  region: Region
}

export interface Carrier {
  id: string
  name: string
}

export interface Product {
  id: string
  sku: string
  name: string
  category: string
  unitPrice: number
}

export interface StockLevel {
  productId: string
  sku: string
  name: string
  category: string
  reorderPoint: number
  onHand: Record<string, number>
  totalOnHand: number
}

export interface OrderLine {
  productId: string
  sku: string
  name: string
  quantity: number
  unitPrice: number
}

export interface OrderSummary {
  id: string
  number: string
  customerId: string
  customerName: string
  status: OrderStatus
  priority: OrderPriority
  region: Region
  warehouseId: string
  itemCount: number
  total: number
  placedAt: string
  updatedAt: string
}

export interface Order extends OrderSummary {
  carrierId: string
  lines: OrderLine[]
  shippingAddress: string
  notes: string
}

export interface ShipmentEvent {
  at: string
  location: string
  description: string
}

export interface Shipment {
  id: string
  orderId: string
  carrierId: string
  carrierName: string
  trackingNumber: string
  status: ShipmentStatus
  events: ShipmentEvent[]
}

export interface ActivityEvent {
  id: number
  at: string
  actor: string
  subject: string
  topic: string
  message: string
}

export interface Customer {
  id: string
  name: string
  contactName: string
  email: string
  phone: string
  tier: CustomerTier
  region: Region
  accountManager: string
  notes: string
  relatedIds: string[]
  createdAt: string
  lifetimeValue: number
  openOrders: number
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}

export interface ListResult<T> {
  items: T[]
  total: number
}

export interface DashboardSummary {
  revenue: number
  revenueDelta: number
  orders: number
  ordersDelta: number
  fulfillmentRate: number
  fulfillmentDelta: number
  backlog: number
  backlogDelta: number
}

export interface TrendPoint {
  date: string
  orders: number
  revenue: number
}

export interface RegionRevenue {
  region: Region
  revenue: number
}

export interface StatusCount {
  status: OrderStatus
  count: number
}

export interface CarrierPerformance {
  carrierId: string
  name: string
  shipments: number
  onTimeRate: number | null
  averageTransitDays: number | null
}

export interface StockSummary {
  lowStock: number
  outOfStock: number
  items: StockLevel[]
}

export interface SearchResult {
  type: 'order' | 'customer' | 'product'
  id: string
  title: string
  subtitle: string
}

export interface SearchResponse {
  query: string
  results: SearchResult[]
}

export interface Notification {
  id: string
  at: string
  title: string
  body: string
  read: boolean
}

export interface TeamMember extends User {
  lastActiveAt: string
}

export interface AuditEntry {
  id: string
  at: string
  actor: string
  action: string
  target: string
}

export interface Profile {
  name: string
  email: string
  title: string
  timezone: string
}

export interface NotificationPreferences {
  orderEscalations: boolean
  dailyDigest: boolean
  lowStockAlerts: boolean
  mentions: boolean
}

export interface ApiErrorBody {
  error: { code: string; message: string }
}

export interface OrderUpdate {
  status?: OrderStatus
  priority?: OrderPriority
  notes?: string
  shippingAddress?: string
}

export interface NewOrder {
  customerId: string
  warehouseId: string
  priority: OrderPriority
  shippingAddress: string
  notes: string
  lines: { productId: string; quantity: number }[]
}

export interface CustomerUpdate {
  name?: string
  contactName?: string
  email?: string
  phone?: string
  tier?: CustomerTier
  notes?: string
}

export interface StockAdjustment {
  warehouseId: string
  delta: number
  reason: string
}

export interface FaultRule {
  method?: string
  path: string
  status: number
  message?: string
  times?: number
}

export interface LatencyRule {
  method?: string
  path: string
  ms: number
}

export interface BackendState {
  seed: number
  faults: (FaultRule & { remaining: number | null })[]
  latency: LatencyRule[]
  latencyScale: number
  requestCount: number
  counts: { orders: number; customers: number; products: number }
}
