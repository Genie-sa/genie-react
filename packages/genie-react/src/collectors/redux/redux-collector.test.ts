import { configureStore as configureStore1, createSlice as createSlice1 } from '@reduxjs/toolkit'
import {
  applyMiddleware as applyMiddleware4,
  combineReducers as combineReducers4,
  createStore as createStore4,
  type Dispatch,
  type Middleware,
} from 'redux'
import { combineReducers as combineReducers5, legacy_createStore as createStore5 } from 'redux-5'
import thunk from 'redux-thunk'
import {
  configureStore as configureStore2,
  createAsyncThunk as createAsyncThunk2,
  createSlice as createSlice2,
} from 'reduxjs-toolkit-2'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CollectorContext, GenieCollector } from '../../client'
import { reduxStoreTaps, resetReduxStoreRegistryForTests } from '../causal/redux-store-registry'
import { reduxCollector } from './index'
import type { ReduxStoreTap } from './store-tap'

interface ReduxRecord {
  sequence: number
  actionId: string
  kind: string
  type: string | null
  label: string
  parentActionId: string | null
  outcome: string
  error: string | null
  rootStateChanged: boolean | null
  changedSlices: string[]
  unrecordedNestedDispatches: number
  mutation: {
    status: string
    notScannedReason: string | null
    findings: { path: (string | number)[]; change: string }[]
    scanTruncated: boolean
  }
  payload?: unknown
}

interface ActionsResult {
  store: { storeId: string; name: string }
  records: ReduxRecord[]
  matched: number
  omittedBefore: number
  more: boolean
  nextAfterSequence: number | null
  coverage: { evictedRecords: number; unrecordedChanges: number }
}

const context: CollectorContext = {
  pushSnapshot() {},
  pushEvent() {},
  refreshTools() {},
  markActivity() {},
}

async function call<T>(collector: GenieCollector, name: string, input: unknown = {}): Promise<T> {
  const tool = collector.tools?.find((candidate) => candidate.contract.name === name)
  if (!tool) throw new Error(`Missing tool ${name}`)
  const output = await tool.handler(tool.contract.input.parse(input) as never, context)
  return tool.contract.output.parse(output) as T
}

const actions = (collector: GenieCollector, input: unknown = {}) =>
  call<ActionsResult>(collector, 'redux_actions', input)

afterEach(() => {
  for (const tap of reduxStoreTaps() as ReduxStoreTap[]) tap.dispose()
  resetReduxStoreRegistryForTests()
  vi.unstubAllEnvs()
})

interface Note {
  id: string
  text: string
}

interface ReportsState {
  notes: Note[]
  range: string
}

/** The legacy app's bug: the reducer pushes into the existing array and returns the same state. */
function mutatingReports(
  state: ReportsState = { notes: [], range: '30d' },
  action: { type: string; note?: Note; range?: string },
): ReportsState {
  switch (action.type) {
    case 'reports/NOTE_ADDED':
      state.notes.push(action.note as Note)
      return state
    case 'reports/RANGE_SET':
      return { ...state, range: action.range as string }
    default:
      return state
  }
}

function immutableReports(
  state: ReportsState = { notes: [], range: '30d' },
  action: { type: string; note?: Note; range?: string },
): ReportsState {
  switch (action.type) {
    case 'reports/NOTE_ADDED':
      return { ...state, notes: [...state.notes, action.note as Note] }
    case 'reports/RANGE_SET':
      return { ...state, range: action.range as string }
    default:
      return state
  }
}

const session = (state = { user: 'ava' }) => state

