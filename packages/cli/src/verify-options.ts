import type { Command, OptionDetail } from './cli-help'
import { EXIT_CODES } from './exit-codes'

export const VERIFY_OPTIONS = {
  name: { type: 'string' },
  claim: { type: 'string', multiple: true },
  claims: { type: 'string' },
  budget: { type: 'string' },
  'quiet-ms': { type: 'string' },
  'timeout-ms': { type: 'string' },
  'tail-ms': { type: 'string' },
  domains: { type: 'string' },
  'max-duration': { type: 'string' },
  'allow-overrides': { type: 'boolean' },
} as const

export const VERIFY_OPTION_DETAILS: Record<keyof typeof VERIFY_OPTIONS, OptionDetail> = {
  name: {
    description: 'verify begin: label for the run, 1–80 characters; not part of its rerun history',
  },
  claim: {
    description:
      'verify begin: one claim in the verify DSL, repeatable up to 20 (10 distinct targets): render <Name>[@file][[key=k]] max|min <N> [counting updates] [allow-remount]; render <Name> only <cause>[,<cause>]; effect <Name>[#index] max <N> | settles; boundaries clean | clean-at-end; suspense <Name> hidden max <N>. verify show: the claim number whose evidence to print',
    conflictsWith: ['claims'],
  },
  claims: {
    description:
      'verify begin: path to a JSON document {name?, claims, budget?, settle?, tailMs?}, or - for stdin; the schema is devtools_verify_begin in tools',
    conflictsWith: ['claim'],
  },
  budget: {
    description:
      'verify begin: render analysis budget as one JSON object, such as {"fiberLimit":1200}; a budget_exhausted refusal prints the one to use',
  },
  'quiet-ms': {
    description: 'verify begin: how long every settle domain must stay quiet before the freeze',
    default: 500,
    minimum: 100,
    maximum: 5000,
  },
  'timeout-ms': {
    description:
      'verify begin: how long verify end waits for the app to settle; unrelated to the call timeout --timeout',
    default: 10000,
    minimum: 500,
    maximum: 60000,
  },
  'tail-ms': {
    description:
      'verify begin: how long to keep recording after the app settles; default quiet-ms (at least 500), and for effect settles claims the larger of twice quiet-ms and 2000',
    minimum: 0,
    maximum: 30000,
  },
  domains: {
    description:
      'verify begin: comma-separated settle domains, from react, query, router and network; default every domain the app advertises, and react is required',
  },
  'max-duration': {
    description:
      'verify begin: milliseconds before the hub expires an unfinished window and releases its lock',
    default: 300000,
    minimum: 10000,
    maximum: 1800000,
  },
  'allow-overrides': {
    description:
      'verify begin: allow overrides and simulated Query state in the window; the verdict then says they were active',
    default: false,
  },
}

export const VERIFY_COMMAND: Command = {
  description:
    'Declare claims, drive the UI, then get a pass, fail, refused or inconclusive verdict',
  arguments: [
    {
      name: 'action',
      required: true,
      description:
        'begin starts a locked window; end settles, freezes and decides; show reads a stored verdict; abort releases the window',
      enum: ['begin', 'end', 'show', 'abort'],
    },
    {
      name: 'id',
      required: false,
      description: 'The verification ID begin printed; required for end, show and abort',
    },
  ],
  options: [
    'url',
    'connect-timeout',
    'session',
    'verbose',
    'wait',
    'timeout',
    'name',
    'claim',
    'claims',
    'budget',
    'quiet-ms',
    'timeout-ms',
    'tail-ms',
    'domains',
    'max-duration',
    'allow-overrides',
    'section',
  ],
  optionDetails: {
    section: {
      description:
        'verify show: guards, or raw:<tool> for a retained tool result such as raw:react_get_renders',
      conflictsWith: ['claim'],
    },
  },
  exits: {
    [EXIT_CODES.success]: 'pass, or begin and abort succeeded',
    [EXIT_CODES.failure]: 'fail: the evidence proves a claim false',
    [EXIT_CODES.usage]: 'invalid claim, option or ID',
    [EXIT_CODES['needs-human']]: 'the hub refused the connection',
    [EXIT_CODES.refused]: 'refused: the evidence is not good enough; each refusal names a fix',
    [EXIT_CODES.inconclusive]: 'inconclusive: complete evidence that does not decide the claim',
    [EXIT_CODES.unreachable]: 'no hub or app answered',
    [EXIT_CODES.timeout]: 'the call timed out; verify end <id> again returns the stored verdict',
    [EXIT_CODES.interrupted]: 'interrupted by SIGINT',
  },
  examples: [
    [
      'verify',
      'begin',
      '--session',
      'my-agent',
      '--name',
      'type cert in filter',
      '--claim',
      'render StatusBadge max 0',
      '--claim',
      'render SearchScreen min 1',
      '--claim',
      'boundaries clean',
    ],
    ['verify', 'end', '<id>', '--session', 'my-agent'],
    ['verify', 'show', '<id>', '--claim', '1', '--session', 'my-agent'],
    ['verify', 'abort', '<id>', '--session', 'my-agent'],
  ],
  notes: [
    'Claims are fixed at begin. Drive the UI with your own driver between begin and end; Genie does not drive it and does not check what the user sees.',
    'end settles every settle domain with recording on, records the tail, freezes, and decides. A failure decides the run, then a refusal, then an inconclusive. Upper-bound claims pass only on exact evidence.',
    'While a window records, react_clear_renders, react_profile_start, react_profile_stop, devtools_interaction_begin and the override tools are refused on that document; abort releases it, and the hub expires it after --max-duration.',
    'Add a positive control such as render <Name> min 1 on a component the interaction must change, so an interaction that never reached the app fails instead of refusing.',
  ],
}
