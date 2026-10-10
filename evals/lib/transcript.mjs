import { basename, programWords, splitShellCommands, unwrapShellInvocation } from './shell.mjs'

/**
 * @typedef {{ input: number, output: number, cacheRead: number, cacheCreation: number, total: number }} TokenUsage
 * @typedef {{ command: string, output: string, isError: boolean, denied: boolean }} ShellCommand
 * @typedef {{
 *   agent: 'claude' | 'codex',
 *   model: string | null,
 *   commands: ShellCommand[],
 *   toolUses: Record<string, number>,
 *   finalText: string,
 *   usage: TokenUsage,
 *   costUsd: number | null,
 *   turns: number | null,
 *   permissionDenials: string[],
 *   failure: string | null,
 *   skills: string[] | null,
 * }} Transcript
 * @typedef {{ subcommand: string | null, tool: string | null }} GenieInvocation
 * @typedef {{
 *   genieCalls: number,
 *   genieInvocations: GenieInvocation[],
 *   browserCalls: number,
 *   browserSubcommands: Record<string, number>,
 *   otherCommands: number,
 *   failedCommands: number,
 *   deniedCommands: number,
 *   genieEvidenceCommands: number,
 *   genieErrorReasons: Record<string, number>,
 * }} CommandMetrics
 */

/** @returns {TokenUsage} */
function emptyUsage() {
  return { input: 0, output: 0, cacheRead: 0, cacheCreation: 0, total: 0 }
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, any>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * @param {string} text
 * @returns {Record<string, any>[]}
 */
export function parseJsonLines(text) {
  /** @type {Record<string, any>[]} */
  const events = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('{')) continue
    try {
      const event = JSON.parse(trimmed)
      if (isRecord(event)) events.push(event)
    } catch {}
  }
  return events
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function count(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * @param {unknown} content
 * @returns {string}
 */
function toolResultText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
    .join('\n')
}

/**
 * Normalises `claude -p --output-format stream-json --verbose` events.
 * @param {Record<string, any>[]} events
 * @returns {Transcript}
 */
export function parseClaudeEvents(events) {
  /** @type {Map<string, ShellCommand>} */
  const commandsById = new Map()
  /** @type {ShellCommand[]} */
  const commands = []
  /** @type {Record<string, number>} */
  const toolUses = {}
  /** @type {Map<string, TokenUsage>} */
  const usageByMessage = new Map()
  let lastAssistantText = ''
  /** @type {Transcript} */
  const transcript = {
    agent: 'claude',
    model: null,
    commands,
    toolUses,
    finalText: '',
    usage: emptyUsage(),
    costUsd: null,
    turns: null,
    permissionDenials: [],
    failure: null,
    skills: null,
  }

  for (const event of events) {
    if (event.type === 'system' && event.subtype === 'init') {
      transcript.model = typeof event.model === 'string' ? event.model : null
      transcript.skills = Array.isArray(event.skills) ? event.skills.map(String) : null
    }
    if (event.type === 'assistant' && isRecord(event.message)) {
      if (event.parent_tool_use_id) continue
      const { message } = event
      if (typeof message.id === 'string' && isRecord(message.usage)) {
        usageByMessage.set(message.id, usageFromAnthropic(message.usage))
      }
      for (const block of Array.isArray(message.content) ? message.content : []) {
        if (!isRecord(block)) continue
        if (block.type === 'text' && typeof block.text === 'string') lastAssistantText = block.text
        if (block.type !== 'tool_use' || typeof block.name !== 'string') continue
        toolUses[block.name] = (toolUses[block.name] ?? 0) + 1
        if (
          block.name === 'Bash' &&
          isRecord(block.input) &&
          typeof block.input.command === 'string'
        ) {
          const command = {
            command: block.input.command,
            output: '',
            isError: false,
            denied: false,
          }
          commands.push(command)
          if (typeof block.id === 'string') commandsById.set(block.id, command)
        }
      }
    }
    if (event.type === 'user' && isRecord(event.message) && Array.isArray(event.message.content)) {
      for (const block of event.message.content) {
        if (!isRecord(block) || block.type !== 'tool_result') continue
        const command = commandsById.get(block.tool_use_id)
        if (!command) continue
        command.output = toolResultText(block.content)
        command.isError = block.is_error === true
        command.denied = command.isError && PERMISSION_DENIED.test(command.output)
      }
    }
    if (event.type === 'result') {
      transcript.finalText = typeof event.result === 'string' ? event.result : lastAssistantText
      transcript.turns = typeof event.num_turns === 'number' ? event.num_turns : null
      transcript.costUsd = typeof event.total_cost_usd === 'number' ? event.total_cost_usd : null
      if (isRecord(event.usage)) transcript.usage = usageFromAnthropic(event.usage)
      if (Array.isArray(event.permission_denials)) {
        transcript.permissionDenials = event.permission_denials.map(describeDenial)
      }
      if (event.is_error === true || (event.subtype && event.subtype !== 'success')) {
        transcript.failure = String(event.subtype ?? 'error')
      }
    }
  }

  if (!transcript.finalText) transcript.finalText = lastAssistantText
  if (transcript.usage.total === 0) transcript.usage = sumUsage([...usageByMessage.values()])
  if (!events.some((event) => event.type === 'result')) transcript.failure ??= 'no-result-event'
  return transcript
}

