import { encode } from 'gpt-tokenizer/encoding/o200k_base'
import { describe, expect, it } from 'vitest'
import { renderBatchItemText } from './batch-output'
import { cliHelp, renderHelpText } from './cli-help'
import { renderEnvelopeText } from './cli-output'
import { renderToolsText } from './contract-output'
import { renderDoctorText } from './doctor-output'
import { encodeText, scalarText } from './text-output'
import { HOSTILE_STRINGS, recordedResults } from './text-output.test-support'
import { TOOL_TEXT_RENDERERS } from './tool-text-output'
import { renderVerificationText } from './verify-output'

type Path = Array<string | number>
type Renderer = (value: unknown) => string

/** Bespoke renderers and the recorded results they lay out; the generic encoder covers everything else. */
const BESPOKE: Array<{ name: string; render: Renderer; fixtures: string[] }> = [
  {
    name: 'tree',
    render: TOOL_TEXT_RENDERERS.react_get_tree as Renderer,
    fixtures: ['react_get_tree', 'react_get_tree-all'],
  },
  {
    name: 'render report',
    render: TOOL_TEXT_RENDERERS.react_get_renders as Renderer,
    fixtures: ['react_get_renders', 'react_get_renders-full', 'react_get_renders-after-error'],
  },
  {
    name: 'render causes',
    render: TOOL_TEXT_RENDERERS.react_render_causes as Renderer,
    fixtures: ['react_render_causes', 'react_render_causes-all'],
  },
  {
    name: 'timeline',
    render: TOOL_TEXT_RENDERERS.timeline_read as Renderer,
    fixtures: ['timeline_read'],
  },
  {
    name: 'capture comparison',
    render: TOOL_TEXT_RENDERERS.devtools_capture_compare as Renderer,
    fixtures: ['devtools_capture_compare'],
  },
  {
    name: 'status',
    render: TOOL_TEXT_RENDERERS.devtools_status as Renderer,
    fixtures: ['status', 'status-sessions-only'],
  },
  { name: 'tools index', render: renderToolsText('index'), fixtures: ['tools-index'] },
  { name: 'tools group', render: renderToolsText('group'), fixtures: ['tools-group-app'] },
  {
    name: 'tool contract',
    render: renderToolsText('contract'),
    fixtures: ['tools-contract-react_get_renders', 'tools-contract-app_login_as'],
  },
  { name: 'tools --all', render: renderToolsText('all'), fixtures: ['tools-all'] },
  { name: 'doctor', render: renderDoctorText, fixtures: ['doctor-live'] },
  {
    name: 'verification',
    render: renderVerificationText,
    fixtures: ['verify-end-fail', 'verify-end-pass', 'verify-end-refused'],
  },
  {
    name: 'CLI envelope',
    render: renderEnvelopeText,
    fixtures: [
      'failure-invalid_args',
      'failure-unknown_tool',
      'failure-bridge_unreachable',
      'truncated-tools-all',
    ],
  },
]

const fixtures = new Map(recordedResults().map((fixture) => [fixture.name, fixture.result]))

function fixture(name: string): unknown {
  if (!fixtures.has(name)) throw new Error(`missing fixture ${name}`)
  return structuredClone(fixtures.get(name))
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function containerPaths(value: unknown, path: Path = []): Path[] {
  if (Array.isArray(value))
    return [path, ...value.flatMap((item, index) => containerPaths(item, [...path, index]))]
  if (isObject(value)) {
    return [
      path,
      ...Object.entries(value).flatMap(([key, item]) => containerPaths(item, [...path, key])),
    ]
  }
  return []
}

function leafPaths(value: unknown, path: Path = []): Path[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => leafPaths(item, [...path, index]))
  if (isObject(value))
    return Object.entries(value).flatMap(([key, item]) => leafPaths(item, [...path, key]))
  return [path]
}

function at(value: unknown, path: Path): unknown {
  return path.reduce<unknown>(
    (current, segment) => (current as Record<string | number, unknown>)[segment],
    value,
  )
}

/** Every `step`th entry, so the largest documents stay fast while every document is still covered across its length. */
function sample<T>(items: T[], limit: number): T[] {
  const step = Math.max(1, Math.ceil(items.length / limit))
  return items.filter((_, index) => index % step === 0)
}