describe('dispatch keeps the app behaviour', () => {
  it('returns the reducer result, rethrows the same error and keeps listener order on Redux Toolkit 1.9', async () => {
    const store = configureStore1({
      reducer: {
        counter: (state: number = 0, action: { type: string }) => {
          if (action.type === 'explode') throw new TypeError('reducer exploded')
          return action.type === 'inc' ? state + 1 : state
        },
      },
    })
    const heard: string[] = []
    store.subscribe(() => heard.push(`app:${store.getState().counter}`))
    const collector = reduxCollector(store)
    store.subscribe(() => heard.push(`late:${store.getState().counter}`))

    const action = { type: 'inc' }
    expect(store.dispatch(action)).toBe(action)
    const failure = (() => {
      try {
        store.dispatch({ type: 'explode' })
      } catch (error) {
        return error
      }
      return null
    })()

    expect(failure).toBeInstanceOf(TypeError)
    expect((failure as Error).message).toBe('reducer exploded')
    expect(store.getState().counter).toBe(1)
    expect(heard).toEqual(['app:1', 'late:1'])
    const { records } = await actions(collector)
    expect(records.map((record) => [record.type, record.outcome, record.error])).toEqual([
      ['inc', 'returned', null],
      ['explode', 'threw', 'reducer exploded'],
    ])
  })

  it('hands thunks the real getState and extra argument and returns their promise on Redux 4 with redux-thunk', async () => {
    const extra = { api: 'client' }
    const store = createStore4(
      combineReducers4({ reports: immutableReports }),
      applyMiddleware4(thunk.withExtraArgument(extra)),
    )
    const collector = reduxCollector(store)
    const seen: unknown[] = []
    const loadRange = (range: string) =>
      async function loadRange(
        dispatch: (action: unknown) => unknown,
        getState: () => unknown,
        extraArgument: unknown,
      ) {
        seen.push(getState(), extraArgument)
        await Promise.resolve()
        dispatch({ type: 'reports/RANGE_SET', range })
        return `loaded ${range}`
      }

    const returned = store.dispatch(loadRange('7d') as never) as unknown as Promise<string>

    expect(returned).toBeInstanceOf(Promise)
    await expect(returned).resolves.toBe('loaded 7d')
    expect(seen[1]).toBe(extra)
    expect(store.getState().reports.range).toBe('7d')
    const { records } = await actions(collector)
    const [thunkRecord, inner] = records
    expect(thunkRecord).toMatchObject({
      kind: 'thunk',
      label: 'thunk loadRange',
      outcome: 'returned',
    })
    expect(inner).toMatchObject({
      kind: 'action',
      type: 'reports/RANGE_SET',
      parentActionId: thunkRecord?.actionId,
      changedSlices: ['reports'],
    })
  })

  it('records createAsyncThunk lifecycle actions under their thunk on Redux Toolkit 2', async () => {
    const reports = createSlice2({
      name: 'reports',
      initialState: { status: 'idle', rows: [] as number[] },
      reducers: {},
      extraReducers: (builder) => {
        builder
          .addCase(load.pending, (state) => {
            state.status = 'loading'
          })
          .addCase(load.fulfilled, (state, action) => {
            state.status = 'ready'
            state.rows = action.payload
          })
      },
    })
    const load = createAsyncThunk2('reports/load', async (count: number) =>
      Array.from({ length: count }, (_, index) => index),
    )
    const store = configureStore2({ reducer: { reports: reports.reducer } })
    const collector = reduxCollector(store)

    const result = await store.dispatch(load(3))

    expect(result.payload).toEqual([0, 1, 2])
    expect(store.getState().reports).toEqual({ status: 'ready', rows: [0, 1, 2] })
    const { records } = await actions(collector)
    const thunkId = records[0]?.actionId
    expect(records.map((record) => [record.kind, record.type, record.parentActionId])).toEqual([
      ['thunk', null, null],
      ['action', 'reports/load/pending', thunkId],
      ['action', 'reports/load/fulfilled', thunkId],
    ])
    expect(records.every((record) => record.mutation.status !== 'detected')).toBe(true)
  })

  it('leaves dispatch untouched and records nothing in a production build', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const store = createStore5(combineReducers5({ reports: immutableReports }))
    const dispatch = store.dispatch

    const collector = reduxCollector(store)

    expect(store.dispatch).toBe(dispatch)
    expect(collector.tools ?? []).toHaveLength(0)
    expect(reduxStoreTaps()).toHaveLength(0)
  })

  it('stops recording and restores the original dispatch when disposed', async () => {
    const store = createStore5(combineReducers5({ reports: immutableReports }))
    const original = store.dispatch
    reduxCollector(store)
    const [tap] = reduxStoreTaps() as ReduxStoreTap[]

    tap?.dispose()

    expect(store.dispatch).toBe(original)
    expect(reduxStoreTaps()).toHaveLength(0)
  })
})

