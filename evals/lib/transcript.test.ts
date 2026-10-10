import { describe, expect, it } from 'vitest'
import {
  commandMetrics,
  parseClaudeEvents,
  parseCodexEvents,
  parseJsonLines,
} from './transcript.mjs'

const usage = {
  input_tokens: 10,
  output_tokens: 20,
  cache_read_input_tokens: 300,
  cache_creation_input_tokens: 40,
}

function claudeStream() {
  return [
    { type: 'system', subtype: 'init', model: 'claude-sonnet', skills: ['genie', 'debug'] },
    {
      type: 'assistant',
      message: {
        id: 'msg_1',
        usage,
        content: [
          { type: 'text', text: 'Looking at renders.' },
          {
            type: 'tool_use',
            id: 'tool_1',
            name: 'Bash',
            input: {
              command: `agent-browser open http://127.0.0.1:5173 && pnpm exec genie-react call react_render_causes '{"component":"StatusBadge"}'`,
            },
          },
        ],
      },
    },
    {
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool_1',
            content: [
              {
                type: 'text',
                text: '{"schemaVersion":"1.0","status":"error","reason":"busy","message":"The app is busy."}',
              },
            ],
          },
        ],
      },
    },
    {
      type: 'assistant',
      message: {
        id: 'msg_2',
        usage,
        content: [
          { type: 'tool_use', id: 'tool_2', name: 'Read', input: { file_path: 'src/App.tsx' } },
        ],
      },
    },
    {
      type: 'assistant',
      parent_tool_use_id: 'task_1',
      message: {
        id: 'msg_sub',
        content: [
          {
            type: 'tool_use',
            id: 'tool_sub',
            name: 'Bash',
            input: { command: 'genie-react status' },
          },
        ],
      },
    },
    {
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'Found it.\n```json\n{"component":"StatusBadge","cause":"x","file":"y"}\n```',
      num_turns: 3,
      total_cost_usd: 0.42,
      usage: { ...usage, input_tokens: 100 },
      permission_denials: [{ tool_name: 'Bash', tool_input: { command: 'npx tsc' } }],
    },
  ]
}

describe('parseJsonLines', () => {
  it('skips blank and non-JSON lines', () => {
    expect(parseJsonLines('{"type":"a"}\n\nwarning: x\n{"type":"b"}\n{broken')).toEqual([
      { type: 'a' },
      { type: 'b' },
    ])
  })
})

describe('parseClaudeEvents', () => {
  it('normalises commands, tool use, usage and the final answer', () => {
    const transcript = parseClaudeEvents(claudeStream())
    expect(transcript.model).toBe('claude-sonnet')
    expect(transcript.skills).toContain('genie')
    expect(transcript.commands).toHaveLength(1)
    expect(transcript.commands[0]?.output).toContain('"reason":"busy"')
    expect(transcript.commands[0]?.denied).toBe(false)
    expect(transcript.toolUses).toEqual({ Bash: 1, Read: 1 })
    expect(transcript.usage).toEqual({
      input: 100,
      output: 20,
      cacheRead: 300,
      cacheCreation: 40,
      total: 460,
    })
    expect(transcript.costUsd).toBe(0.42)
    expect(transcript.turns).toBe(3)
    expect(transcript.finalText).toContain('"component":"StatusBadge"')
    expect(transcript.permissionDenials).toEqual(['Bash: npx tsc'])
    expect(transcript.failure).toBeNull()
  })

  it('sums per-message usage once per message when the result event is missing', () => {
    const events = claudeStream().filter((event) => event.type !== 'result')
    const transcript = parseClaudeEvents(events)
    expect(transcript.usage.total).toBe(2 * 370)
    expect(transcript.failure).toBe('no-result-event')
    expect(transcript.finalText).toBe('Looking at renders.')
  })

  it('reports non-success results as failures', () => {
    const events = [{ type: 'result', subtype: 'error_max_turns', is_error: true }]
    expect(parseClaudeEvents(events).failure).toBe('error_max_turns')
  })
})

