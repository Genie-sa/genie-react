import { z } from 'zod'
import { defineCollector, defineCollectorTool, type GenieCollector } from '../client'
import { defineAgentToolContract } from '../protocol'

/** The part of React Native's `AppState` this collector reads; passed in so the shared entry never imports react-native. */
export interface AppStateLike {
  currentState: string | null | undefined
  addEventListener: (
    type: 'change',
    listener: (state: string) => void,
  ) => { remove: () => void } | undefined
}

export interface VisibilityCollectorOptions {
  appState?: AppStateLike
}

type VisibilitySource = 'document' | 'app-state' | 'unavailable'
type VisibilityState = 'visible' | 'hidden' | 'unknown'

const browserVisibilityContract = defineAgentToolContract({
  name: 'browser_visibility',
  title: 'Document visibility record',
  description:
    'Report whether the app is visible now and how often it was hidden since Genie started: a hidden browser tab, or a React Native app in the background or inactive. Hidden documents throttle timers and frames, so work deferred while hidden can land after a measurement. Compare hiddenTransitions between two reads to tell whether the app was hidden in between.',
  group: 'perf',
  input: z.object({}),
  output: z.object({
    source: z
      .enum(['document', 'app-state', 'unavailable'])
      .describe(
        'document = document.visibilityState; app-state = React Native AppState; unavailable = no visibility signal, so hidden intervals are not observed.',
      ),
    state: z.enum(['visible', 'hidden', 'unknown']),
    hiddenTransitions: z
      .number()
      .int()
      .nonnegative()
      .describe('Times the app became hidden since Genie started; monotonic within a document.'),
    hiddenMs: z
      .number()
      .nonnegative()
      .describe('Total time hidden since Genie started, including a current hidden interval.'),
  }),
  annotations: { readOnlyHint: true },
})

class VisibilityRecord {
  private state: VisibilityState = 'unknown'
  private hiddenTransitions = 0
  private hiddenMs = 0
  private hiddenSince: number | null = null

  constructor(readonly source: VisibilitySource) {}

  observe(state: VisibilityState): void {
    if (state === this.state) return
    const now = Date.now()
    if (state === 'hidden') {
      this.hiddenTransitions += 1
      this.hiddenSince = now
    } else if (this.hiddenSince !== null) {
      this.hiddenMs += now - this.hiddenSince
      this.hiddenSince = null
    }
    this.state = state
  }

  read(): z.infer<typeof browserVisibilityContract.output> {
    const current = this.hiddenSince === null ? 0 : Date.now() - this.hiddenSince
    return {
      source: this.source,
      state: this.state,
      hiddenTransitions: this.hiddenTransitions,
      hiddenMs: this.hiddenMs + current,
    }
  }
}

/** React Native reports `inactive` during transitions and overlays; it counts as hidden because timers can stall there too. */
function appStateVisibility(state: string | null | undefined): VisibilityState {
  if (state === 'active') return 'visible'
  return state === 'background' || state === 'inactive' ? 'hidden' : 'unknown'
}

function documentVisibility(): VisibilityState {
  return document.visibilityState === 'hidden' ? 'hidden' : 'visible'
}

function startRecord(options: VisibilityCollectorOptions): {
  record: VisibilityRecord
  stop: () => void
} {
  const { appState } = options
  if (appState) {
    const record = new VisibilityRecord('app-state')
    record.observe(appStateVisibility(appState.currentState))
    const subscription = appState.addEventListener('change', (state) =>
      record.observe(appStateVisibility(state)),
    )
    return { record, stop: () => subscription?.remove() }
  }
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return { record: new VisibilityRecord('unavailable'), stop: () => {} }
  }
  const record = new VisibilityRecord('document')
  const update = (): void => record.observe(documentVisibility())
  update()
  document.addEventListener('visibilitychange', update)
  return { record, stop: () => document.removeEventListener('visibilitychange', update) }
}

export function visibilityCollector(options: VisibilityCollectorOptions = {}): GenieCollector {
  let active: ReturnType<typeof startRecord> | null = null
  return defineCollector({
    meta: {
      id: 'visibility',
      title: 'Visibility',
      description: 'Whether the document or app was hidden, which throttles deferred work',
    },
    capabilities: ['perf'],
    start: () => {
      active = startRecord(options)
      return () => {
        active?.stop()
        active = null
      }
    },
    tools: [
      defineCollectorTool({
        contract: browserVisibilityContract,
        handler: () =>
          active?.record.read() ?? {
            source: 'unavailable' as const,
            state: 'unknown' as const,
            hiddenTransitions: 0,
            hiddenMs: 0,
          },
      }),
    ],
  })
}
