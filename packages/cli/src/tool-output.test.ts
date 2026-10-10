import type { BridgeStatusMessage } from 'genie-react/protocol'
import { describe, expect, it } from 'vitest'
import {
  groupIndex,
  outlineJsonSchema,
  relatedActions,
  resolveToolsSelector,
  slimDescriptor,
  toolDetail,
} from './tool-output'

type ToolDescriptor = BridgeStatusMessage['tools'][number]

function listing(tools: ToolDescriptor[]): string {
  return tools.map((descriptor) => slimDescriptor(descriptor).params).join('\n')
}

function tool(partial: Partial<ToolDescriptor> & { name: string }): ToolDescriptor {
  return { title: partial.name, group: 'query', ...partial } as ToolDescriptor
}

const CATALOG = [
  tool({ name: 'react_get_renders', title: 'Why-did-render', group: 'react.render' }),
  tool({ name: 'react_clear_renders', title: 'Clear counters', group: 'react.render' }),
  tool({
    name: 'query_list',
    title: 'List queries',
    group: 'query',
    inputJsonSchema: {
      type: 'object',
      properties: {
        staleOnly: { type: 'boolean', default: false },
        limit: { type: 'integer', default: 100, description: 'Max entries.' },
      },
      required: [],
    },
  }),
  tool({
    name: 'plugin_get_events',
    title: 'Get plugin events',
    group: 'plugin',
    description: 'Read buffered plugin events.',
    inputJsonSchema: {
      type: 'object',
      properties: {
        pluginId: { type: 'string', minLength: 1 },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      },
      required: ['pluginId'],
    },
  }),
]

describe('tool output', () => {
  it('marks optional params and lists required params bare', () => {
    const output = listing([
      tool({
        name: 'plugin_get_events',
        title: 'Get plugin events',
        group: 'plugin',
        inputJsonSchema: {
          type: 'object',
          properties: { pluginId: { type: 'string' }, limit: { type: 'integer' } },
          required: ['pluginId'],
        },
      }),
    ])

    expect(output).toBe('pluginId: string, limit?: integer')
  })

  it('exposes bounds and defaults before invocation in the compact JSON catalog', () => {
    const descriptor = tool({
      name: 'react_get_renders',
      inputJsonSchema: {
        type: 'object',
        properties: {
          component: { type: 'string', minLength: 1 },
          sort: { enum: ['renders', 'updates'], default: 'renders' },
          limit: { type: 'integer', minimum: 1, maximum: 200, default: 40 },
          appOnly: { type: 'boolean', default: false },
        },
        required: ['component'],
      },
    })
    const output = slimDescriptor(descriptor).params
    expect(output).toContain('component: string [length >=1]')
    expect(output).toContain('sort?: "renders" | "updates" (default "renders")')
    expect(output).toContain('limit?: integer [1..200] (default 40)')
    expect(output).toContain('appOnly?: boolean (default false)')
  })

  it('renders enum unions and no-argument tools', () => {
    const output = listing([
      tool({
        name: 'react_get_renders',
        group: 'react.render',
        inputJsonSchema: {
          type: 'object',
          properties: { sort: { enum: ['renders', 'unstable'] } },
          required: [],
        },
      }),
      tool({
        name: 'query_clear',
        group: 'query',
        inputJsonSchema: { type: 'object', properties: {} },
      }),
    ])

    expect(output).toBe('sort?: "renders" | "unstable"\n(no args)')
  })

  it('unwraps the allOf wrapper a refined schema emits', () => {
    const output = listing([
      tool({
        name: 'query_get',
        inputJsonSchema: {
          allOf: [
            {
              type: 'object',
              properties: { queryHash: { type: 'string' }, queryKey: { type: 'array' } },
              required: [],
            },
          ],
        },
      }),
    ])

    expect(output).toContain('queryHash?: string, queryKey?: array')
  })

  it('indexes tools by sorted group with counts and names', () => {
    expect(groupIndex('Demo', CATALOG)).toEqual({
      app: 'Demo',
      total: 4,
      groups: [
        { group: 'plugin', count: 1, tools: ['plugin_get_events'] },
        { group: 'query', count: 1, tools: ['query_list'] },
        { group: 'react.render', count: 2, tools: ['react_get_renders', 'react_clear_renders'] },
      ],
    })
  })

  it('selects exact tools, then groups, then suggestions', () => {
    expect(resolveToolsSelector(CATALOG, 'query_list')).toMatchObject({ kind: 'tool' })
    const group = resolveToolsSelector(CATALOG, 'react.render')
    expect(group.kind).toBe('group')
    if (group.kind === 'group') expect(group.tools).toHaveLength(2)
    const unknown = resolveToolsSelector(CATALOG, 'renders')
    expect(unknown.kind).toBe('unknown')
    if (unknown.kind === 'unknown') {
      expect(unknown.message).toContain('react_get_renders')
      expect(unknown.message).toContain('Groups: plugin, query, react.render')
    }
  })

  it('surfaces a domain’s mutations from the shared action group', () => {
    const catalog = [
      ...CATALOG,
      tool({ name: 'router_navigate', title: 'Navigate', group: 'action' }),
      tool({ name: 'query_invalidate', title: 'Invalidate', group: 'action' }),
      tool({ name: 'react_override_props', title: 'Override', group: 'action' }),
    ]
    expect(relatedActions(catalog, 'router')).toEqual(['router_navigate'])
    expect(relatedActions(catalog, 'query')).toEqual(['query_invalidate'])
    expect(relatedActions(catalog, 'react.render')).toEqual(['react_override_props'])
    expect(relatedActions(catalog, 'action')).toEqual([])
    expect(relatedActions(catalog, 'memory')).toEqual([])
  })
})

