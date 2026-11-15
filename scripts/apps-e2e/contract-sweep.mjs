import { CheckFailure, check, isCliFailure } from './harness.mjs'

const HUB_READ_ONLY_TOOLS = new Set([
  'devtools_status',
  'devtools_wait',
  'devtools_capture_list',
  'devtools_capture_read',
  'react_quiesce',
])
const SWEEP_MAX_BYTES = '5000000'
const UNDERSPECIFIED_REASONS = new Set(['invalid_args', 'tool_error'])
const FIRST = [
  'query_list',
  'timeline_start',
  'query_list_mutations',
  'devtools_capture_list',
  'plugin_list',
]
const LAST = ['timeline_stop']

function isReadOnly(contract) {
  return contract.annotations?.readOnlyHint === true || HUB_READ_ONLY_TOOLS.has(contract.name)
}

function splitTopLevel(type) {
  const parts = []
  let depth = 0
  let quoted = false
  let current = ''
  for (let index = 0; index < type.length; index++) {
    const char = type[index]
    if (char === '"') quoted = !quoted
    if (!quoted && (char === '<' || char === '(')) depth++
    if (!quoted && (char === '>' || char === ')')) depth--
    if (!quoted && depth === 0 && type.startsWith(' | ', index)) {
      parts.push(current)
      current = ''
      index += 2
      continue
    }
    current += char
  }
  parts.push(current)
  return parts.map((part) => part.trim())
}

function matchesOutlineType(value, type) {
  return splitTopLevel(type).some((part) => {
    if (part === 'any' || part === 'unknown') return true
    if (part === 'string') return typeof value === 'string'
    if (part === 'number') return typeof value === 'number' && Number.isFinite(value)
    if (part === 'integer') return Number.isInteger(value)
    if (part === 'boolean') return typeof value === 'boolean'
    if (part === 'null') return value === null
    if (part === 'object' || part.startsWith('record<')) {
      return value !== null && typeof value === 'object' && !Array.isArray(value)
    }
    if (part.startsWith('array<') || part === 'array') return Array.isArray(value)
    if (part.startsWith('"')) return value === JSON.parse(part)
    if (part === 'true' || part === 'false') return value === (part === 'true')
    if (/^-?\d+(\.\d+)?$/.test(part)) return value === Number(part)
    return true
  })
}

/** Checks a result against the tool's advertised one-level output outline; a missing required field or a wrong top-level type is contract drift. */
export function outlineViolations(result, output) {
  if (output?.kind !== 'outline' || !output.fields) return []
  const violations = []
  for (const [rawName, type] of Object.entries(output.fields)) {
    const optional = rawName.endsWith('?')
    const name = optional ? rawName.slice(0, -1) : rawName
    if (!(name in result)) {
      if (!optional) violations.push(`missing required field ${name} (${type})`)
      continue
    }
    if (!matchesOutlineType(result[name], type)) {
      violations.push(`${name} is ${JSON.stringify(result[name])?.slice(0, 80)}, not ${type}`)
    }
  }
  return violations
}

function validateContract(name, contract) {
  const problems = []
  if (contract?.name !== name) problems.push(`name is ${JSON.stringify(contract?.name)}`)
  if (typeof contract?.description !== 'string' || contract.description.trim() === '') {
    problems.push('description is empty')
  }
  const schema = contract?.inputJsonSchema
  if (schema?.type !== 'object') problems.push('inputJsonSchema.type is not "object"')
  const properties = schema?.properties ?? {}
  if (typeof properties !== 'object' || Array.isArray(properties)) {
    problems.push('inputJsonSchema.properties is not an object')
  }
  for (const key of schema?.required ?? []) {
    if (!(key in properties)) problems.push(`required key ${key} is not a property`)
  }
  for (const [key, property] of Object.entries(properties)) {
    if (!('default' in property)) continue
    const value = property.default
    if (property.enum && !property.enum.includes(value)) {
      problems.push(`${key} default ${JSON.stringify(value)} is outside its enum`)
    }
    if (typeof value === 'number') {
      if (property.minimum !== undefined && value < property.minimum) {
        problems.push(`${key} default ${value} is below minimum ${property.minimum}`)
      }
      if (property.maximum !== undefined && value > property.maximum) {
        problems.push(`${key} default ${value} is above maximum ${property.maximum}`)
      }
    }
  }
  const annotations = contract?.annotations
  if (annotations !== undefined) {
    if (annotations === null || typeof annotations !== 'object') problems.push('annotations')
    else if (annotations.readOnlyHint === true && annotations.destructiveHint === true) {
      problems.push('annotations claim both readOnlyHint and destructiveHint')
    }
  }
  if (contract?.output !== undefined && contract.output.kind !== 'outline') {
    problems.push(`output.kind is ${JSON.stringify(contract.output.kind)}`)
  }
  return problems
}