describe('parseCodexEvents', () => {
  it('normalises command executions, messages and turn usage', () => {
    const transcript = parseCodexEvents([
      { type: 'thread.started', thread_id: 't' },
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: `bash -lc 'genie-react call react_error_state {}'`,
          aggregated_output: '{"caughtErrors":[]}',
          exit_code: 0,
          status: 'completed',
        },
      },
      {
        type: 'item.completed',
        item: {
          type: 'command_execution',
          command: 'agent-browser open x',
          exit_code: 1,
          status: 'failed',
        },
      },
      { type: 'item.completed', item: { type: 'agent_message', text: 'done' } },
      {
        type: 'turn.completed',
        usage: { input_tokens: 1000, cached_input_tokens: 600, output_tokens: 50 },
      },
    ])
    expect(transcript.commands.map((command) => command.command)).toEqual([
      'genie-react call react_error_state {}',
      'agent-browser open x',
    ])
    expect(transcript.commands[1]?.isError).toBe(true)
    expect(transcript.finalText).toBe('done')
    expect(transcript.usage).toEqual({
      input: 400,
      output: 50,
      cacheRead: 600,
      cacheCreation: 0,
      total: 1050,
    })
    expect(transcript.failure).toBeNull()
  })

  it('reports a run without completed turns as a failure', () => {
    expect(parseCodexEvents([{ type: 'turn.failed', error: { message: 'auth' } }]).failure).toBe(
      'auth',
    )
    expect(parseCodexEvents([]).failure).toBe('no-completed-turn')
  })
})

describe('commandMetrics', () => {
  it('counts chained invocations, tools, subcommands and genie error reasons', () => {
    const metrics = commandMetrics([
      {
        command: `agent-browser open x && genie-react call react_clear_renders '{}' && genie-react --max-bytes 9000 call react_get_renders '{}'`,
        output:
          '{"status":"error","reason":"session-not-ready"}\n{"status":"error","reason":"busy"}',
        isError: false,
        denied: false,
      },
      { command: 'agent-browser type "#q" ab', output: '', isError: true, denied: false },
      {
        command: 'cat package.json',
        output: '{"status":"error","reason":"ignored"}',
        isError: false,
        denied: false,
      },
    ])
    expect(metrics.genieCalls).toBe(2)
    expect(metrics.genieInvocations).toEqual([
      { subcommand: 'call', tool: 'react_clear_renders' },
      { subcommand: 'call', tool: 'react_get_renders' },
    ])
    expect(metrics.browserCalls).toBe(2)
    expect(metrics.browserSubcommands).toEqual({ open: 1, type: 1 })
    expect(metrics.otherCommands).toBe(1)
    expect(metrics.failedCommands).toBe(1)
    expect(metrics.genieErrorReasons).toEqual({ 'session-not-ready': 1, busy: 1 })
    expect(metrics.genieToolCalls).toBe(2)
    expect(metrics.genieSuccessfulToolCalls).toBe(0)
  })

  it('excludes denied commands and counts successful tool calls as runtime evidence', () => {
    const metrics = commandMetrics([
      {
        command: 'cd /tmp; genie-react call react_error_state {}',
        output:
          'Permission to use Bash has been denied because Claude Code is running in dontAsk mode.',
        isError: true,
        denied: true,
      },
      { command: 'genie-react status', output: '{"ready":true}', isError: false, denied: false },
      {
        command: 'genie-react call react_error_state {}',
        output: '{"caughtErrors":[]}',
        isError: false,
        denied: false,
      },
    ])
    expect(metrics.deniedCommands).toBe(1)
    expect(metrics.genieCalls).toBe(2)
    expect(metrics.failedCommands).toBe(0)
    expect(metrics.genieSuccessfulToolCalls).toBe(1)
  })
})

