/** Describe advertised constraints from the same schema that validates calls. */
export function schemaConstraints(schema: unknown): string {
  const parts: string[] = []
  const visit = (value: unknown, path: string): void => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return
    const node = value as Record<string, unknown>
    const constraints: string[] = []
    if (Array.isArray(node.enum))
      constraints.push(`one of ${node.enum.map((value) => JSON.stringify(value)).join(', ')}`)
    for (const [key, label] of [
      ['minimum', 'minimum'],
      ['maximum', 'maximum'],
      ['exclusiveMinimum', 'greater than'],
      ['exclusiveMaximum', 'less than'],
      ['minLength', 'minimum characters'],
      ['maxLength', 'maximum characters'],
      ['minItems', 'minimum items'],
      ['maxItems', 'maximum items'],
    ] as const) {
      if (typeof node[key] === 'number') constraints.push(`${label} ${node[key]}`)
    }
    if (path && constraints.length) parts.push(`${path}: ${constraints.join(', ')}`)
    if (node.properties && typeof node.properties === 'object') {
      for (const [name, child] of Object.entries(node.properties))
        visit(child, path ? `${path}.${name}` : name)
    }
    if (node.items) visit(node.items, `${path}[]`)
    for (const key of ['anyOf', 'oneOf', 'allOf']) {
      if (Array.isArray(node[key])) for (const child of node[key]) visit(child, path)
    }
  }
  visit(schema, '')
  return [...new Set(parts)].join('; ')
}
