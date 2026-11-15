import type { Command, OptionDetail } from './cli-help'
import type { FailureReason } from './failure'
import { DEFAULT_ERROR_CODES } from './failure-format'
import { genieCommand } from './package-manager'

export const FEEDBACK_REPOSITORY = 'Genie-sa/genie-react'
export const FEEDBACK_LABEL = 'agent-feedback'
export const FEEDBACK_KINDS = ['bug', 'friction', 'idea', 'docs'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const FEEDBACK_REASONS = Object.keys(DEFAULT_ERROR_CODES) as FailureReason[]

/** Prefixes of the tools Genie itself ships; `app_*` and other names belong to the user's app and never leave the machine. */
export const GENIE_TOOL_FAMILIES = [
  'browser',
  'devtools',
  'mutation',
  'navigate',
  'navigation',
  'plugin',
  'query',
  'react',
  'router',
  'stylex',
  'timeline',
] as const

const GENIE_TOOL_NAME = new RegExp(`^(?:${GENIE_TOOL_FAMILIES.join('|')})_[a-z0-9_]{1,64}$`)

export const MESSAGE_LIMIT = 6_000
export const TITLE_LIMIT = 120

export const isFeedbackKind = (value: string): value is FeedbackKind =>
  (FEEDBACK_KINDS as readonly string[]).includes(value)
export const isFeedbackReason = (value: string): value is FailureReason =>
  (FEEDBACK_REASONS as readonly string[]).includes(value)
export const isGenieToolName = (value: string): boolean => GENIE_TOOL_NAME.test(value)

export const FEEDBACK_HINT =
  'If it repeats while setup checks pass, it may be a Genie bug: pipe a description into feedback to preview a report for the maintainers; nothing is sent without --submit.'

/** A preview command for a likely Genie bug; only enum-checked values reach its argv, so the caller pipes the description in. */
export function feedbackSuggestion(
  reason: FailureReason,
  tool?: string,
): { command: string; argv: string[] } {
  return genieCommand([
    'feedback',
    '--kind',
    'bug',
    '--reason',
    reason,
    ...(tool !== undefined && isGenieToolName(tool) ? ['--tool', tool] : []),
    '--message',
    '-',
  ])
}

export const FEEDBACK_OPTIONS = {
  message: { type: 'string' },
  title: { type: 'string' },
  kind: { type: 'string' },
  reason: { type: 'string' },
  tool: { type: 'string' },
  submit: { type: 'boolean' },
  draft: { type: 'string' },
  'allow-duplicate': { type: 'boolean' },
} as const

export const FEEDBACK_OPTION_DETAILS: Record<keyof typeof FEEDBACK_OPTIONS, OptionDetail> = {
  message: {
    description: `What happened, what you expected, and how to reproduce it; - reads it from stdin. Paths, URL queries, emails and secret-like values are redacted; cut at ${MESSAGE_LIMIT} characters`,
    conflictsWith: ['draft'],
  },
  title: {
    description: `Issue title; defaults to the first line of the message. Redacted like the message; cut at ${TITLE_LIMIT} characters`,
    conflictsWith: ['draft'],
  },
  kind: {
    description: 'Report kind',
    enum: FEEDBACK_KINDS,
    default: 'bug',
    conflictsWith: ['draft'],
  },
  reason: {
    description: 'reason of the Genie failure being reported, so reports group together',
    enum: FEEDBACK_REASONS,
    conflictsWith: ['draft'],
  },
  tool: {
    description: `Built-in Genie tool involved (${GENIE_TOOL_FAMILIES.map((family) => `${family}_*`).join(', ')}); app_* names are refused so app details stay private`,
    conflictsWith: ['draft'],
  },
  submit: {
    description:
      'File a public GitHub issue from the signed-in gh account; without it nothing is sent',
    default: false,
  },
  draft: {
    description: 'With --submit, file the report a previous preview saved under this ID, unchanged',
  },
  'allow-duplicate': {
    description: 'With --submit, file even when an open issue has the same failure signature',
    default: false,
  },
}

export const FEEDBACK_COMMAND: Command = {
  description: 'Preview, then optionally file, a bug, friction or idea report for the maintainers',
  arguments: [],
  options: ['message', 'title', 'kind', 'reason', 'tool', 'submit', 'draft', 'allow-duplicate'],
  examples: [
    ['feedback', '--kind', 'friction', '--message', '<what happened>'],
    ['feedback', '--reason', 'operational_failure', '--tool', 'react_get_tree', '--message', '-'],
    ['feedback', '--submit', '--draft', '<draft id>'],
  ],
  notes: [
    `Without --submit nothing leaves the machine: the result shows the exact issue title, body and destination, saves it as a draft, and next submits that draft unchanged. Show it to the user and submit only after they agree: the issue is public on ${FEEDBACK_REPOSITORY} and posted from the GitHub account gh is signed in to.`,
    'The report holds only the message, the title, and these diagnostics: CLI and genie-react versions, Node version, OS and architecture, package manager, detected framework and React version. No source, file contents, environment variables, tool results or app data.',
    `--submit uses the GitHub CLI (gh) and requests the ${FEEDBACK_LABEL} label, filing without it when it cannot be applied. With --reason it first looks for an open issue with the same failure signature and returns that instead. When gh is missing, signed out, offline or rate limited, the result has a saved report file and a prefilled new-issue link for a person to open.`,
    '--message - reads the text from piped stdin and fails when stdin is a terminal.',
  ],
}