/**
 * @param {unknown} denial
 * @returns {string}
 */
function describeDenial(denial) {
  if (!isRecord(denial)) return 'unknown'
  const input = isRecord(denial.tool_input) ? denial.tool_input : {}
  const detail = typeof input.command === 'string' ? input.command : (input.file_path ?? '')
  return `${denial.tool_name ?? 'unknown'}: ${String(detail).slice(0, 200)}`
}

/**
 * @param {Record<string, any>} usage
 * @returns {TokenUsage}
 */
function usageFromAnthropic(usage) {
  const input = count(usage.input_tokens)
  const output = count(usage.output_tokens)
  const cacheRead = count(usage.cache_read_input_tokens)
  const cacheCreation = count(usage.cache_creation_input_tokens)
  return {
    input,
    output,
    cacheRead,
    cacheCreation,
    total: input + output + cacheRead + cacheCreation,
  }
}

/**
 * @param {TokenUsage[]} usages
 * @returns {TokenUsage}
 */
function sumUsage(usages) {
  return usages.reduce(
    (sum, usage) => ({
      input: sum.input + usage.input,
      output: sum.output + usage.output,
      cacheRead: sum.cacheRead + usage.cacheRead,
      cacheCreation: sum.cacheCreation + usage.cacheCreation,
      total: sum.total + usage.total,
    }),
    emptyUsage(),
  )
}

/**
 * Normalises `codex exec --json` events.
 * @param {Record<string, any>[]} events
 * @returns {Transcript}
 */
export function parseCodexEvents(events) {
  /** @type {ShellCommand[]} */
  const commands = []
  /** @type {Record<string, number>} */
  const toolUses = {}
  /** @type {TokenUsage[]} */
  const turnUsages = []
  let finalText = ''
  /** @type {string | null} */
  let failure = null
  let turns = 0

  for (const event of events) {
    if (event.type === 'turn.completed') {
      turns += 1
      if (isRecord(event.usage)) {
        const input = count(event.usage.input_tokens)
        const cacheRead = count(event.usage.cached_input_tokens)
        const output = count(event.usage.output_tokens)
        turnUsages.push({
          input: input - cacheRead,
          output,
          cacheRead,
          cacheCreation: 0,
          total: input + output,
        })
      }
    }
    if (event.type === 'turn.failed' || event.type === 'error') {
      failure = String(
        (isRecord(event.error) ? event.error.message : event.message) ?? 'codex error',
      )
    }
    if (event.type !== 'item.completed' || !isRecord(event.item)) continue
    const { item } = event
    const itemType = String(item.type ?? item.item_type ?? 'unknown')
    toolUses[itemType] = (toolUses[itemType] ?? 0) + 1
    if (itemType === 'agent_message' && typeof item.text === 'string') finalText = item.text
    if (itemType === 'command_execution' && typeof item.command === 'string') {
      commands.push({
        command: unwrapShellInvocation(item.command),
        output: typeof item.aggregated_output === 'string' ? item.aggregated_output : '',
        isError:
          item.status === 'failed' || (typeof item.exit_code === 'number' && item.exit_code !== 0),
        denied: false,
      })
    }
  }

  return {
    agent: 'codex',
    model: null,
    commands,
    toolUses,
    finalText,
    usage: sumUsage(turnUsages),
    costUsd: null,
    turns,
    permissionDenials: [],
    failure: failure ?? (turns === 0 ? 'no-completed-turn' : null),
    skills: null,
  }
}