describe('permission denials', () => {
  it('marks commands named by the result event as denied, whatever the message wording', () => {
    const transcript = parseClaudeEvents([
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'Bash', input: { command: 'npx tsc' } },
            { type: 'tool_use', id: 'tool_2', name: 'Bash', input: { command: 'cat src/a.ts' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              is_error: true,
              content: 'Claude Code blocked this command.',
            },
            {
              type: 'tool_result',
              tool_use_id: 'tool_2',
              is_error: true,
              content: 'cat: src/a.ts: No such file or directory',
            },
          ],
        },
      },
      {
        type: 'result',
        subtype: 'success',
        result: 'done',
        permission_denials: [
          { tool_name: 'Bash', tool_use_id: 'tool_1', tool_input: { command: 'npx tsc' } },
        ],
      },
    ])
    expect(transcript.commands.map((command) => command.denied)).toEqual([true, false])
    expect(commandMetrics(transcript.commands)).toMatchObject({
      deniedCommands: 1,
      failedCommands: 1,
    })
  })

  it('recognises denial messages that name the command when the result event is missing', () => {
    const transcript = parseClaudeEvents([
      {
        type: 'assistant',
        message: {
          id: 'msg_1',
          content: [
            { type: 'tool_use', id: 'tool_1', name: 'Bash', input: { command: 'npx tsc' } },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'tool_1',
              is_error: true,
              content:
                'Permission to use Bash with command npx tsc has been denied because Claude Code is running in dontAsk mode.',
            },
          ],
        },
      },
    ])
    expect(transcript.commands[0]?.denied).toBe(true)
  })
})

describe('runtime evidence', () => {
  it('counts batch items from JSONL output, including failed items', () => {
    const metrics = commandMetrics([
      {
        command: `genie-react batch '[{"tool":"react_clear_renders"},{"tool":"react_get_renders"},{"tool":"react_error_state"}]'`,
        output: [
          '{"schemaVersion":"1.0","tool":"react_clear_renders","ok":true,"status":"ok","result":{}}',
          '{"schemaVersion":"1.0","tool":"react_get_renders","ok":true,"status":"ok","result":{"components":[]}}',
          '{"schemaVersion":"1.0","tool":"react_error_state","ok":false,"status":"error","reason":"busy"}',
        ].join('\n'),
        isError: true,
        denied: false,
      },
    ])
    expect(metrics.genieToolCalls).toBe(3)
    expect(metrics.genieSuccessfulToolCalls).toBe(2)
    expect(metrics.genieErrorReasons).toEqual({ busy: 1 })
  })

  it('reads a --json batch array and pretty-printed error envelopes', () => {
    const batch = JSON.stringify(
      [
        { tool: 'react_get_renders', ok: true, status: 'ok', result: {} },
        { tool: 'react_render_causes', ok: false, status: 'error', reason: 'invalid-args' },
      ],
      null,
      2,
    )
    const envelope = JSON.stringify(
      { schemaVersion: '1.0', status: 'error', reason: 'not_connected', message: 'No app' },
      null,
      2,
    )
    const metrics = commandMetrics([
      {
        command: `genie-react batch --json '[{"tool":"react_get_renders"},{"tool":"react_render_causes"}]' | jq .`,
        output: batch,
        isError: false,
        denied: false,
      },
      {
        command: "genie-react call react_error_state '{}' | jq .",
        output: envelope,
        isError: false,
        denied: false,
      },
    ])
    expect(metrics.genieToolCalls).toBe(3)
    expect(metrics.genieSuccessfulToolCalls).toBe(1)
    expect(metrics.genieErrorReasons).toEqual({ 'invalid-args': 1, not_connected: 1 })
  })

  it('counts a truncated successful call and a whole-batch connection failure', () => {
    const metrics = commandMetrics([
      {
        command: "genie-react call react_render_causes '{}' | head -c 20",
        output: '{"tracking":true,"co',
        isError: false,
        denied: false,
      },
      {
        command: 'echo \'[{"tool":"a"},{"tool":"b"}]\' | genie-react batch',
        output: '{"schemaVersion":"1.0","status":"error","reason":"not_connected"}',
        isError: true,
        denied: false,
      },
    ])
    expect(metrics.genieToolCalls).toBe(2)
    expect(metrics.genieSuccessfulToolCalls).toBe(1)
  })
})
