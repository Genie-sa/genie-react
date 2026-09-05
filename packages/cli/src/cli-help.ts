import { CAPTURE_DOMAINS } from 'genie-react/protocol'
import { DEFAULT_MAX_BYTES } from './cli-output'

export const CLI_OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
  'dry-run': { type: 'boolean' },
  live: { type: 'boolean' },
  yes: { type: 'boolean', short: 'y' },
  url: { type: 'string' },
  'connect-timeout': { type: 'string' },
  wait: { type: 'string' },
  session: { type: 'string' },
  json: { type: 'boolean' },
  ndjson: { type: 'boolean' },
  'sessions-only': { type: 'boolean' },
  all: { type: 'boolean' },
  port: { type: 'string' },
  timeout: { type: 'string' },
  fields: { type: 'string' },
  select: { type: 'string' },
  'max-bytes': { type: 'string' },
  'fail-on-result-error': { type: 'boolean' },
  marker: { type: 'string' },
  output: { type: 'string' },
  section: { type: 'string' },
  force: { type: 'boolean' },
  verbose: { type: 'boolean' },
} as const

type OptionName = keyof typeof CLI_OPTIONS
interface OptionDetail {
  description: string
  default?: string | number | boolean
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  enum?: readonly string[]
  conflictsWith?: OptionName[]
}
const OPTION_DETAILS: Record<OptionName, OptionDetail> = {
  help: { description: 'Describe commands, arguments, options and output as JSON' },
  version: { description: 'Return the CLI package version as JSON' },
  json: {
    description: 'Compatibility alias for JSON; batch collects results into one JSON array',
    conflictsWith: ['ndjson'],
  },
  ndjson: { description: 'Emit one batch result per JSON line', conflictsWith: ['json'] },
  'dry-run': { description: 'Report planned init changes without writing files', default: false },
  yes: { description: 'Accept safe init defaults', default: false },
  live: {
    description: 'Probe hub HTTP, client bundle, sessions and source-map health',
    default: false,
  },
  url: {
    description: 'Override the bridge WebSocket URL; otherwise use GENIE_BRIDGE_URL or discovery',
  },
  session: {
    description: 'Target a physical ID, logical ID or unique name; overrides GENIE_SESSION',
  },
  port: {
    description: 'Listen on this strict hub port; an omitted port can walk upward when busy',
    default: 4390,
    minimum: 1,
    maximum: 65535,
  },
  'connect-timeout': {
    description: 'Bound bridge connection startup in milliseconds',
    default: 8000,
    minimum: 100,
    maximum: 120000,
  },
  wait: {
    description: 'Wait for a ready app in milliseconds',
    default: 15000,
    minimum: 1,
    maximum: 120000,
  },
  timeout: {
    description: 'Set a positive call timeout in milliseconds; bridge clamps it to 1000–120000',
    exclusiveMinimum: 0,
  },
  fields: {
    description:
      'Select comma-separated record keys as JSONL; unknown fields fail; empty collections emit no rows',
    conflictsWith: ['select'],
  },
  select: {
    description:
      'Select an RFC 6901 JSON Pointer or dotted path with wildcards; returns a selection envelope',
    conflictsWith: ['fields'],
  },
  'max-bytes': {
    description:
      'Bound stdout bytes including newlines; oversized results return a truncation envelope',
    default: DEFAULT_MAX_BYTES,
    minimum: 512,
    maximum: 50000000,
  },
  'fail-on-result-error': {
    description: 'Exit 1 when a wait or quiesce result reports ok:false',
    default: false,
  },
  marker: {
    description: 'Echo a correlation marker in status; 1–80 characters without control characters',
  },
  'sessions-only': {
    description: 'Omit app, domain and tool metadata from status',
    default: false,
  },
  all: { description: 'Return every tool contract', default: false },
  output: { description: 'Write the checksummed capture artifact to this path' },
  section: { description: 'Export comma-separated capture domains', enum: CAPTURE_DOMAINS },
  force: { description: 'Replace an existing capture export file', default: false },
  verbose: {
    description: 'Emit bootstrap and connection diagnostics as JSONL on stderr',
    default: false,
  },
}
interface Argument {
  name: string
  required: boolean
  description: string
  enum?: string[]
}
interface Command {
  description: string
  arguments: Argument[]
  options: OptionName[]
  requiredOptions?: OptionName[]
  examples: string[][]
  notes?: string[]
}
const CONNECTION: OptionName[] = ['url', 'connect-timeout', 'session', 'verbose']
const SELECTION: OptionName[] = ['select']
export const COMMANDS: Record<string, Command> = {
  init: {
    description: 'Wire Genie into a Vite, Next.js or other React app',
    arguments: [],
    options: ['dry-run', 'yes'],
    examples: [['init', '--dry-run']],
    notes: [
      'Returns planned, applied, already-present and manual artifact outcomes without source contents. No interactive prompts.',
    ],
  },
  doctor: {
    description: 'Check local setup and optionally the running stack',
    arguments: [],
    options: ['live', ...SELECTION],
    examples: [['doctor'], ['doctor', '--live']],
  },
  hub: {
    description: 'Run the standalone hub until SIGINT or SIGTERM',
    arguments: [],
    options: ['port'],
    examples: [['hub']],
    notes: [
      'Emits ready, reused or stopped lifecycle records as JSONL. Reusing an existing hub exits without taking ownership.',
    ],
  },
  link: {
    description: 'Symlink Genie packages from a local checkout',
    arguments: [
      {
        name: 'path',
        required: false,
        description: 'Genie checkout; defaults to the checkout containing this CLI',
      },
    ],
    options: [],
    examples: [['link', '<path>']],
  },
  tools: {
    description: 'Discover tool groups, a group catalog or one complete tool schema',
    arguments: [
      {
        name: 'selector',
        required: false,
        description: 'Exact tool name or group family; omission returns a group index',
      },
    ],
    options: [...CONNECTION, ...SELECTION, 'wait', 'all'],
    examples: [['tools'], ['tools', 'react.render'], ['tools', 'react_get_renders']],
    notes: ['Exact tools expose input and output schemas. --all returns every contract.'],
  },
  status: {
    description: 'Inspect bridge readiness and resolve connected app sessions',
    arguments: [],
    options: [...CONNECTION, ...SELECTION, 'sessions-only', 'marker'],
    examples: [['status', '--sessions-only']],
  },
  call: {
    description: 'Invoke one tool using its live input schema',
    arguments: [
      { name: 'tool', required: true, description: 'Tool name from tools' },
      { name: 'args', required: false, description: 'One JSON object string; defaults to {}' },
    ],
    options: [...CONNECTION, ...SELECTION, 'wait', 'timeout', 'fields', 'fail-on-result-error'],
    examples: [['call', 'react_get_renders', '{"sort":"selfTime"}']],
    notes: [
      'Returns the tool result without a new envelope. --fields returns JSONL; --select returns a selection envelope. Input is read from argv, not stdin.',
    ],
  },
  batch: {
    description: 'Invoke tools sequentially over one connection, continuing after item failures',
    arguments: [
      {
        name: 'calls',
        required: false,
        description: 'JSON array of {tool,args?}; omission reads the array from stdin',
      },
    ],
    options: [...CONNECTION, ...SELECTION, 'wait', 'timeout', 'ndjson'],
    examples: [['batch', '[{"tool":"react_get_renders"}]']],
    notes: [
      'Default and --ndjson emit JSONL. --json emits one array. Item keys other than tool and args are rejected. Exit 0 requires every call to succeed. --max-bytes bounds the whole batch.',
    ],
  },
  capture: {
    description: 'Export a retained capture with verified SHA-256 integrity',
    arguments: [
      { name: 'action', required: true, description: 'Capture operation', enum: ['export'] },
      { name: 'id', required: true, description: 'Retained capture ID' },
    ],
    options: [...CONNECTION, ...SELECTION, 'output', 'section', 'force'],
    requiredOptions: ['output'],
    examples: [['capture', 'export', '<id>', '--output', '<path>']],
    notes: [
      '--output is required. Existing files are refused unless --force. The artifact is verified and written atomically; stdout contains its receipt.',
    ],
  },
}
const GLOBAL_OPTIONS: OptionName[] = ['help', 'version', 'json', 'max-bytes']
export const COMMAND_OPTIONS: Record<string, ReadonlySet<string>> = Object.fromEntries(
  Object.entries(COMMANDS).map(([name, command]) => [
    name,
    new Set([...GLOBAL_OPTIONS, ...command.options]),
  ]),
)
export const POSITIONAL_LIMITS: Record<string, number> = Object.fromEntries(
  Object.entries(COMMANDS).map(([name, command]) => [name, command.arguments.length + 1]),
)

