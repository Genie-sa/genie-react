import type { BridgeStatusMessage } from 'genie-react/protocol'
import { isRecord } from './guards'

export type ToolDescriptor = BridgeStatusMessage['tools'][number]

export type ToolsSelection =
  | { kind: 'tool'; tool: ToolDescriptor }
  | { kind: 'group'; tools: ToolDescriptor[] }
  | { kind: 'unknown'; message: string; suggestions: string[] }

/** Exact tool name → its full contract; a group or group family (`app` covers `app.cart`, `react` covers `react.tree`) → that listing; else suggestions, never a full dump. */
export function resolveToolsSelector(tools: ToolDescriptor[], selector: string): ToolsSelection {
  const tool = tools.find((candidate) => candidate.name === selector)
  if (tool) return { kind: 'tool', tool }
  const inGroup = tools.filter(
    (candidate) => candidate.group === selector || candidate.group.startsWith(`${selector}.`),
  )
  if (inGroup.length > 0) return { kind: 'group', tools: inGroup }

  const near = suggestToolNames(
    tools.map((candidate) => candidate.name),
    selector,
  )
  const groups = [...new Set(tools.map((candidate) => candidate.group))].sort()
  const hint = near.length > 0 ? `Did you mean: ${near.join(', ')}? ` : ''
  return {
    kind: 'unknown',
    message: `Unknown tool or group "${selector}". ${hint}Groups: ${groups.join(', ')}`,
    suggestions: near,
  }
}

/** Closest names to a mistyped one: substring matches first, then small edit distances; empty when nothing is plausibly meant. */
export function suggestToolNames(names: readonly string[], query: string, limit = 5): string[] {
  const needle = query.toLowerCase()
  const maxDistance = Math.max(2, Math.floor(needle.length / 4))
  return names
    .map((name) => {
      const candidate = name.toLowerCase()
      const contains = candidate.includes(needle) || needle.includes(candidate)
      return { name, contains, distance: editDistance(needle, candidate) }
    })
    .filter(({ contains, distance }) => contains || distance <= maxDistance)
    .sort(
      (a, b) =>
        Number(b.contains) - Number(a.contains) ||
        a.distance - b.distance ||
        a.name.localeCompare(b.name),
    )
    .slice(0, limit)
    .map(({ name }) => name)
}

function editDistance(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      const substitution = (previous[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1)
      current[j] = Math.min((previous[j] ?? 0) + 1, (current[j - 1] ?? 0) + 1, substitution)
    }
    previous = current
  }
  return previous[b.length] ?? 0
}

const ACTION_PREFIXES: Record<string, string[]> = {
  router: ['router_'],
  query: ['query_', 'mutation_'],
  'react.render': ['react_'],
  'react.inspect': ['react_'],
  'react.tree': ['react_'],
  'react.profile': ['react_'],
  plugin: ['plugin_'],
}

/** Mutations pool in the generic action group; surface a domain's actions beside its reads. */
export function relatedActions(tools: ToolDescriptor[], group: string): string[] {
  const prefixes = ACTION_PREFIXES[group]
  if (!prefixes) return []
  return tools
    .filter(
      (tool) => tool.group === 'action' && prefixes.some((prefix) => tool.name.startsWith(prefix)),
    )
    .map((tool) => tool.name)
}

export function groupIndex(
  appName: string | undefined,
  tools: ToolDescriptor[],
): {
  app: string | null
  total: number
  groups: Array<{ group: string; count: number; tools: string[] }>
} {
  const byGroup = new Map<string, string[]>()
  for (const tool of tools) {
    const list = byGroup.get(tool.group) ?? []
    list.push(tool.name)
    byGroup.set(tool.group, list)
  }
  return {
    app: appName ?? null,
    total: tools.length,
    groups: [...byGroup]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([group, names]) => ({ group, count: names.length, tools: names })),
  }
}

export function slimDescriptor(tool: ToolDescriptor): {
  name: string
  title: string
  params: string
  available?: boolean
} {
  return {
    name: tool.name,
    title: tool.title,
    params: describeToolParams(tool.inputJsonSchema),
    ...(tool.available === false ? { available: false } : {}),
  }
}

function describeToolParams(schema: unknown): string {
  const object = objectSchema(schema)
  const properties = object && isRecord(object.properties) ? object.properties : {}
  const names = Object.keys(properties)
  if (names.length === 0) return '(no args)'
  const required = new Set(Array.isArray(object?.required) ? object.required : [])
  return names
    .map((name) => {
      const property = properties[name]
      const parts = [`${name}${required.has(name) ? '' : '?'}: ${jsonSchemaType(property)}`]
      if (isRecord(property)) {
        const constraints = jsonSchemaConstraints(property)
        if (constraints) parts.push(constraints)
        if (property.default !== undefined)
          parts.push(`(default ${JSON.stringify(property.default)})`)
      }
      return parts.join(' ')
    })
    .join(', ')
}

/** Finds the object node carrying properties, including refined schemas wrapped in allOf. */
function objectSchema(schema: unknown): Record<string, unknown> | null {
  if (!isRecord(schema)) return null
  if (isRecord(schema.properties)) return schema
  if (Array.isArray(schema.allOf)) {
    for (const part of schema.allOf) {
      const found = objectSchema(part)
      if (found) return found
    }
  }
  return null
}

function jsonSchemaType(schema: unknown): string {
  if (!isRecord(schema)) return 'any'
  if (Array.isArray(schema.enum))
    return schema.enum.map((value) => JSON.stringify(value)).join(' | ')
  if (Array.isArray(schema.anyOf)) return [...new Set(schema.anyOf.map(jsonSchemaType))].join(' | ')
  if (typeof schema.type === 'string') return schema.type
  if (Array.isArray(schema.type)) return schema.type.join(' | ')
  return 'any'
}

function jsonSchemaConstraints(schema: Record<string, unknown>): string | null {
  const numberRange = range(schema.minimum, schema.maximum)
  if (numberRange) return numberRange
  const lengthRange = range(schema.minLength, schema.maxLength, 'length ')
  if (lengthRange) return lengthRange
  return range(schema.minItems, schema.maxItems, 'items ')
}

function range(minimum: unknown, maximum: unknown, label = ''): string | null {
  const min = typeof minimum === 'number' ? minimum : null
  const max = typeof maximum === 'number' ? maximum : null
  if (min !== null && max !== null) return `[${label}${min}..${max}]`
  if (min !== null) return `[${label}>=${min}]`
  if (max !== null) return `[${label}<=${max}]`
  return null
}