describe('group families', () => {
  const grouped = [
    tool({ name: 'app_increase_steps', title: 'Increase steps', group: 'app.steps' }),
    tool({ name: 'app_login_as', title: 'Login as', group: 'app' }),
    tool({ name: 'react_get_renders', title: 'Renders', group: 'react.render' }),
  ]

  it('a family selector covers the parent group and its subgroups', () => {
    const app = resolveToolsSelector(grouped, 'app')
    expect(app.kind).toBe('group')
    if (app.kind === 'group') expect(app.tools).toHaveLength(2)

    const react = resolveToolsSelector(grouped, 'react')
    expect(react.kind).toBe('group')
    if (react.kind === 'group')
      expect(react.tools.map((t) => t.name)).toEqual(['react_get_renders'])
  })
})

describe('tool detail output outline', () => {
  const outputJsonSchema = {
    anyOf: [
      {
        type: 'object',
        properties: {
          view: { type: 'string', const: 'summary' },
          components: { type: 'array', items: { $ref: '#/$defs/row' } },
          nextCursor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          note: { type: 'string' },
        },
        required: ['view', 'components', 'nextCursor'],
      },
      {
        type: 'object',
        properties: {
          view: { type: 'string', const: 'full' },
          components: { type: 'array', items: { type: 'object' } },
          nextCursor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          legacy: { type: 'integer' },
        },
        required: ['view', 'components', 'nextCursor', 'legacy'],
      },
    ],
    $defs: { row: { type: 'object', properties: { id: { type: 'integer' } } } },
  }

  it('lists top-level keys with shallow types and marks keys missing from a branch optional', () => {
    expect(outlineJsonSchema(outputJsonSchema)).toEqual({
      view: '"summary" | "full"',
      components: 'array<object>',
      nextCursor: 'string | null',
      'note?': 'string',
      'legacy?': 'integer',
    })
  })

  it('replaces the output schema with an outline unless the complete schema is requested', () => {
    const descriptor = tool({ name: 'react_get_renders', outputJsonSchema })
    expect(toolDetail(descriptor)).toEqual({
      name: 'react_get_renders',
      title: 'react_get_renders',
      group: 'query',
      output: {
        kind: 'outline',
        fields: outlineJsonSchema(outputJsonSchema),
        next: {
          command: 'genie-react tools react_get_renders --output-schema',
          argv: ['genie-react', 'tools', 'react_get_renders', '--output-schema'],
        },
      },
    })
    expect(toolDetail(descriptor, true)).toBe(descriptor)
    expect(toolDetail(tool({ name: 'devtools_status' }))).not.toHaveProperty('output')
  })
})