describe('mutation detection', () => {
  it('flags a reducer that pushes into existing state and returns the same root', async () => {
    const store = createStore4(combineReducers4({ session, reports: mutatingReports }))
    const collector = reduxCollector(store)

    store.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'note-1', text: 'Ship it' } })

    const { records } = await actions(collector)
    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      type: 'reports/NOTE_ADDED',
      rootStateChanged: false,
      changedSlices: [],
      mutation: {
        status: 'detected',
        findings: [{ path: ['reports', 'notes'], change: 'length-changed' }],
      },
    })
  })

  it('flags an in-place change even when another slice gets a new identity in the same action', async () => {
    const store = createStore5(
      combineReducers5({
        reports: (state: ReportsState = { notes: [], range: '30d' }, action: { type: string }) => {
          if (action.type !== 'touch') return state
          state.range = '7d'
          return state
        },
        audit: (state: string[] = [], action: { type: string }) =>
          action.type === 'touch' ? [...state, 'touched'] : state,
      }),
    )
    const collector = reduxCollector(store)

    store.dispatch({ type: 'touch' })

    const [record] = (await actions(collector)).records
    expect(record?.rootStateChanged).toBe(true)
    expect(record?.changedSlices).toEqual(['audit'])
    expect(record?.mutation.findings).toEqual([
      { path: ['reports', 'range'], change: 'property-replaced' },
    ])
  })

  it('reports no mutation for immutable reducers, Immer slices, and actions nothing handles', async () => {
    const notes = createSlice1({
      name: 'notes',
      initialState: { items: [] as Note[] },
      reducers: {
        added(state, action: { payload: Note }) {
          state.items.push(action.payload)
        },
      },
    })
    const store = configureStore1({ reducer: { notes: notes.reducer, reports: immutableReports } })
    const collector = reduxCollector(store)

    store.dispatch(notes.actions.added({ id: 'n1', text: 'a' }))
    store.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'n2', text: 'b' } })
    store.dispatch({ type: 'nobody/handles' })

    const { records } = await actions(collector)
    expect(records.map((record) => [record.type, record.mutation.status])).toEqual([
      ['notes/added', 'none-detected'],
      ['reports/NOTE_ADDED', 'none-detected'],
      ['nobody/handles', 'none-detected'],
    ])
    expect(records.map((record) => record.rootStateChanged)).toEqual([true, true, false])
  })

  it('finds a mutation in a small slice even when another slice is far larger than the scan budget', async () => {
    const issues = Object.fromEntries(
      Array.from({ length: 5_000 }, (_, index) => [`CORE-${index}`, { id: index, title: 't' }]),
    )
    const store = createStore4(
      combineReducers4({
        issues: (state = { entities: issues }) => state,
        reports: mutatingReports,
      }),
    )
    const collector = reduxCollector(store)

    store.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'note-1', text: 'x' } })

    const [record] = (await actions(collector)).records
    expect(record?.mutation.status).toBe('detected')
    expect(record?.mutation.scanTruncated).toBe(true)
    expect(record?.mutation.findings[0]?.path).toEqual(['reports', 'notes'])
  })

  it('reports an in-place change made between dispatches at the next dispatch', async () => {
    const store = createStore4(combineReducers4({ reports: immutableReports }))
    const collector = reduxCollector(store)
    store.dispatch({ type: 'reports/RANGE_SET', range: '90d' })

    store.getState().reports.notes.push({ id: 'sneaky', text: 'pushed by a component' })
    store.dispatch({ type: 'reports/RANGE_SET', range: '7d' })

    const { records } = await actions(collector)
    expect(records.map((record) => [record.kind, record.mutation.status])).toEqual([
      ['action', 'none-detected'],
      ['mutation-outside-dispatch', 'detected'],
      ['action', 'none-detected'],
    ])
    expect(records[1]?.mutation.findings[0]).toEqual({
      path: ['reports', 'notes'],
      change: 'length-changed',
    })
  })
})

describe('coverage', () => {
  it('records a state change from a dispatch that bypassed Genie as unrecorded', async () => {
    const captured: { dispatch?: Dispatch } = {}
    const capture: Middleware = (api) => {
      captured.dispatch = api.dispatch
      return (next) => (action) => next(action)
    }
    const store = createStore4(
      combineReducers4({ reports: immutableReports }),
      applyMiddleware4(capture),
    )
    const collector = reduxCollector(store)

    captured.dispatch?.({ type: 'reports/RANGE_SET', range: '7d' })

    const result = await actions(collector)
    expect(result.records).toHaveLength(1)
    expect(result.records[0]).toMatchObject({
      kind: 'unrecorded-change',
      type: null,
      changedSlices: ['reports'],
    })
    expect(result.coverage.unrecordedChanges).toBe(1)
  })

  it('counts a nested dispatch Genie did not record inside a recorded one', async () => {
    const echo: Middleware = (api) => (next) => (action) => {
      const result = next(action)
      if ((action as { type: string }).type === 'reports/RANGE_SET') {
        api.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'e', text: 'echo' } })
      }
      return result
    }
    const store = createStore4(
      combineReducers4({ reports: immutableReports }),
      applyMiddleware4(echo),
    )
    const collector = reduxCollector(store)

    store.dispatch({ type: 'reports/RANGE_SET', range: '7d' })

    const { records } = await actions(collector)
    expect(records).toHaveLength(1)
    expect(records[0]?.unrecordedNestedDispatches).toBe(1)
  })
})

