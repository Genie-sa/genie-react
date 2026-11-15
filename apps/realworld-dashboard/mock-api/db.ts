import type {
  ActivityEvent,
  AuditEntry,
  Carrier,
  Customer,
  CustomerTier,
  Notification,
  NotificationPreferences,
  Order,
  OrderPriority,
  OrderStatus,
  Product,
  Profile,
  Region,
  Shipment,
  ShipmentStatus,
  TeamMember,
  Warehouse,
} from '../src/api/types.ts'
import { createRandom, type Random } from './random.ts'

export const REFERENCE_NOW = Date.parse('2026-03-02T09:00:00.000Z')
const DAY_MS = 86_400_000

export const ORDER_COUNT = 6_000
export const CUSTOMER_COUNT = 1_200
export const PRODUCT_COUNT = 2_400

export interface StockRecord {
  productId: string
  reorderPoint: number
  onHand: Record<string, number>
}

export interface Database {
  warehouses: Warehouse[]
  carriers: Carrier[]
  products: Product[]
  productsById: Map<string, Product>
  stock: Map<string, StockRecord>
  customers: Customer[]
  customersById: Map<string, Customer>
  orders: Order[]
  ordersById: Map<string, Order>
  shipments: Map<string, Shipment[]>
  activity: ActivityEvent[]
  team: TeamMember[]
  notifications: Notification[]
  audit: AuditEntry[]
  profile: Profile
  preferences: NotificationPreferences
  nextActivityId: number
  nextOrderNumber: number
}

const REGIONS: readonly Region[] = ['NA', 'EMEA', 'APAC', 'LATAM']

const WAREHOUSES: readonly Warehouse[] = [
  { id: 'wh-reno', name: 'Reno DC', city: 'Reno', region: 'NA' },
  { id: 'wh-columbus', name: 'Columbus DC', city: 'Columbus', region: 'NA' },
  { id: 'wh-rotterdam', name: 'Rotterdam Hub', city: 'Rotterdam', region: 'EMEA' },
  { id: 'wh-leipzig', name: 'Leipzig Hub', city: 'Leipzig', region: 'EMEA' },
  { id: 'wh-singapore', name: 'Singapore Hub', city: 'Singapore', region: 'APAC' },
  { id: 'wh-saopaulo', name: 'São Paulo DC', city: 'São Paulo', region: 'LATAM' },
]

const CARRIERS: readonly Carrier[] = [
  { id: 'car-atlas', name: 'Atlas Parcel' },
  { id: 'car-bluewave', name: 'Bluewave Logistics' },
  { id: 'car-northstar', name: 'Northstar Freight' },
  { id: 'car-kite', name: 'Kite Express' },
  { id: 'car-meridian', name: 'Meridian Ground' },
  { id: 'car-polar', name: 'Polar Freight' },
]
const ACTIVE_CARRIER_IDS = CARRIERS.slice(0, 5).map((carrier) => carrier.id)

const CATEGORIES = ['Packaging', 'Electronics', 'Safety', 'Tools', 'Office', 'Cleaning', 'Storage']
const PRODUCT_NOUNS: Record<string, readonly string[]> = {
  Packaging: ['Stretch Film', 'Corrugated Box', 'Packing Tape', 'Void Fill', 'Pallet Wrap'],
  Electronics: ['Barcode Scanner', 'Label Printer', 'USB Hub', 'Rugged Tablet', 'Headset'],
  Safety: ['Hi-Vis Vest', 'Safety Glasses', 'Work Gloves', 'Hard Hat', 'First Aid Kit'],
  Tools: ['Box Cutter', 'Pallet Jack', 'Torque Wrench', 'Tape Gun', 'Hand Truck'],
  Office: ['Shipping Labels', 'Clipboard', 'Marker Set', 'Toner Cartridge', 'Desk Lamp'],
  Cleaning: ['Floor Cleaner', 'Microfiber Pack', 'Spill Kit', 'Trash Liners', 'Degreaser'],
  Storage: ['Bin Shelf', 'Stack Tote', 'Wire Rack', 'Drawer Cabinet', 'Pallet Rack Beam'],
}
const PRODUCT_GRADES = ['Lite', 'Standard', 'Pro', 'Max', 'XL', 'Compact', 'Heavy Duty', 'Eco']