const GENIE_VALUE_FLAGS = new Set(['--max-bytes', '--select', '--fields', '--url', '--output'])

/**
 * @param {string[]} words
 * @returns {GenieInvocation}
 */
function describeGenieInvocation(words) {
  /** @type {string[]} */
  const args = []
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index] ?? ''
    if (GENIE_VALUE_FLAGS.has(word)) index += 1
    else if (!word.startsWith('-')) args.push(word)
  }
  const subcommand = args[0] ?? null
  const tool = subcommand === 'call' || subcommand === 'tools' ? (args[1] ?? null) : null
  return { subcommand, tool }
}

const GENIE_ERROR = /"status"\s*:\s*"error"[^\n]*?"reason"\s*:\s*"([^"]+)"/g
const PERMISSION_DENIED = /^Permission to use \w+ has been denied/

/**
 * Counts executed genie-react and agent-browser invocations, including several chained in one Bash call.
 * A command is runtime evidence when it ran more `genie-react call`s than it printed error envelopes.
 * @param {ShellCommand[]} commands
 * @returns {CommandMetrics}
 */
export function commandMetrics(commands) {
  /** @type {CommandMetrics} */
  const metrics = {
    genieCalls: 0,
    genieInvocations: [],
    browserCalls: 0,
    browserSubcommands: {},
    otherCommands: 0,
    failedCommands: 0,
    deniedCommands: 0,
    genieEvidenceCommands: 0,
    genieErrorReasons: {},
  }
  for (const { command, output, isError, denied } of commands) {
    if (denied) {
      metrics.deniedCommands += 1
      continue
    }
    if (isError) metrics.failedCommands += 1
    let usedGenie = false
    let usedKnownTool = false
    let toolCalls = 0
    for (const words of splitShellCommands(command)) {
      const program = programWords(words)
      const name = program[0] === undefined ? '' : basename(program[0])
      if (name === 'genie-react') {
        usedGenie = true
        usedKnownTool = true
        metrics.genieCalls += 1
        const invocation = describeGenieInvocation(program)
        if (invocation.subcommand === 'call') toolCalls += 1
        metrics.genieInvocations.push(invocation)
      } else if (name === 'agent-browser') {
        usedKnownTool = true
        metrics.browserCalls += 1
        const subcommand = program.slice(1).find((word) => !word.startsWith('-')) ?? '(none)'
        metrics.browserSubcommands[subcommand] = (metrics.browserSubcommands[subcommand] ?? 0) + 1
      }
    }
    if (!usedKnownTool) metrics.otherCommands += 1
    if (!usedGenie) continue
    const errors = [...output.matchAll(GENIE_ERROR)].map((match) => match[1] ?? 'unknown')
    for (const reason of errors) {
      metrics.genieErrorReasons[reason] = (metrics.genieErrorReasons[reason] ?? 0) + 1
    }
    if (!isError && toolCalls > errors.length) metrics.genieEvidenceCommands += 1
  }
  return metrics
}

/**
 * @param {'claude' | 'codex'} agent
 * @param {string} text
 * @returns {Transcript}
 */
export function parseTranscript(agent, text) {
  const events = parseJsonLines(text)
  return agent === 'codex' ? parseCodexEvents(events) : parseClaudeEvents(events)
}