export function cliHelp(name?: string): unknown {
  const command = name === undefined ? undefined : COMMANDS[name]
  const optionNames = command ? [...GLOBAL_OPTIONS, ...command.options] : GLOBAL_OPTIONS
  return {
    schemaVersion: '1.0',
    status: 'ok',
    command: name ?? 'genie-react',
    description: command?.description ?? 'Live React and TanStack DevTools for coding agents',
    ...(command
      ? { arguments: command.arguments, notes: command.notes ?? [] }
      : {
          commands: Object.entries(COMMANDS).map(([name, value]) => ({
            name,
            description: value.description,
            help: ['genie-react', name, '--help'],
          })),
          environment: {
            GENIE_BRIDGE_URL: 'Bridge URL override',
            GENIE_SESSION: 'Default app session target',
          },
        }),
    options: Object.fromEntries(
      [...new Set(optionNames)].map((option) => [
        option,
        {
          ...CLI_OPTIONS[option],
          ...OPTION_DETAILS[option],
          ...(option === 'wait' && name === 'tools' ? { default: 12000 } : {}),
          required: command?.requiredOptions?.includes(option) ?? false,
        },
      ]),
    ),
    output: {
      default: name === 'batch' || name === 'hub' ? 'jsonl' : 'json',
      diagnostics: 'jsonl on stderr',
      defaultMaxBytes: DEFAULT_MAX_BYTES,
      limitScope:
        name === 'hub' || name === 'batch' ? 'per JSONL record by default' : 'whole result',
      ...(name === 'batch'
        ? { explicitMaxBytes: 'whole batch; buffers results before emission' }
        : {}),
      exits: { '0': 'success', '1': 'failure' },
      ...(name === 'call' ? { fields: 'jsonl; zero bytes for an empty collection' } : {}),
      ...(name === 'batch'
        ? { json: 'one JSON array', ndjson: 'one JSON object per result line' }
        : {}),
    },
    examples: (
      command?.examples ?? [['tools'], ['status'], ['call', 'react_get_renders', '{}']]
    ).map((argv) => ({ argv: ['genie-react', ...argv] })),
  }
}