const COMPANY_PREFIXES = [
  'Acme',
  'Apex',
  'Bright',
  'Cobalt',
  'Delta',
  'Evergreen',
  'Fulcrum',
  'Granite',
  'Harbor',
  'Ion',
  'Juniper',
  'Keystone',
  'Lumen',
  'Mosaic',
  'Nimbus',
  'Orchid',
  'Pioneer',
  'Quarry',
  'Redwood',
  'Summit',
  'Tidal',
  'Union',
  'Vertex',
  'Willow',
]
const COMPANY_SUFFIXES = [
  'Supply',
  'Retail',
  'Industries',
  'Labs',
  'Outfitters',
  'Goods',
  'Health',
  'Foods',
  'Systems',
  'Mercantile',
]
const FIRST_NAMES = [
  'Amara',
  'Ben',
  'Chloe',
  'Diego',
  'Elena',
  'Farah',
  'Gabe',
  'Hana',
  'Ivan',
  'Jada',
  'Kenji',
  'Lina',
  'Mateo',
  'Noor',
  'Omar',
  'Priya',
  'Quinn',
  'Rosa',
  'Sami',
  'Tara',
]
const LAST_NAMES = [
  'Okafor',
  'Lindqvist',
  'Moreau',
  'Silva',
  'Haddad',
  'Kowalski',
  'Nakamura',
  'Reyes',
  'Schmidt',
  'Patel',
  'Novak',
  'Adeyemi',
  'Costa',
  'Fischer',
  'Ibrahim',
]
const STREETS = ['Harbor Way', 'Mill Rd', 'Commerce Blvd', 'Station St', 'Dock Ave', 'Ridge Ln']
const CITIES: Record<Region, readonly string[]> = {
  NA: ['Austin, TX', 'Denver, CO', 'Toronto, ON', 'Seattle, WA'],
  EMEA: ['Lyon, FR', 'Hamburg, DE', 'Leeds, UK', 'Milan, IT'],
  APAC: ['Osaka, JP', 'Melbourne, AU', 'Pune, IN', 'Busan, KR'],
  LATAM: ['Monterrey, MX', 'Bogotá, CO', 'Santiago, CL', 'Curitiba, BR'],
}

const TEAM: readonly Omit<TeamMember, 'lastActiveAt'>[] = [
  {
    id: 'u-admin',
    name: 'Morgan Reyes',
    email: 'morgan@meridian.test',
    role: 'admin',
    title: 'Head of Operations',
  },
  {
    id: 'u-manager',
    name: 'Priya Natarajan',
    email: 'priya@meridian.test',
    role: 'manager',
    title: 'Fulfillment Manager',
  },
  {
    id: 'u-agent',
    name: 'Sami Haddad',
    email: 'sami@meridian.test',
    role: 'agent',
    title: 'Support Agent',
  },
  {
    id: 'u-viewer',
    name: 'Lina Fischer',
    email: 'lina@meridian.test',
    role: 'viewer',
    title: 'Finance Analyst',
  },
  {
    id: 'u-05',
    name: 'Kenji Nakamura',
    email: 'kenji@meridian.test',
    role: 'agent',
    title: 'Support Agent',
  },
  {
    id: 'u-06',
    name: 'Rosa Costa',
    email: 'rosa@meridian.test',
    role: 'manager',
    title: 'Warehouse Lead',
  },
  {
    id: 'u-07',
    name: 'Omar Ibrahim',
    email: 'omar@meridian.test',
    role: 'agent',
    title: 'Returns Specialist',
  },
  {
    id: 'u-08',
    name: 'Elena Moreau',
    email: 'elena@meridian.test',
    role: 'viewer',
    title: 'Account Executive',
  },
  {
    id: 'u-09',
    name: 'Ben Okafor',
    email: 'ben@meridian.test',
    role: 'agent',
    title: 'Support Agent',
  },
  {
    id: 'u-10',
    name: 'Tara Novak',
    email: 'tara@meridian.test',
    role: 'manager',
    title: 'Carrier Relations',
  },
]

const STATUS_WEIGHTS: readonly (readonly [OrderStatus, number])[] = [
  ['pending', 14],
  ['processing', 18],
  ['on_hold', 4],
  ['shipped', 22],
  ['delivered', 38],
  ['cancelled', 4],
]
const PRIORITY_WEIGHTS: readonly (readonly [OrderPriority, number])[] = [
  ['standard', 78],
  ['expedited', 18],
  ['critical', 4],
]
const TIER_WEIGHTS: readonly (readonly [CustomerTier, number])[] = [
  ['enterprise', 12],
  ['growth', 38],
  ['starter', 50],
]

const pad = (value: number, width: number) => String(value).padStart(width, '0')
const iso = (ms: number) => new Date(ms).toISOString()
const money = (value: number) => Math.round(value * 100) / 100