describe('redux_actions and redux_state', () => {
  it('pages forward without gaps or repeats and filters by type prefix and slice', async () => {
    const store = createStore4(combineReducers4({ session, reports: immutableReports }))
    const collector = reduxCollector(store)
    for (let index = 0; index < 7; index += 1) {
      store.dispatch({ type: 'reports/RANGE_SET', range: `${index}d` })
      store.dispatch({ type: 'session/noop' })
    }

    const latest = await actions(collector, { typePrefix: 'reports/', limit: 3 })
    const first = await actions(collector, { slice: 'reports', afterSequence: 0, limit: 4 })
    const second = await actions(collector, {
      slice: 'reports',
      afterSequence: first.nextAfterSequence,
      limit: 4,
    })

    expect(latest.records.map((record) => record.payload)).toEqual([
      undefined,
      undefined,
      undefined,
    ])
    expect(latest.matched).toBe(7)
    expect(latest.omittedBefore).toBe(4)
    expect(latest.records.map((record) => record.sequence)).toEqual([9, 11, 13])
    expect(first.more).toBe(true)
    expect(second.more).toBe(false)
    expect([...first.records, ...second.records].map((record) => record.sequence)).toEqual([
      1, 3, 5, 7, 9, 11, 13,
    ])
  })

  it('counts only matches after the cursor when reading forward', async () => {
    const store = createStore4(combineReducers4({ session, reports: immutableReports }))
    const collector = reduxCollector(store)
    for (let index = 0; index < 4; index += 1) {
      store.dispatch({ type: 'reports/RANGE_SET', range: `${index}d` })
      store.dispatch({ type: 'session/noop' })
    }

    const page = await actions(collector, { typePrefix: 'reports/', afterSequence: 4, limit: 1 })

    expect(page.records.map((record) => record.sequence)).toEqual([5])
    expect(page.matched).toBe(2)
    expect(page.omittedBefore).toBe(0)
    expect(page.more).toBe(true)
  })

  it('keeps the payload as dispatched even when the app later mutates the action object', async () => {
    const store = createStore4(combineReducers4({ reports: immutableReports }))
    const collector = reduxCollector(store)
    const action = { type: 'reports/RANGE_SET', range: '7d' }
    store.dispatch(action)

    action.range = '90d'

    const { records } = await actions(collector, { view: 'full' })
    expect(records[0]?.payload).toEqual({ type: 'reports/RANGE_SET', range: '7d' })
  })

  it('reads a state path and selects an entity by field without returning the whole container', async () => {
    const store = createStore4(combineReducers4({ reports: immutableReports }))
    const collector = reduxCollector(store)
    store.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'note-1', text: 'first' } })
    store.dispatch({ type: 'reports/NOTE_ADDED', note: { id: 'note-2', text: 'second' } })

    const notes = await call<{ found: boolean; value: unknown; asOfSequence: number }>(
      collector,
      'redux_state',
      { path: ['reports', 'notes'] },
    )
    const selected = await call<{
      value?: unknown
      selection: { matchCount: number; matches: { path: unknown[]; value: unknown }[] }
    }>(collector, 'redux_state', {
      path: ['reports', 'notes'],
      where: { field: 'id', equals: 'note-2' },
    })
    const missing = await call<{ found: boolean; topLevelKeys: string[] }>(
      collector,
      'redux_state',
      {
        path: ['report'],
      },
    )

    expect(notes).toMatchObject({ found: true, asOfSequence: 2 })
    expect(notes.value).toEqual([
      { id: 'note-1', text: 'first' },
      { id: 'note-2', text: 'second' },
    ])
    expect(selected.value).toBeUndefined()
    expect(selected.selection.matches).toEqual([
      { path: ['reports', 'notes', 1], value: { id: 'note-2', text: 'second' } },
    ])
    expect(missing).toMatchObject({ found: false, topLevelKeys: ['reports'] })
  })

  it('asks for a storeId when several stores are collected and reads the one named', async () => {
    const first = createStore4(combineReducers4({ reports: immutableReports }))
    const second = createStore5(combineReducers5({ session }))
    const collector = reduxCollector(first, { name: 'main' })
    reduxCollector(second, { name: 'auth' })
    second.dispatch({ type: 'session/refresh' })

    await expect(actions(collector)).rejects.toThrow(/pass storeId/)
    const storeId = (reduxStoreTaps().find((tap) => tap.store === second) as { storeId: string })
      .storeId
    const auth = await actions(collector, { storeId })
    expect(auth.store.name).toBe('auth')
    expect(auth.records.map((record) => record.type)).toEqual(['session/refresh'])
  })
})