function schemaExamples(schema) {
  return Array.isArray(schema?.examples)
    ? schema.examples.filter((example) => example && typeof example === 'object')
    : []
}

async function resolveArgs(contract, resolvers) {
  const schema = contract.inputJsonSchema
  const args = {}
  const unresolved = []
  for (const key of schema.required ?? []) {
    const resolver = resolvers[`${contract.name}.${key}`] ?? resolvers[key]
    const value = typeof resolver === 'function' ? await resolver() : resolver
    if (value !== undefined) {
      args[key] = value
      continue
    }
    const example = schemaExamples(schema).find((candidate) => key in candidate)
    if (example) args[key] = example[key]
    else unresolved.push(key)
  }
  return { args, unresolved }
}

function sweepOrder(names) {
  const rank = (name) => {
    if (FIRST.includes(name)) return FIRST.indexOf(name) - FIRST.length
    if (LAST.includes(name)) return 1 + LAST.indexOf(name)
    return 0
  }
  return [...names].sort((left, right) => rank(left) - rank(right))
}

function isExplainedUnavailability(failure) {
  const reason = failure.details?.availability?.reason
  return failure.reason === 'tool_unavailable' && typeof reason === 'string' && reason.length > 0
}

async function callVariant(ctx, contract, args) {
  const result = await ctx.cli.run([
    'call',
    contract.name,
    JSON.stringify(args),
    '--max-bytes',
    SWEEP_MAX_BYTES,
  ])
  if (result.code === 0) return { ok: true, result: result.json, ms: result.durationMs }
  return {
    ok: false,
    typed: isCliFailure(result.json),
    failure: result.json,
    ms: result.durationMs,
  }
}

async function optionalFallbacks(contract, args, resolvers) {
  const fallbacks = []
  for (const key of Object.keys(contract.inputJsonSchema.properties ?? {})) {
    if (key in args) continue
    const resolver = resolvers[`${contract.name}.${key}`] ?? resolvers[key]
    const value = typeof resolver === 'function' ? await resolver() : resolver
    if (value !== undefined) fallbacks.push({ ...args, [key]: value })
  }
  return fallbacks
}

/** Schema examples are shape templates: an identifier in one names no live object, so each key the app can resolve takes its live value. An example whose tool-scoped identifier has no live object right now cannot be called and yields undefined. */
async function withLiveIdentifiers(contract, example, resolvers, ownResult) {
  const live = { ...example }
  for (const key of Object.keys(example)) {
    const scoped = resolvers[`${contract.name}.${key}`]
    const resolver = scoped ?? resolvers[key]
    const value = typeof resolver === 'function' ? await resolver(ownResult) : resolver
    if (value !== undefined) live[key] = value
    else if (scoped !== undefined) return undefined
  }
  return live
}