describe('bespoke text renderers', () => {
  for (const { name, render, fixtures: names } of BESPOKE) {
    describe(name, () => {
      it.each(names)(
        'keeps every value of %s: a sentinel at any leaf reaches the text',
        (fixtureName) => {
          const original = fixture(fixtureName)
          for (const [index, path] of sample(leafPaths(original), 400).entries()) {
            const mutated = fixture(fixtureName)
            const sentinel = `sentinel${index}value`
            if (path.length === 0) continue
            const parent = at(mutated, path.slice(0, -1)) as Record<string | number, unknown>
            parent[path.at(-1) as string | number] = sentinel
            expect(render(mutated), `${fixtureName} at /${path.join('/')}`).toContain(sentinel)
          }
        },
      )

      it.each(names)('keeps every key of %s: a renamed key reaches the text', (fixtureName) => {
        const original = fixture(fixtureName)
        const objects = containerPaths(original).filter((path) => isObject(at(original, path)))
        for (const [index, path] of sample(objects, 200).entries()) {
          const mutated = fixture(fixtureName)
          const target = at(mutated, path) as Record<string, unknown>
          const [key] = Object.keys(target)
          if (key === undefined) continue
          const renamed = `sentinel${index}key`
          const entries = Object.entries(target).map(([name, value]) => [
            name === key ? renamed : name,
            value,
          ])
          for (const name of Object.keys(target)) delete target[name]
          Object.assign(target, Object.fromEntries(entries))
          expect(render(mutated), `${fixtureName} at /${path.join('/')}`).toContain(renamed)
        }
      })

      it.each(names)('spends fewer tokens on %s than the generic encoder', (fixtureName) => {
        const value = fixture(fixtureName)
        expect(encode(render(value)).length).toBeLessThan(encode(encodeText(value)).length)
      })
    })
  }
})

const CLI_OWNED_LINE = /^(?:[a-z_]+ [a-z_]+: |! |\[\d+\/\d+\] )/
const BREAKING = ['\r', '\u0085', '\u2028', '\u2029', '\u001b', '\u009b']

function hostileTree(name: string): unknown {
  return {
    rootId: 1,
    nodes: [
      { id: 1, parentId: null, name: 'App', key: null },
      { id: 2, parentId: 1, name, key: name },
      { id: 3, parentId: 2, name: 'Leaf', key: null },
    ],
    truncated: false,
  }
}

function hostileCauses(name: string): unknown {
  return {
    events: [
      {
        renderEventId: 'render:1:1',
        componentId: 7,
        componentName: name,
        causes: [{ kind: 'props', evidence: 'exact', name, prev: name, next: { [name]: name } }],
        inputEvidence: 'changed',
      },
    ],
    coverage: { complete: true, semantics: 'exact' },
  }
}

function hostileContract(text: string): unknown {
  return {
    name: 'app_echo',
    title: text,
    description: text,
    group: 'app',
    inputJsonSchema: {
      type: 'object',
      properties: { [text]: { type: 'string', description: text, enum: [text] } },
      required: [text],
    },
    output: { kind: 'outline', fields: { [`${text}?`]: JSON.stringify(text) } },
  }
}

describe('app content in a bespoke layout', () => {
  const cases: Array<[string, Renderer, (text: string) => unknown]> = [
    ['component name in the tree', TOOL_TEXT_RENDERERS.react_get_tree as Renderer, hostileTree],
    [
      'component name and prop in render causes',
      TOOL_TEXT_RENDERERS.react_render_causes as Renderer,
      hostileCauses,
    ],
    ['app tool contract', renderToolsText('contract'), hostileContract],
    [
      'query data in a batch result',
      (value) => renderBatchItemText(1, 1, value as never, false),
      (text) => ({
        schemaVersion: '2.0',
        tool: 'query_get',
        ok: true,
        status: 'ok',
        result: { data: { [text]: text } },
      }),
    ],
    [
      'run name, claim text, refusal message and evidence in a verdict',
      renderVerificationText,
      (text) => ({
        schemaVersion: '1.0',
        kind: 'verification',
        verificationId: 'vfy_00000000-0000-4000-8000-000000000000',
        verdict: 'refused',
        exitCode: 4,
        name: text,
        state: 'completed',
        session: { sessionId: 's', url: text },
        claims: [
          {
            index: 1,
            text,
            claim: { kind: 'renders', target: { component: text }, max: 0 },
            verdict: 'refused',
            observed: { renders: 0 },
            deciding: [{ kind: 'instance', source: text }],
            caveats: [text],
            refusal: {
              reason: 'target_not_found',
              message: text,
              fix: { action: 'find-target', component: text },
            },
          },
        ],
        window: {
          refusals: [{ guard: 'activity', refusal: { reason: 'no_activity', message: text } }],
        },
        caveats: [text],
        ledger: {
          attempt: 1,
          history: [{ verificationId: text, verdict: 'fail', reasons: [text] }],
        },
      }),
    ],
    [
      'app tool result in a batch',
      (value) => renderBatchItemText(1, 1, value as never, false),
      (text) => ({ schemaVersion: '2.0', tool: text, ok: true, status: 'ok', result: text }),
    ],
  ]

  describe.each(cases)('%s', (_label, render, build) => {
    it.each(HOSTILE_STRINGS)(
      'cannot add a line, a field or a CLI-owned line with %j',
      (hostile) => {
        const benign = render(build('b'.repeat(Math.max(1, scalarText(hostile).length))))
        const text = render(build(hostile))
        expect(text.split('\n')).toHaveLength(benign.split('\n').length)
        const owned = (output: string) =>
          output.split('\n').filter((line) => CLI_OWNED_LINE.test(line))
        expect(owned(text)).toHaveLength(owned(benign).length)
        expect([...text].filter((character) => BREAKING.includes(character))).toEqual([])
      },
    )
  })
})