function buildProducts(random: Random): Product[] {
  return Array.from({ length: PRODUCT_COUNT }, (_, index) => {
    const category = random.pick(CATEGORIES)
    const noun = random.pick(PRODUCT_NOUNS[category] ?? ['Item'])
    return {
      id: `p-${pad(index + 1, 4)}`,
      sku: `${category.slice(0, 3).toUpperCase()}-${pad(1000 + index * 7, 5)}`,
      name: `${noun} ${random.pick(PRODUCT_GRADES)}`,
      category,
      unitPrice: money(random.int(400, 48_000) / 100),
    }
  })
}

function buildStock(random: Random, products: Product[]): Map<string, StockRecord> {
  const stock = new Map<string, StockRecord>()
  for (const [index, product] of products.entries()) {
    const reorderPoint = random.int(20, 120)
    const scarce = index % 23 === 0
    const onHand: Record<string, number> = {}
    for (const warehouse of WAREHOUSES) {
      onHand[warehouse.id] = scarce ? random.int(0, 6) : random.int(10, 260)
    }
    stock.set(product.id, { productId: product.id, reorderPoint, onHand })
  }
  return stock
}

function companyName(index: number): string {
  const prefix = COMPANY_PREFIXES[index % COMPANY_PREFIXES.length]
  const suffix =
    COMPANY_SUFFIXES[Math.floor(index / COMPANY_PREFIXES.length) % COMPANY_SUFFIXES.length]
  const branch = Math.floor(index / (COMPANY_PREFIXES.length * COMPANY_SUFFIXES.length))
  return branch === 0 ? `${prefix} ${suffix}` : `${prefix} ${suffix} ${branch + 1}`
}

function buildCustomers(random: Random): Customer[] {
  return Array.from({ length: CUSTOMER_COUNT }, (_, index) => {
    const region = random.pick(REGIONS)
    const first = random.pick(FIRST_NAMES)
    const last = random.pick(LAST_NAMES)
    const name = companyName(index)
    const domain = name.toLowerCase().replace(/[^a-z0-9]+/g, '')
    return {
      id: `c-${pad(index + 1, 4)}`,
      name,
      contactName: `${first} ${last}`,
      email: `${first.toLowerCase()}@${domain}.test`,
      phone: `+1 555 ${pad(random.int(100, 999), 3)} ${pad(random.int(0, 9999), 4)}`,
      tier: random.weighted(TIER_WEIGHTS),
      region,
      accountManager: random.pick(TEAM).name,
      notes: `${first} prefers ${random.pick(['email', 'phone', 'portal'])} updates. Ships mostly from ${random.pick(CITIES[region])}.`,
      relatedIds: [],
      createdAt: iso(REFERENCE_NOW - random.int(30, 1_400) * DAY_MS),
      lifetimeValue: 0,
      openOrders: 0,
    }
  })
}

function linkRelatedCustomers(random: Random, customers: Customer[]): void {
  for (const [index, customer] of customers.entries()) {
    const count = random.int(1, 3)
    const related = new Set<string>()
    while (related.size < count) {
      const candidate = customers[(index + random.int(1, customers.length - 1)) % customers.length]
      if (candidate && candidate.id !== customer.id) related.add(candidate.id)
    }
    customer.relatedIds = [...related]
  }
}

function shipmentStatusFor(status: OrderStatus): ShipmentStatus | null {
  if (status === 'shipped') return 'in_transit'
  if (status === 'delivered') return 'delivered'
  return null
}

function buildShipment(random: Random, order: Order, status: ShipmentStatus): Shipment {
  const carrier = CARRIERS.find((entry) => entry.id === order.carrierId) ?? CARRIERS[0]
  const placed = Date.parse(order.placedAt)
  const events = [
    { at: iso(placed + 6 * 3_600_000), location: order.warehouseId, description: 'Label created' },
    {
      at: iso(placed + 20 * 3_600_000),
      location: order.warehouseId,
      description: 'Picked up by carrier',
    },
  ]
  if (status === 'delivered') {
    events.push({
      at: iso(placed + random.int(2, 6) * DAY_MS),
      location: order.shippingAddress,
      description: 'Delivered',
    })
  }
  return {
    id: `sh-${order.number.slice(3)}`,
    orderId: order.id,
    carrierId: carrier?.id ?? 'car-atlas',
    carrierName: carrier?.name ?? 'Atlas Parcel',
    trackingNumber: `${(carrier?.id ?? 'car-atlas').slice(4, 7).toUpperCase()}${pad(random.int(0, 99_999_999), 8)}`,
    status,
    events,
  }
}

