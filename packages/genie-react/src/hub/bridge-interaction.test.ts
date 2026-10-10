import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decodeFrame, devtoolsInteractionStopContract, newId } from '../protocol'
import { createTestBridge, type Frame, isResult, open, send } from './bridge-test-harness'
import type { StandaloneBridgeHandle } from './standalone'

describe('GenieBridge interaction capture', () => {
  let handle: StandaloneBridgeHandle
  let url: string

  beforeEach(async () => {
    handle = createTestBridge()
    url = (await handle.listen()).url
  })

  afterEach(async () => {
    await handle.close()
  })

  it('freezes one observation before settle and labels excluded post-interaction commits', async () => {
    const { ws: app } = await open(`${url}?role=app`)
    const calls: string[] = []
    let renderCalls = 0
    app.on('message', (data) => {
      const message = decodeFrame(data.toString()) as Frame
      if (message.kind !== 'bridge/request') return
      calls.push(message.tool)
      let result: unknown
      if (message.tool === 'react_clear_renders') {
        result = {
          ok: true,
          tracking: true,
          documentCommitId: 10,
          observation: { id: 'observation:interaction', startedAfterDocumentCommitId: 10 },
          observationConfig: { components: ['Row'] },
        }
      } else if (message.tool === 'react_profile_stop') {
        result = { ok: true, tracking: false, commits: 2 }
      } else if (message.tool === 'react_get_renders') {
        renderCalls += 1
        const documentCommitId = renderCalls === 1 ? 12 : 13
        result = {
          tracking: false,
          renderCollection: 'available',
          commits: 2,
          documentCommitId,
          observation: { id: 'observation:interaction' },
          comparable: true,
          notComparableReasons: [],
          summary: { semantics: 'exact', trackedComponents: 1, totalRenders: 4, totalUpdates: 3 },
          coverage: { complete: true },
          components: [
            {
              id: 7,
              name: 'Row',
              renders: 4,
              updates: 3,
              selfTime: 1.23456,
              causeCounts: { mount: 1, props: 3, state: 0 },
              causes: [{ kind: 'props', evidence: 'exact', name: 'item' }],
            },
          ],
        }
      } else if (message.tool === 'react_render_causes') {
        result = {
          documentCommitId: 13,
          observation: { id: 'observation:interaction' },
          events: [{ renderEventId: 'render:1', documentCommitId: 12 }],
          coverage: { complete: true },
        }
      } else if (message.tool === 'react_effect_timeline') {
        result = {
          documentCommitId: 13,
          observation: { id: 'observation:interaction' },
          events: [
            {
              effectEventId: 'effect:1',
              effectId: 'effect:mount:1:0',
              componentName: 'Row',
              kind: 'effect',
              documentCommitId: 12,
              execution: { status: 'observed', durationMs: 0.5 },
              source: { file: 'Row.tsx', line: 4, column: 2 },
            },
          ],
          coverage: { complete: true },
        }
      } else if (message.tool === 'react_component_cohort') {
        result = {
          observation: { id: 'observation:interaction' },
          status: 'updated',
          matched: 2,
          coverage: { complete: true },
        }
      }
      send(app, { kind: 'app/response', id: message.id, ok: true, result })
    })
    const toolNames = [
      'react_clear_renders',
      'react_profile_stop',
      'react_get_renders',
      'react_render_causes',
      'react_effect_timeline',
      'react_component_cohort',
    ]
    send(app, {
      kind: 'app/hello',
      protocol: 1,
      sessionId: 'interaction-session',
      logicalSessionId: 'interaction-logical',
      documentGeneration: 1,
      app: { name: 'interaction fixture' },
      capabilities: ['react'],
      tools: toolNames.map((name) => ({
        name,
        title: name,
        description: name,
        group: 'react.render',
      })),
    })
    const { ws: agent, inbox } = await open(`${url}?role=agent`)

    const beginId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: beginId,
      tool: 'devtools_interaction_begin',
      args: { name: 'open row', components: ['Row'] },
      sessionId: 'interaction-logical',
    })
    const began = await inbox.wait(isResult(beginId))
    expect(began.result).toMatchObject({
      kind: 'interaction-observation',
      state: 'recording',
      observationId: 'observation:interaction',
      startDocumentCommitId: 10,
    })

    const overlappingId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: overlappingId,
      tool: 'devtools_interaction_begin',
      args: { name: 'unsafe overlap' },
    })
    const overlapping = await inbox.wait(isResult(overlappingId))
    expect(overlapping).toMatchObject({ ok: false, errorCode: 'invalid-args' })
    expect(overlapping.error).toContain('already has a starting or recording interaction')

    const stopId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: stopId,
      tool: 'devtools_interaction_stop',
      args: {
        interactionId: began.result.interactionId,
        domains: ['react'],
        quietMs: 100,
        timeoutMs: 2_000,
      },
    })
    const stopped = await inbox.wait(isResult(stopId), 3_000)
    expect(() => devtoolsInteractionStopContract.output.parse(stopped.result)).not.toThrow()
    const boundary = {
      observationId: 'observation:interaction',
      startDocumentCommitId: 10,
      stopDocumentCommitId: 12,
      finalDocumentCommitId: 13,
      recordedCommits: 2,
      postInteractionCommits: 1,
      trackingFrozen: true,
      postInteractionPolicy: 'excluded-by-profile-freeze',
    }
    expect(stopped.result).toMatchObject({
      kind: 'interaction-capture',
      view: 'summary',
      state: 'completed',
      boundary,
      settle: { ok: true, domains: { react: { status: 'met' } } },
      coverage: { complete: true, comparable: true, notComparableReasons: [] },
      renders: {
        status: 'ok',
        commits: 2,
        totalRenders: 4,
        semantics: 'exact',
        omittedComponents: 0,
        components: [
          {
            id: 7,
            name: 'Row',
            renders: 4,
            updates: 3,
            selfTime: 1.23,
            topCause: { kind: 'props', count: 3, latestName: 'item', evidence: 'exact' },
          },
        ],
      },
      causes: { status: 'ok', events: 1 },
      effects: {
        status: 'ok',
        tool: 'react_effect_timeline',
        events: 1,
        hottest: [
          {
            effectId: 'effect:mount:1:0',
            componentName: 'Row',
            events: 1,
            executions: 1,
            durationMs: 0.5,
            source: 'Row.tsx:4:2',
          },
        ],
      },
      cohorts: [{ component: 'Row', status: 'ok', cohortStatus: 'updated', matched: 2 }],
      fullView: {
        tool: 'devtools_interaction_stop',
        args: { interactionId: began.result.interactionId, view: 'full' },
      },
    })
    expect(stopped.result).not.toHaveProperty('sections')
    expect(stopped.result.settle.domains.react).not.toHaveProperty('lastObserved')
    expect(stopped.result.warnings[0]).toContain('excluded by the profile freeze')
    expect(calls.indexOf('react_profile_stop')).toBeLessThan(calls.indexOf('react_get_renders'))

    const fullId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: fullId,
      tool: 'devtools_interaction_stop',
      args: { interactionId: began.result.interactionId, view: 'full' },
    })
    const full = (await inbox.wait(isResult(fullId))).result
    expect(() => devtoolsInteractionStopContract.output.parse(full)).not.toThrow()
    expect(full).toMatchObject({
      view: 'full',
      boundary,
      sections: {
        renders: { status: 'ok', tool: 'react_get_renders', args: { view: 'full' } },
        causes: { status: 'ok', tool: 'react_render_causes', args: { view: 'full' } },
        effects: { status: 'ok', tool: 'react_effect_timeline' },
        cohorts: [{ component: 'Row', evidence: { status: 'ok' } }],
      },
    })

    const sectionId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: sectionId,
      tool: 'devtools_interaction_stop',
      args: { interactionId: began.result.interactionId, view: 'full', sections: ['causes'] },
    })
    const causesOnly = (await inbox.wait(isResult(sectionId))).result
    expect(Object.keys(causesOnly.sections)).toEqual(['causes'])
    expect(causesOnly.sections.causes).toEqual(full.sections.causes)

    const repeatId = newId()
    send(agent, {
      kind: 'agent/invoke',
      id: repeatId,
      tool: 'devtools_interaction_stop',
      args: { interactionId: began.result.interactionId },
    })
    expect((await inbox.wait(isResult(repeatId))).result).toEqual(stopped.result)
  })
})
