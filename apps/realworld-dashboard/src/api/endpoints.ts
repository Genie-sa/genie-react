import { apiRequest } from './client'
import type {
  ActivityEvent,
  AuditEntry,
  BackendState,
  BulkOrderAction,
  Carrier,
  CarrierPerformance,
  Customer,
  CustomerTier,
  CustomerUpdate,
  DashboardSummary,
  FaultRule,
  LatencyRule,
  ListResult,
  NewOrder,
  Notification,
  NotificationPreferences,
  Order,
  OrderSummary,
  OrderUpdate,
  Page,
  Product,
  Profile,
  RegionRevenue,
  Role,
  SearchResponse,
  Session,
  Shipment,
  StatusCount,
  StockAdjustment,
  StockLevel,
  StockSummary,
  TeamMember,
  TrendPoint,
  User,
  Warehouse,
} from './types'

export interface OrderListParams {
  status?: string
  region?: string
  q?: string
}

export interface CustomerListParams {
  page: number
  pageSize: number
  q?: string
  tier?: CustomerTier
}

export const api = {
  login: (email: string, password: string) =>
    apiRequest<Session>('/api/auth/login', { method: 'POST', body: { email, password } }),
  me: () => apiRequest<User>('/api/auth/me'),

  orders: (params: OrderListParams, signal?: AbortSignal) =>
    apiRequest<ListResult<OrderSummary>>('/api/orders', { query: { ...params }, signal }),
  order: (id: string, signal?: AbortSignal) => apiRequest<Order>(`/api/orders/${id}`, { signal }),
  orderShipments: (id: string, signal?: AbortSignal) =>
    apiRequest<Shipment[]>(`/api/orders/${id}/shipments`, { signal }),
  orderActivity: (id: string, signal?: AbortSignal) =>
    apiRequest<ActivityEvent[]>(`/api/orders/${id}/activity`, { signal }),
  updateOrder: (id: string, update: OrderUpdate) =>
    apiRequest<Order>(`/api/orders/${id}`, { method: 'PATCH', body: update }),
  bulkUpdateOrders: (ids: string[], action: BulkOrderAction) =>
    apiRequest<{ updated: number; skipped: number }>('/api/orders/bulk', {
      method: 'POST',
      body: { ids, action },
    }),
  createOrder: (order: NewOrder) =>
    apiRequest<Order>('/api/orders', { method: 'POST', body: order }),

  customers: (params: CustomerListParams, signal?: AbortSignal) =>
    apiRequest<Page<Customer>>('/api/customers', { query: { ...params }, signal }),
  customer: (id: string, signal?: AbortSignal) =>
    apiRequest<Customer>(`/api/customers/${id}`, { signal }),
  customerOrders: (id: string, signal?: AbortSignal) =>
    apiRequest<OrderSummary[]>(`/api/customers/${id}/orders`, { signal }),
  updateCustomer: (id: string, update: CustomerUpdate) =>
    apiRequest<Customer>(`/api/customers/${id}`, { method: 'PATCH', body: update }),

  products: (signal?: AbortSignal) => apiRequest<Product[]>('/api/products', { signal }),
  warehouses: (signal?: AbortSignal) => apiRequest<Warehouse[]>('/api/warehouses', { signal }),
  carriers: (signal?: AbortSignal) => apiRequest<Carrier[]>('/api/carriers', { signal }),
  inventory: (params: { q?: string; low?: boolean }, signal?: AbortSignal) =>
    apiRequest<ListResult<StockLevel>>('/api/inventory', { query: { ...params }, signal }),
  adjustStock: (productId: string, adjustment: StockAdjustment) =>
    apiRequest<StockLevel>(`/api/inventory/${productId}/adjust`, {
      method: 'POST',
      body: adjustment,
    }),

  dashboardSummary: (signal?: AbortSignal) =>
    apiRequest<DashboardSummary>('/api/dashboard/summary', { signal }),
  ordersTrend: (days: number, signal?: AbortSignal) =>
    apiRequest<TrendPoint[]>('/api/dashboard/orders-trend', { query: { days }, signal }),
  revenueByRegion: (signal?: AbortSignal) =>
    apiRequest<RegionRevenue[]>('/api/dashboard/revenue-by-region', { signal }),
  statusBreakdown: (signal?: AbortSignal) =>
    apiRequest<StatusCount[]>('/api/dashboard/status-breakdown', { signal }),
  carrierPerformance: (signal?: AbortSignal) =>
    apiRequest<CarrierPerformance[]>('/api/dashboard/carriers', { signal }),
  stockSummary: (signal?: AbortSignal) =>
    apiRequest<StockSummary>('/api/dashboard/stock-summary', { signal }),

  search: (q: string, signal?: AbortSignal) =>
    apiRequest<SearchResponse>('/api/search', { query: { q }, signal }),
  activity: (after: number, signal?: AbortSignal) =>
    apiRequest<ActivityEvent[]>('/api/activity', { query: { after }, signal }),
  notifications: (signal?: AbortSignal) =>
    apiRequest<Notification[]>('/api/notifications', { signal }),
  markAllNotificationsRead: () =>
    apiRequest<{ unread: number }>('/api/notifications/read-all', { method: 'POST' }),

  team: (signal?: AbortSignal) => apiRequest<TeamMember[]>('/api/team', { signal }),
  updateMemberRole: (id: string, role: Role) =>
    apiRequest<TeamMember>(`/api/team/${id}`, { method: 'PATCH', body: { role } }),
  profile: (signal?: AbortSignal) => apiRequest<Profile>('/api/settings/profile', { signal }),
  updateProfile: (profile: Profile) =>
    apiRequest<Profile>('/api/settings/profile', { method: 'PUT', body: profile }),
  notificationPreferences: (signal?: AbortSignal) =>
    apiRequest<NotificationPreferences>('/api/settings/notifications', { signal }),
  updateNotificationPreferences: (preferences: NotificationPreferences) =>
    apiRequest<NotificationPreferences>('/api/settings/notifications', {
      method: 'PUT',
      body: preferences,
    }),
  auditLog: (page: number, signal?: AbortSignal) =>
    apiRequest<Page<AuditEntry>>('/api/audit-log', { query: { page }, signal }),
  telemetry: (event: string, properties: Record<string, unknown>) =>
    apiRequest<{ accepted: boolean }>('/api/telemetry', {
      method: 'POST',
      body: { event, properties },
    }),
}

export const devApi = {
  state: () => apiRequest<BackendState>('/api/__dev/state'),
  reset: (seed?: number) =>
    apiRequest<BackendState>('/api/__dev/reset', { method: 'POST', body: { seed } }),
  setFaults: (faults: FaultRule[]) =>
    apiRequest<BackendState>('/api/__dev/faults', { method: 'PUT', body: faults }),
  setLatency: (rules: LatencyRule[], scale: number) =>
    apiRequest<BackendState>('/api/__dev/latency', { method: 'PUT', body: { rules, scale } }),
}