function buildOrders(
  random: Random,
  customers: Customer[],
  products: Product[],
): { orders: Order[]; shipments: Map<string, Shipment[]> } {
  const orders: Order[] = []
  const shipments = new Map<string, Shipment[]>()
  for (let index = 0; index < ORDER_COUNT; index++) {
    const customer = random.pick(customers)
    const status = random.weighted(STATUS_WEIGHTS)
    const placedAt =
      REFERENCE_NOW - Math.floor(((ORDER_COUNT - index) / ORDER_COUNT) * 120 * DAY_MS)
    const warehouses = WAREHOUSES.filter((warehouse) => warehouse.region === customer.region)
    const warehouse = random.pick(warehouses.length > 0 ? warehouses : WAREHOUSES)
    const lineCount = random.int(1, 5)
    const lines = Array.from({ length: lineCount }, () => {
      const product = random.pick(products)
      return {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: random.int(1, 24),
        unitPrice: product.unitPrice,
      }
    })
    const total = money(lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0))
    const number = `SO-${100_001 + index}`
    const order: Order = {
      id: `o-${100_001 + index}`,
      number,
      customerId: customer.id,
      customerName: customer.name,
      status,
      priority: random.weighted(PRIORITY_WEIGHTS),
      region: customer.region,
      warehouseId: warehouse.id,
      carrierId: random.pick(ACTIVE_CARRIER_IDS),
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      total,
      placedAt: iso(placedAt),
      updatedAt: iso(placedAt + random.int(1, 72) * 3_600_000),
      lines,
      shippingAddress: `${random.int(10, 9_800)} ${random.pick(STREETS)}, ${random.pick(CITIES[customer.region])}`,
      notes: '',
    }
    orders.push(order)
    customer.lifetimeValue = money(customer.lifetimeValue + total)
    if (status === 'pending' || status === 'processing' || status === 'on_hold')
      customer.openOrders += 1
    const shipmentStatus = shipmentStatusFor(status)
    if (shipmentStatus) shipments.set(order.id, [buildShipment(random, order, shipmentStatus)])
  }
  return { orders, shipments }
}

function buildActivity(random: Random, orders: Order[]): ActivityEvent[] {
  return orders.slice(-60).map((order, index) => ({
    id: index + 1,
    at: order.updatedAt,
    actor: random.pick(TEAM).name,
    subject: order.number,
    topic: `order:${order.id}`,
    message: `${order.number} moved to ${order.status.replace('_', ' ')}`,
  }))
}

function buildNotifications(random: Random, orders: Order[]): Notification[] {
  return orders.slice(-12).map((order, index) => ({
    id: `n-${pad(index + 1, 3)}`,
    at: order.updatedAt,
    title: order.priority === 'critical' ? 'Critical order needs attention' : 'Order updated',
    body: `${order.number} for ${order.customerName} is ${order.status.replace('_', ' ')}.`,
    read: index < 7 || random.chance(0.2),
  }))
}

function buildAudit(random: Random): AuditEntry[] {
  const actions = [
    'updated order',
    'adjusted stock',
    'invited member',
    'changed role',
    'exported orders',
  ]
  return Array.from({ length: 180 }, (_, index) => ({
    id: `a-${pad(index + 1, 4)}`,
    at: iso(REFERENCE_NOW - index * 3 * 3_600_000),
    actor: random.pick(TEAM).name,
    action: random.pick(actions),
    target: `SO-${100_001 + random.int(0, ORDER_COUNT - 1)}`,
  }))
}

export function createDatabase(seed: number): Database {
  const random = createRandom(seed)
  const products = buildProducts(random)
  const stock = buildStock(random, products)
  const customers = buildCustomers(random)
  linkRelatedCustomers(random, customers)
  const { orders, shipments } = buildOrders(random, customers, products)
  const activity = buildActivity(random, orders)
  return {
    warehouses: [...WAREHOUSES],
    carriers: [...CARRIERS],
    products,
    productsById: new Map(products.map((product) => [product.id, product])),
    stock,
    customers,
    customersById: new Map(customers.map((customer) => [customer.id, customer])),
    orders,
    ordersById: new Map(orders.map((order) => [order.id, order])),
    shipments,
    activity,
    team: TEAM.map((member, index) => ({
      ...member,
      lastActiveAt: iso(REFERENCE_NOW - index * 47 * 60_000),
    })),
    notifications: buildNotifications(random, orders),
    audit: buildAudit(random),
    profile: {
      name: 'Morgan Reyes',
      email: 'morgan@meridian.test',
      title: 'Head of Operations',
      timezone: 'America/Chicago',
    },
    preferences: {
      orderEscalations: true,
      dailyDigest: false,
      lowStockAlerts: true,
      mentions: true,
    },
    nextActivityId: activity.length + 1,
    nextOrderNumber: 100_001 + ORDER_COUNT,
  }
}

export const DEFAULT_SEED = 20_260_302
export const DAY = DAY_MS
