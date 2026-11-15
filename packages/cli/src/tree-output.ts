import { isRecord } from './guards'
import {
  encodeText,
  fieldsWithLayout,
  flowText,
  hoistSharedFields,
  scalarText,
} from './text-output'

type NodeId = string | number

interface TreeNode {
  id: NodeId
  name: string
  depth: number
  fields: Record<string, unknown>
}

/** `react_get_tree`: one line per node, `name #id {other fields}`, nested under its parent so `parentId` needs no column. */
export function renderTreeText(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.nodes)) return encodeText(value)
  const nodes = treeNodes(value.nodes)
  if (!nodes) return encodeText(value)
  return fieldsWithLayout(value, 'nodes', () => nodeLines(nodes)).join('\n')
}

function nodeLines(nodes: TreeNode[]): string[] {
  const { shared, rest } = hoistSharedFields(nodes.map((node) => node.fields))
  return [
    `nodes[${nodes.length}] (name #id {fields}, children indented under their parent):`,
    ...(shared === null ? [] : [`  each: ${flowText(shared)}`]),
    ...nodes.map((node, index) => {
      const remaining = rest[index] as Record<string, unknown>
      const extra = Object.keys(remaining).length === 0 ? '' : ` ${flowText(remaining)}`
      return `${'  '.repeat(node.depth + 1)}${scalarText(node.name)} #${scalarText(node.id)}${extra}`
    }),
  ]
}

/** Nodes in depth-first order whose parent is an open ancestor; null when the list cannot be shown as nesting. */
function treeNodes(raw: readonly unknown[]): TreeNode[] | null {
  const nodes: TreeNode[] = []
  const ancestors: NodeId[] = []
  const seen = new Set<NodeId>()
  for (const entry of raw) {
    if (!isRecord(entry)) return null
    const { id, name, parentId, ...fields } = entry
    if (!isNodeId(id) || typeof name !== 'string' || seen.has(id)) return null
    if (!Object.hasOwn(entry, 'parentId')) return null
    if (parentId === null) {
      ancestors.length = 0
    } else {
      if (!isNodeId(parentId)) return null
      const parentDepth = ancestors.lastIndexOf(parentId)
      if (parentDepth < 0) return null
      ancestors.length = parentDepth + 1
    }
    seen.add(id)
    nodes.push({ id, name, depth: ancestors.length, fields })
    ancestors.push(id)
  }
  return nodes
}

function isNodeId(value: unknown): value is NodeId {
  return (typeof value === 'number' && Number.isFinite(value)) || typeof value === 'string'
}
