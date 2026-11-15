import { isRecord } from './guards'
import {
  encodeText,
  FieldReader,
  fieldLines,
  fieldsWithLayout,
  flowText,
  hoistSharedFields,
  keyText,
  proseText,
  scalarText,
} from './text-output'

export type ToolsView = 'index' | 'group' | 'contract' | 'all'

/** Text for each `tools` view; every field the view does not lay out itself is still rendered. */
export function renderToolsText(view: ToolsView): (value: unknown) => string {
  switch (view) {
    case 'index':
      return renderToolIndexText
    case 'group':
      return renderToolGroupText
    case 'contract':
      return (value) => (isRecord(value) ? contractLines(value, '').join('\n') : encodeText(value))
    case 'all':
      return renderAllContractsText
  }
}

/** `tools`: one `group (count): tool,…` line per group. */
function renderToolIndexText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.groups) || !value.groups.every(isGroupEntry)) {
    return encodeText(value)
  }
  const groups = value.groups
  return fieldsWithLayout(value, 'groups', () => [
    `groups[${groups.length}] (group (count): tools):`,
    ...groups.map(
      ({ group, count, tools }) =>
        `  ${scalarText(group)} (${count}): ${tools.map(scalarText).join(',')}`,
    ),
  ]).join('\n')
}

function isGroupEntry(value: unknown): value is { group: string; count: number; tools: string[] } {
  return (
    isRecord(value) &&
    Object.keys(value).length === 3 &&
    typeof value.group === 'string' &&
    typeof value.count === 'number' &&
    Array.isArray(value.tools) &&
    value.tools.every((tool) => typeof tool === 'string')
  )
}

/** `tools <group>`: `name "title" (params)` per tool, the params signature quoted because the app supplies it. */
function renderToolGroupText(value: unknown): string {
  if (!Array.isArray(value) || !value.every(isRecord)) return encodeText(value)
  return [
    `[${value.length}] (name title params {other fields}):`,
    ...value.map((tool) => {
      const fields = new FieldReader(tool)
      const head = ['name', 'title', 'params'].map((key) => scalarText(fields.take(key)))
      const rest = fields.rest()
      return `  ${head.join(' ')}${Object.keys(rest).length === 0 ? '' : ` ${flowText(rest)}`}`
    }),
  ].join('\n')
}

/** `tools --all`: fields shared by every contract once, then each contract under its name. */
function renderAllContractsText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.tools) || !value.tools.every(isRecord)) {
    return encodeText(value)
  }
  const tools = value.tools
  return fieldsWithLayout(value, 'tools', () => {
    const { shared, rest: contracts } = hoistSharedFields(tools)
    return [
      `tools[${tools.length}]:`,
      ...(shared === null ? [] : [`  each: ${flowText(shared)}`]),
      ...(contracts as Record<string, unknown>[]).flatMap((contract) => {
        const lines = contractLines(contract, '    ')
        return [`  - ${lines[0]?.trimStart() ?? '{}'}`, ...lines.slice(1)]
      }),
    ]
  }).join('\n')
}

/** One tool contract: a `name "title"` line, then its fields, with arguments and the output outline one per line. */
function contractLines(contract: Record<string, unknown>, indent: string): string[] {
  const fields = new FieldReader(contract)
  const lines: string[] = []
  if (typeof contract.name === 'string' && typeof contract.title === 'string') {
    lines.push(`${indent}${scalarText(fields.take('name'))} ${scalarText(fields.take('title'))}`)
  }
  for (const [key, value] of Object.entries(fields.rest())) {
    if (key === 'inputJsonSchema' && isRecord(value)) lines.push(...schemaLines(value, indent))
    else if (key === 'output' && isOutline(value)) lines.push(...outlineLines(value, indent))
    else lines.push(...fieldLines(key, value, 0, indent))
  }
  return lines
}

interface OutputOutline {
  kind: 'outline'
  fields: Record<string, string>
  next?: unknown
}

function isOutline(value: unknown): value is OutputOutline {
  return (
    isRecord(value) &&
    value.kind === 'outline' &&
    isRecord(value.fields) &&
    Object.values(value.fields).every((type) => typeof type === 'string') &&
    Object.keys(value).every((key) => key === 'kind' || key === 'fields' || key === 'next')
  )
}

/** The CLI's outline of an output schema: `field?: type` per top-level field, the type verbatim with controls escaped. */
function outlineLines(outline: OutputOutline, indent: string): string[] {
  return [
    `${indent}output: outline (top-level fields; name? is optional)`,
    ...Object.entries(outline.fields).map(([field, type]) => {
      const optional = field.endsWith('?')
      const name = optional ? field.slice(0, -1) : field
      return `${indent}  ${keyText(name)}${optional ? '?' : ''}: ${proseText(type)}`
    }),
    ...(Object.hasOwn(outline, 'next') ? fieldLines('next', outline.next, 1, `${indent}  `) : []),
  ]
}

/** `inputJsonSchema {other keywords}:` then `name?: type keyword:value … — "description"` per property. */
function schemaLines(schema: Record<string, unknown>, indent: string): string[] {
  const fields = new FieldReader(schema)
  const properties = fields.take('properties')
  if (!isRecord(properties) || !Object.values(properties).every(isRecord)) {
    return fieldLines('inputJsonSchema', schema, 0, indent)
  }
  const names = Object.keys(properties)
  const required = fields.has('required') ? fields.take('required') : []
  const implied = impliedRequired(required, names)
  const rest = fields.rest()
  if (!implied) rest.required = required
  const header = Object.keys(rest).length === 0 ? '' : ` ${flowText(rest)}`
  return [
    `${indent}inputJsonSchema${header}: (arguments; name? is optional)`,
    ...names.map((name) =>
      propertyLine(
        name,
        properties[name] as Record<string, unknown>,
        implied?.has(name) ?? false,
        `${indent}  `,
      ),
    ),
  ]
}

/** The required set when `required` lists properties in their declared order, so `?` marks can carry it; else null. */
function impliedRequired(required: unknown, names: readonly string[]): Set<string> | null {
  if (!Array.isArray(required) || !required.every((name) => typeof name === 'string')) return null
  const positions = required.map((name) => names.indexOf(name))
  const ordered = positions.every(
    (position, index) => position >= 0 && (index === 0 || position > (positions[index - 1] ?? -1)),
  )
  return ordered ? new Set(required) : null
}

function propertyLine(
  name: string,
  schema: Record<string, unknown>,
  required: boolean,
  indent: string,
): string {
  const fields = new FieldReader(schema)
  const parts = [`${indent}${keyText(name)}${required ? '' : '?'}:`]
  if (fields.has('type')) parts.push(flowText(fields.take('type')))
  const description = fields.has('description') ? fields.take('description') : undefined
  for (const [key, value] of Object.entries(fields.rest())) {
    parts.push(`${keyText(key)}:${flowText(value)}`)
  }
  if (description !== undefined) parts.push(`— ${flowText(description)}`)
  return parts.join(' ')
}
