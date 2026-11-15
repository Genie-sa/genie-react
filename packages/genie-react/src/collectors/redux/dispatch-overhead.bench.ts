import { configureStore, createSlice } from '@reduxjs/toolkit'
import { bench, describe } from 'vitest'
import { reduxCollector } from './index'

function legacyShapedStore() {
  const issues = Object.fromEntries(
    Array.from({ length: 3_240 }, (_, index) => [
      `CORE-${index}`,
      {
        key: `CORE-${index}`,
        title: `Issue ${index}`,
        status: index % 3 === 0 ? 'open' : 'done',
        assignee: { id: index % 40, name: `User ${index % 40}` },
        labels: ['bug', 'p2'],
        estimate: index % 8,
      },
    ]),
  )
  const ui = createSlice({
    name: 'ui',
    initialState: { filter: '', sidebar: true },
    reducers: {
      filterChanged(state, action: { payload: string }) {
        state.filter = action.payload
      },
    },
  })
  const store = configureStore({
    reducer: {
      issues: (state = { byKey: issues, order: Object.keys(issues) }) => state,
      ui: ui.reducer,
      projects: (state = { byKey: { CORE: { key: 'CORE' }, WEB: { key: 'WEB' } } }) => state,
    },
    middleware: (getDefault) => getDefault({ immutableCheck: false, serializableCheck: false }),
  })
  return { store, filterChanged: ui.actions.filterChanged }
}

describe('dispatch on a 3,240-issue store', () => {
  const plain = legacyShapedStore()
  const recorded = legacyShapedStore()
  reduxCollector(recorded.store)
  let index = 0

  bench('without Genie: state-changing action', () => {
    plain.store.dispatch(plain.filterChanged(`q${index++}`))
  })
  bench('with Genie: state-changing action', () => {
    recorded.store.dispatch(recorded.filterChanged(`q${index++}`))
  })
  bench('without Genie: action nothing handles', () => {
    plain.store.dispatch({ type: 'service/executeQuery/rejected' })
  })
  bench('with Genie: action nothing handles', () => {
    recorded.store.dispatch({ type: 'service/executeQuery/rejected' })
  })
})
