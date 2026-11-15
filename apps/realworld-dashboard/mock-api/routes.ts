import { z } from 'zod'
import type {
  BulkOrderAction,
  CarrierPerformance,
  Customer,
  DashboardSummary,
  ListResult,
  Order,
  OrderStatus,
  OrderSummary,
  Page,
  RegionRevenue,
  Role,
  SearchResponse,
  SearchResult,
  StatusCount,
  StockLevel,
  StockSummary,
  TeamMember,
  TrendPoint,
  User,
} from '../src/api/types.ts'
import { CUSTOMER_TIERS, ORDER_PRIORITIES, ORDER_STATUSES, REGIONS } from '../src/api/types.ts'
import { DAY, type Database, REFERENCE_NOW, type StockRecord } from './db.ts'
import { compilePattern, type Handler, HttpError, type RequestContext, type Route } from './http.ts'

const WRITE_ROLES: readonly Role[] = ['admin', 'manager', 'agent']
const OPEN_STATUSES: ReadonlySet<OrderStatus> = new Set(['pending', 'processing', 'on_hold'])
const SEARCH_LIMIT = 8
const MAX_BULK_IDS = 500

const loginBody = z.object({ email: z.string().email(), password: z.string().min(1) })
const orderUpdateBody = z
  .object({
    status: z.enum(ORDER_STATUSES as [OrderStatus, ...OrderStatus[]]).optional(),
    priority: z.enum(ORDER_PRIORITIES as [string, ...string[]]).optional(),
    notes: z.string().max(2_000).optional(),
    shippingAddress: z.string().min(5).max(200).optional(),
  })
  .strict()
const bulkBody = z.object({
  ids: z.array(z.string()).min(1).max(MAX_BULK_IDS),
  action: z.enum(['mark_shipped', 'hold', 'cancel']),
})
const newOrderBody = z.object({
  customerId: z.string(),
  warehouseId: z.string(),
  priority: z.enum(ORDER_PRIORITIES as [string, ...string[]]),
  shippingAddress: z.string().min(5).max(200),
  notes: z.string().max(2_000),
  lines: z
    .array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(999) }))
    .min(1)
    .max(50),
})
const customerUpdateBody = z
  .object({
    name: z.string().min(2).max(120).optional(),
    contactName: z.string().min(2).max(120).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(5).max(40).optional(),
    tier: z.enum(CUSTOMER_TIERS as [string, ...string[]]).optional(),
    notes: z.string().max(4_000).optional(),
  })
  .strict()
const adjustmentBody = z.object({
  warehouseId: z.string(),
  delta: z.number().int().min(-10_000).max(10_000),
  reason: z.string().min(3).max(200),
})
const roleBody = z.object({ role: z.enum(['admin', 'manager', 'agent', 'viewer']) })
const profileBody = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  title: z.string().max(80),
  timezone: z.string().min(3).max(60),
})
const preferencesBody = z.object({
  orderEscalations: z.boolean(),
  dailyDigest: z.boolean(),
  lowStockAlerts: z.boolean(),
  mentions: z.boolean(),
})
const telemetryBody = z.object({
  event: z.string().max(80),
  properties: z.record(z.string(), z.unknown()),
})

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  throw new HttpError(
    422,
    'validation_failed',
    `${issue?.path.join('.') || 'body'}: ${issue?.message ?? 'invalid'}`,
  )
}

function intParam(query: URLSearchParams, name: string, fallback: number, max: number): number {
  const raw = query.get(name)
  if (raw === null) return fallback
  const value = Number.parseInt(raw, 10)
  if (!Number.isFinite(value) || value < 1)
    throw new HttpError(400, 'invalid_query', `${name} must be a positive integer`)
  return Math.min(value, max)
}

function summarize(order: Order): OrderSummary {
  return {
    id: order.id,
    number: order.number,
    customerId: order.customerId,
    customerName: order.customerName,
    status: order.status,
    priority: order.priority,
    region: order.region,
    warehouseId: order.warehouseId,
    itemCount: order.itemCount,
    total: order.total,
    placedAt: order.placedAt,
    updatedAt: order.updatedAt,
  }
}