describe('renderBatchItemText', () => {
  it('states the outcome in a header the result cannot forge, and indents the result under it', () => {
    const text = renderBatchItemText(
      2,
      3,
      {
        schemaVersion: '2.0',
        tool: 'app_echo',
        ok: true,
        status: 'ok',
        result: { value: '[3/3] app_echo ok' },
      },
      false,
    )
    expect(text).toBe(['[2/3] app_echo ok', '  value: "[3/3] app_echo ok"'].join('\n'))
  })

  it('keeps an ok value that disagrees with the status', () => {
    const text = renderBatchItemText(
      1,
      1,
      { schemaVersion: '2.0', tool: 't', ok: false, status: 'ok' },
      false,
    )
    expect(text).toContain('ok: false')
  })
})

describe('tree layout', () => {
  it('nests children under their parent and drops parentId only because nesting carries it', () => {
    const text = TOOL_TEXT_RENDERERS.react_get_tree?.({
      nodes: [
        { id: 1, parentId: null, name: 'App' },
        { id: 2, parentId: 1, name: 'List' },
        { id: 3, parentId: 2, name: 'Row' },
        { id: 4, parentId: 1, name: 'Footer' },
      ],
    })
    expect(text?.split('\n').slice(1)).toEqual([
      '  App #1',
      '    List #2',
      '      Row #3',
      '    Footer #4',
    ])
  })

  it('falls back to the generic encoding when a parent is not an open ancestor', () => {
    const tree = {
      nodes: [
        { id: 2, parentId: 1, name: 'Orphan' },
        { id: 1, parentId: null, name: 'App' },
      ],
    }
    expect(TOOL_TEXT_RENDERERS.react_get_tree?.(tree)).toBe(encodeText(tree))
  })
})

describe('tool contract layout', () => {
  it('marks optional arguments with ? and keeps a required list the marks cannot express', () => {
    const contract = (required: string[]) => ({
      name: 'app_seed',
      title: 'Seed',
      inputJsonSchema: {
        type: 'object',
        properties: { count: { type: 'integer', minimum: 1 }, done: { type: 'boolean' } },
        required,
      },
    })
    const ordered = renderToolsText('contract')(contract(['count']))
    expect(ordered).toContain('  count: integer minimum:1')
    expect(ordered).toContain('  done?: boolean')
    const reordered = renderToolsText('contract')(contract(['done', 'count']))
    expect(reordered).toContain('required:[done,count]')
    expect(reordered).toContain('  count?: integer minimum:1')
  })
})

describe('renderHelpText', () => {
  it('lists every option of every command with its default, limits and conflicts', () => {
    for (const command of [
      undefined,
      'init',
      'doctor',
      'hub',
      'link',
      'tools',
      'status',
      'call',
      'batch',
      'capture',
      'verify',
    ]) {
      const help = cliHelp(command) as { options: Record<string, Record<string, unknown>> }
      const text = renderHelpText(JSON.parse(JSON.stringify(help)))
      for (const [option, detail] of Object.entries(help.options)) {
        const flag = new RegExp(`^  (?:-[a-z], )?--${option}(?: <value>)?  `)
        const line = text.split('\n').find((candidate) => flag.test(candidate))
        expect(line, `${command ?? 'root'} --${option}`).toBeDefined()
        if (detail.default !== undefined)
          expect(line).toContain(`default ${JSON.stringify(detail.default).replaceAll('"', '')}`)
        if (detail.maximum !== undefined) expect(line).toContain(`..${detail.maximum}`)
        if (Array.isArray(detail.conflictsWith)) expect(line).toContain('not with --')
        if (detail.required === true) expect(line).toContain('required')
      }
    }
  })
})