/** Calls one read-only tool with its required arguments and every schema example; a rejected bare call is retried with resolvable optional inputs and reported as an under-specified schema. */
async function sweepTool(ctx, contract, resolvers) {
  const name = contract.name
  const failures = []
  const outcomes = []
  let produced
  const { args, unresolved } = await resolveArgs(contract, resolvers)
  if (unresolved.length > 0) {
    const failure = await ctx.cli.failure(name, args)
    const named = JSON.stringify(failure.details ?? {})
    if (!(failure.reason === 'invalid_args' && unresolved.every((key) => named.includes(key)))) {
      failures.push({ tool: name, kind: 'unexplained-required', args, failure })
    }
    outcomes.push({ tool: name, outcome: `invalid_args(${unresolved.join(',')})` })
    return { failures, outcomes }
  }
  const pending = [
    () => args,
    ...schemaExamples(contract.inputJsonSchema).map(
      (example) => () => withLiveIdentifiers(contract, example, resolvers, produced),
    ),
  ]
  const attemptedVariants = new Set()
  for (const nextVariant of pending) {
    const variant = await nextVariant()
    if (variant === undefined) {
      outcomes.push({ tool: name, outcome: 'no-live-input' })
      continue
    }
    const signature = JSON.stringify(variant)
    if (attemptedVariants.has(signature)) continue
    attemptedVariants.add(signature)
    let attempt = await callVariant(ctx, contract, variant)
    const rejectedBare =
      !attempt.ok &&
      attempt.typed &&
      variant === args &&
      (contract.inputJsonSchema.required ?? []).length === 0 &&
      UNDERSPECIFIED_REASONS.has(attempt.failure.reason)
    if (rejectedBare) {
      ctx.attempted(name)
      failures.push({
        tool: name,
        kind: 'underspecified-input',
        args: variant,
        failure: attempt.failure,
      })
      const fallbacks = await optionalFallbacks(contract, args, resolvers)
      if (fallbacks.length === 0) {
        outcomes.push({ tool: name, outcome: 'no-live-input', ms: attempt.ms })
        continue
      }
      for (const fallback of fallbacks) {
        const retried = await callVariant(ctx, contract, fallback)
        if (!retried.ok) continue
        attempt = retried
        break
      }
    }
    outcomes.push({
      tool: name,
      outcome: attempt.ok ? 'ok' : attempt.failure?.reason,
      ms: attempt.ms,
    })
    if (attempt.ok) {
      const violations = outlineViolations(attempt.result, contract.output)
      if (violations.length > 0) failures.push({ tool: name, kind: 'outline-drift', violations })
      produced ??= attempt.result
      ctx.called.add(name)
      ctx.attempted(name)
      continue
    }
    if (!attempt.typed) {
      failures.push({
        tool: name,
        kind: 'untyped-failure',
        args: variant,
        failure: attempt.failure,
      })
      continue
    }
    if (isExplainedUnavailability(attempt.failure)) continue
    failures.push({ tool: name, kind: 'failed', args: variant, failure: attempt.failure })
  }
  return { failures, outcomes, result: produced }
}

function summarizeFailure({ tool, kind, args, failure, violations, problems }) {
  const detail = failure
    ? `${failure.reason}: ${JSON.stringify(failure.details ?? failure.message).slice(0, 300)}`
    : JSON.stringify(violations ?? problems ?? '')
  return `- ${tool} ${args ? JSON.stringify(args) : ''} ${kind}: ${detail}`
}

/** Fetches every advertised contract, then calls each read-only tool with schema defaults and its examples; returns the catalog for later coverage accounting. */
export async function contractSweep(ctx) {
  const { cli, log } = ctx
  const index = await cli.run(['tools'])
  check(index.code === 0, 'tools index failed', index.json)
  const groups = index.json.groups
  check(Array.isArray(groups) && groups.length > 0, 'tools index has no groups', index.json)
  const names = groups.flatMap((group) => group.tools)
  check(new Set(names).size === names.length, 'tools index lists a tool twice', names)
  check(index.json.total === names.length, 'tools index total disagrees with its groups', {
    total: index.json.total,
    listed: names.length,
  })

  const contracts = new Map()
  const failures = []
  for (const name of names) {
    const detail = await cli.run(['tools', name])
    if (detail.code !== 0) {
      failures.push({ tool: name, kind: 'contract-unreadable', failure: detail.json })
      continue
    }
    const problems = validateContract(name, detail.json)
    if (problems.length > 0) failures.push({ tool: name, kind: 'malformed-contract', problems })
    contracts.set(name, detail.json)
  }

  const produced = {}
  const resolvers = ctx.resolvers(produced)
  const outcomes = []
  for (const name of sweepOrder(contracts.keys())) {
    const contract = contracts.get(name)
    if (!isReadOnly(contract) || contract.available === false) continue
    const result = await sweepTool(ctx, contract, resolvers)
    failures.push(...result.failures)
    outcomes.push(...result.outcomes)
    if (result.result) produced[name] = result.result
  }
  const slowest = outcomes
    .filter((outcome) => outcome.ms !== undefined)
    .sort((left, right) => right.ms - left.ms)
    .slice(0, 3)
    .map((outcome) => `${outcome.tool} ${outcome.ms}ms`)
  log(
    `  contract sweep: ${contracts.size} contracts, ${outcomes.length} read-only calls (slowest: ${slowest.join(', ')})`,
  )
  const unclaimed = ctx.claimSweepFailures(failures)
  if (unclaimed.length > 0) {
    throw new CheckFailure(
      `${unclaimed.length} contract sweep failure(s)`,
      unclaimed.map(summarizeFailure).join('\n'),
    )
  }
  return contracts
}