function stockLevel(db: Database, record: StockRecord): StockLevel {
  const product = db.productsById.get(record.productId)
  if (!product)
    throw new HttpError(500, 'missing_product', `Product ${record.productId} is missing`)
  const totalOnHand = Object.values(record.onHand).reduce((sum, value) => sum + value, 0)
  return {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    category: product.category,
    reorderPoint: record.reorderPoint,
    onHand: { ...record.onHand },
    totalOnHand,
  }
}

function hashUnit(value: string): number {
  let hash = 2_166_136_261
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16_777_619)
  return (hash >>> 0) / 4_294_967_296
}

function percentDelta(current: number, previous: number): number {
  return previous === 0 ? 0 : Math.round(((current - previous) / previous) * 1_000) / 10
}

export interface ApiState {
  db: Database
  telemetryEvents: number
}

export function createRoutes(state: ApiState): Route[] {
  const routes: Route[] = []
  const add = (
    method: string,
    pattern: string,
    latencyMs: Route['latencyMs'],
    handler: Handler,
    options: { public?: boolean } = {},
  ) => {
    routes.push({
      method,
      pattern,
      latencyMs,
      handler,
      public: options.public ?? false,
      ...compilePattern(pattern),
    })
  }
  const db = () => state.db
  const currentUser = (context: RequestContext): User => {
    const user = db().team.find((member) => member.id === context.userId)
    if (!user) throw new HttpError(401, 'unauthenticated', 'Sign in to continue')
    return user
  }
  const requireWriter = (context: RequestContext): User => {
    const user = currentUser(context)
    if (!WRITE_ROLES.includes(user.role))
      throw new HttpError(403, 'forbidden', `${user.role} cannot change records`)
    return user
  }
  const findOrder = (id: string | undefined): Order => {
    const order = id ? db().ordersById.get(id) : undefined
    if (!order) throw new HttpError(404, 'order_not_found', `Order ${id ?? ''} does not exist`)
    return order
  }
  const findCustomer = (id: string | undefined): Customer => {
    const customer = id ? db().customersById.get(id) : undefined
    if (!customer)
      throw new HttpError(404, 'customer_not_found', `Customer ${id ?? ''} does not exist`)
    return customer
  }
  const recordActivity = (actor: User, subject: string, topic: string, message: string) => {
    const database = db()
    database.activity.push({
      id: database.nextActivityId++,
      at: new Date().toISOString(),
      actor: actor.name,
      subject,
      topic,
      message,
    })
  }
  const recentOrders = (fromDaysAgo: number, toDaysAgo: number) =>
    db().orders.filter((order) => {
      const placed = Date.parse(order.placedAt)
      return placed > REFERENCE_NOW - fromDaysAgo * DAY && placed <= REFERENCE_NOW - toDaysAgo * DAY
    })

  add(
    'POST',
    '/api/auth/login',
    350,
    ({ body }) => {
      const { email, password } = parse(loginBody, body)
      const user = db().team.find((member) => member.email === email.toLowerCase())
      if (!user || password !== 'meridian')
        throw new HttpError(401, 'invalid_credentials', 'Email or password is incorrect')
      const { lastActiveAt: _lastActiveAt, ...profile } = user
      return { token: `tok-${user.id}`, user: profile }
    },
    { public: true },
  )
  add('GET', '/api/auth/me', 80, (context) => {
    const { lastActiveAt: _lastActiveAt, ...profile } = currentUser(context) as TeamMember
    return profile
  })

  add('GET', '/api/orders', 300, ({ query }): ListResult<OrderSummary> => {
    const statuses = new Set((query.get('status') ?? '').split(',').filter(Boolean))
    const region = query.get('region')
    const term = (query.get('q') ?? '').trim().toLowerCase()
    const items = db()
      .orders.filter(
        (order) =>
          (statuses.size === 0 || statuses.has(order.status)) &&
          (!region || order.region === region) &&
          (!term ||
            order.number.toLowerCase().includes(term) ||
            order.customerName.toLowerCase().includes(term)),
      )
      .map(summarize)
    return { items, total: items.length }
  })
  add('GET', '/api/orders/:id', 260, ({ params }) => findOrder(params.id))
  add(
    'GET',
    '/api/orders/:id/shipments',
    260,
    ({ params }) => db().shipments.get(findOrder(params.id).id) ?? [],
  )
  add('GET', '/api/orders/:id/activity', 180, ({ params }) => {
    const order = findOrder(params.id)
    return db()
      .activity.filter((event) => event.topic === `order:${order.id}`)
      .reverse()
  })
  add('PATCH', '/api/orders/:id', 320, (context) => {
    const user = requireWriter(context)
    const order = findOrder(context.params.id)
    const update = parse(orderUpdateBody, context.body)
    if (update.status && order.status === 'cancelled' && update.status !== 'cancelled') {
      throw new HttpError(
        409,
        'order_cancelled',
        `${order.number} is cancelled and cannot change status`,
      )
    }
    Object.assign(order, update, { updatedAt: new Date().toISOString() })
    if (update.status)
      recordActivity(
        user,
        order.number,
        `order:${order.id}`,
        `${order.number} moved to ${update.status.replace('_', ' ')}`,
      )
    return order
  })
  add('POST', '/api/orders/bulk', 450, (context) => {
    const user = requireWriter(context)
    const { ids, action } = parse(bulkBody, context.body)
    const nextStatus: Record<BulkOrderAction, OrderStatus> = {
      mark_shipped: 'shipped',
      hold: 'on_hold',
      cancel: 'cancelled',
    }
    let updated = 0
    for (const id of ids) {
      const order = db().ordersById.get(id)
      if (!order || order.status === 'cancelled' || order.status === 'delivered') continue
      order.status = nextStatus[action]
      order.updatedAt = new Date().toISOString()
      updated++
      recordActivity(
        user,
        order.number,
        `order:${order.id}`,
        `${order.number} moved to ${order.status.replace('_', ' ')}`,
      )
    }
    return { updated, skipped: ids.length - updated }
  })
  add('POST', '/api/orders', 400, (context) => {
    const user = requireWriter(context)
    const input = parse(newOrderBody, context.body)
    const database = db()
    const customer = findCustomer(input.customerId)
    const warehouse = database.warehouses.find((entry) => entry.id === input.warehouseId)
    if (!warehouse) throw new HttpError(422, 'validation_failed', 'warehouseId: unknown warehouse')
    const lines = input.lines.map((line) => {
      const product = database.productsById.get(line.productId)
      if (!product)
        throw new HttpError(422, 'validation_failed', `lines: unknown product ${line.productId}`)
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: line.quantity,
        unitPrice: product.unitPrice,
      }
    })
    const now = new Date().toISOString()
    const sequence = database.nextOrderNumber++
    const order: Order = {
      id: `o-${sequence}`,
      number: `SO-${sequence}`,
      customerId: customer.id,
      customerName: customer.name,
      status: 'pending',
      priority: input.priority as Order['priority'],
      region: customer.region,
      warehouseId: warehouse.id,
      carrierId: 'car-atlas',
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      total:
        Math.round(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0) * 100) /
        100,
      placedAt: now,
      updatedAt: now,
      lines,
      shippingAddress: input.shippingAddress,
      notes: input.notes,
    }
    database.orders.push(order)
    database.ordersById.set(order.id, order)
    customer.openOrders += 1
    recordActivity(user, order.number, `order:${order.id}`, `${order.number} created`)
    return order
  })

  add('GET', '/api/customers', 220, ({ query }): Page<Customer> => {
    const page = intParam(query, 'page', 1, 10_000)
    const pageSize = intParam(query, 'pageSize', 25, 100)
    const term = (query.get('q') ?? '').trim().toLowerCase()
    const tier = query.get('tier')
    const matching = db().customers.filter(
      (customer) =>
        (!tier || customer.tier === tier) &&
        (!term ||
          customer.name.toLowerCase().includes(term) ||
          customer.contactName.toLowerCase().includes(term)),
    )
    return {
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      total: matching.length,
      page,
      pageSize,
    }
  })
  add('GET', '/api/customers/:id', 200, ({ params }) => findCustomer(params.id))
  add('GET', '/api/customers/:id/orders', 240, ({ params }) => {
    const customer = findCustomer(params.id)
    return db()
      .orders.filter((order) => order.customerId === customer.id)
      .slice(-20)
      .reverse()
      .map(summarize)
  })
  add('PATCH', '/api/customers/:id', 300, (context) => {
    const user = requireWriter(context)
    const customer = findCustomer(context.params.id)
    const update = parse(customerUpdateBody, context.body)
    Object.assign(customer, update)
    if (update.name) {
      for (const order of db().orders)
        if (order.customerId === customer.id) order.customerName = update.name
    }
    recordActivity(
      user,
      customer.name,
      `customer:${customer.id}`,
      `${customer.name} profile updated`,
    )
    return customer
  })

  add('GET', '/api/products', 260, () => db().products)
  add('GET', '/api/warehouses', 90, () => db().warehouses)
  add('GET', '/api/carriers', 90, () => db().carriers)

  add('GET', '/api/inventory', 280, ({ query }): ListResult<StockLevel> => {
    const term = (query.get('q') ?? '').trim().toLowerCase()
    const lowOnly = query.get('low') === 'true'
    const items = [...db().stock.values()]
      .map((record) => stockLevel(db(), record))
      .filter(
        (level) =>
          (!term ||
            level.name.toLowerCase().includes(term) ||
            level.sku.toLowerCase().includes(term)) &&
          (!lowOnly || level.totalOnHand < level.reorderPoint),
      )
    return { items, total: items.length }
  })
  add('POST', '/api/inventory/:productId/adjust', 300, (context) => {
    const user = requireWriter(context)
    const record = db().stock.get(context.params.productId ?? '')
    if (!record)
      throw new HttpError(
        404,
        'product_not_found',
        `Product ${context.params.productId ?? ''} does not exist`,
      )
    const { warehouseId, delta, reason } = parse(adjustmentBody, context.body)
    const current = record.onHand[warehouseId]
    if (current === undefined)
      throw new HttpError(422, 'validation_failed', 'warehouseId: unknown warehouse')
    if (current + delta < 0)
      throw new HttpError(409, 'insufficient_stock', `Only ${current} units on hand`)
    record.onHand[warehouseId] = current + delta
    recordActivity(
      user,
      record.productId,
      `inventory:${record.productId}`,
      `Stock adjusted by ${delta} (${reason})`,
    )
    return stockLevel(db(), record)
  })

  add('GET', '/api/dashboard/summary', 240, (): DashboardSummary => {
    const current = recentOrders(30, 0)
    const previous = recentOrders(60, 30)
    const revenue = (orders: Order[]) =>
      orders
        .filter((order) => order.status !== 'cancelled')
        .reduce((sum, order) => sum + order.total, 0)
    const fulfillment = (orders: Order[]) => {
      const active = orders.filter((order) => order.status !== 'cancelled')
      const done = active.filter(
        (order) => order.status === 'shipped' || order.status === 'delivered',
      )
      return active.length === 0 ? 0 : Math.round((done.length / active.length) * 1_000) / 10
    }
    const backlog = db().orders.filter((order) => OPEN_STATUSES.has(order.status)).length
    return {
      revenue: Math.round(revenue(current)),
      revenueDelta: percentDelta(revenue(current), revenue(previous)),
      orders: current.length,
      ordersDelta: percentDelta(current.length, previous.length),
      fulfillmentRate: fulfillment(current),
      fulfillmentDelta: Math.round((fulfillment(current) - fulfillment(previous)) * 10) / 10,
      backlog,
      backlogDelta: percentDelta(backlog, Math.round(backlog * 0.92)),
    }
  })
  add('GET', '/api/dashboard/orders-trend', 320, ({ query }): TrendPoint[] => {
    const days = intParam(query, 'days', 30, 120)
    return Array.from({ length: days }, (_, index) => {
      const dayStart = REFERENCE_NOW - (days - index) * DAY
      const orders = db().orders.filter((order) => {
        const placed = Date.parse(order.placedAt)
        return placed > dayStart && placed <= dayStart + DAY
      })
      return {
        date: new Date(dayStart + DAY).toISOString().slice(0, 10),
        orders: orders.length,
        revenue: Math.round(orders.reduce((sum, order) => sum + order.total, 0)),
      }
    })
  })
  add('GET', '/api/dashboard/revenue-by-region', 200, (): RegionRevenue[] =>
    REGIONS.map((region) => ({
      region,
      revenue: Math.round(
        recentOrders(30, 0)
          .filter((order) => order.region === region && order.status !== 'cancelled')
          .reduce((sum, order) => sum + order.total, 0),
      ),
    })),
  )
  add('GET', '/api/dashboard/status-breakdown', 180, (): StatusCount[] =>
    ORDER_STATUSES.map((status) => ({
      status,
      count: db().orders.filter((order) => order.status === status).length,
    })),
  )
  add('GET', '/api/dashboard/carriers', 260, (): CarrierPerformance[] =>
    db().carriers.map((carrier) => {
      const shipments = db().orders.filter(
        (order) =>
          order.carrierId === carrier.id &&
          (order.status === 'shipped' || order.status === 'delivered'),
      ).length
      const unit = hashUnit(carrier.id)
      return {
        carrierId: carrier.id,
        name: carrier.name,
        shipments,
        onTimeRate: shipments === 0 ? null : Math.round((0.86 + unit * 0.12) * 1_000) / 10,
        averageTransitDays: shipments === 0 ? null : Math.round((2 + unit * 3) * 10) / 10,
      }
    }),
  )
  add('GET', '/api/dashboard/stock-summary', 200, (): StockSummary => {
    const levels = [...db().stock.values()].map((record) => stockLevel(db(), record))
    const low = levels.filter((level) => level.totalOnHand < level.reorderPoint)
    return {
      lowStock: low.length,
      outOfStock: levels.filter((level) => level.totalOnHand === 0).length,
      items: low
        .sort((a, b) => a.totalOnHand / a.reorderPoint - b.totalOnHand / b.reorderPoint)
        .slice(0, 5),
    }
  })

  add(
    'GET',
    '/api/search',
    ({ query }) => Math.min(1_200, Math.max(80, 200 * (6 - (query.get('q') ?? '').trim().length))),
    ({ query }): SearchResponse => {
      const term = (query.get('q') ?? '').trim()
      if (term.length < 2) return { query: term, results: [] }
      const needle = term.toLowerCase()
      const results: SearchResult[] = []
      for (const customer of db().customers) {
        if (results.length >= SEARCH_LIMIT) break
        if (customer.name.toLowerCase().includes(needle)) {
          results.push({
            type: 'customer',
            id: customer.id,
            title: customer.name,
            subtitle: `${customer.tier} · ${customer.region}`,
          })
        }
      }
      for (const order of db().orders) {
        if (results.length >= SEARCH_LIMIT) break
        if (order.number.toLowerCase().includes(needle)) {
          results.push({
            type: 'order',
            id: order.id,
            title: order.number,
            subtitle: order.customerName,
          })
        }
      }
      for (const product of db().products) {
        if (results.length >= SEARCH_LIMIT) break
        if (product.name.toLowerCase().includes(needle)) {
          results.push({
            type: 'product',
            id: product.id,
            title: product.name,
            subtitle: product.sku,
          })
        }
      }
      return { query: term, results }
    },
  )

  add('GET', '/api/activity', 100, ({ query }) => {
    const after = Number.parseInt(query.get('after') ?? '0', 10) || 0
    return db().activity.filter((event) => event.id > after)
  })
  add('GET', '/api/notifications', 160, () => db().notifications)
  add('POST', '/api/notifications/read-all', 140, () => {
    for (const notification of db().notifications) notification.read = true
    return { unread: 0 }
  })

  add('GET', '/api/team', 200, () => db().team)
  add('PATCH', '/api/team/:id', 260, (context) => {
    const user = currentUser(context)
    if (user.role !== 'admin') throw new HttpError(403, 'forbidden', 'Only admins can change roles')
    const member = db().team.find((entry) => entry.id === context.params.id)
    if (!member)
      throw new HttpError(
        404,
        'member_not_found',
        `Member ${context.params.id ?? ''} does not exist`,
      )
    member.role = parse(roleBody, context.body).role
    return member
  })
  add('GET', '/api/settings/profile', 150, () => db().profile)
  add('PUT', '/api/settings/profile', 260, (context) => {
    requireWriter(context)
    db().profile = parse(profileBody, context.body)
    return db().profile
  })
  add('GET', '/api/settings/notifications', 150, () => db().preferences)
  add('PUT', '/api/settings/notifications', 220, (context) => {
    db().preferences = parse(preferencesBody, context.body)
    return db().preferences
  })
  add('GET', '/api/audit-log', 650, ({ query }): Page<(typeof state.db.audit)[number]> => {
    const page = intParam(query, 'page', 1, 100)
    const pageSize = 20
    const items = db().audit.slice((page - 1) * pageSize, page * pageSize)
    return { items, total: db().audit.length, page, pageSize }
  })
  add('POST', '/api/telemetry', 40, ({ body }) => {
    parse(telemetryBody, body)
    state.telemetryEvents++
    return { accepted: true }
  })

  return routes
}
