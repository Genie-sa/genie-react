import { useMutation, useQuery } from '@tanstack/react-query'
import type { AnyRouter } from '@tanstack/react-router'
import {
  Component,
  createContext,
  type ErrorInfo,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import {
  type AuditQueryData,
  auditQueryData,
  auditQueryKey,
  queryClient,
  router,
} from '../lib/runtime'

const AuditContext = createContext({ label: 'context-default' })

function AuditButton({
  label,
  onPress,
  testID,
}: {
  label: string
  onPress: () => void
  testID: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      testID={testID}
    >
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  )
}

function PropFixture({ message }: { message: string }) {
  return (
    <Text selectable style={styles.value} testID="fixture-prop-value">
      {message}
    </Text>
  )
}

function HookFixture() {
  const [count, setCount] = useState(10)
  const [reducerCount, dispatch] = useReducer((value: number) => value + 1, 20)
  const memoizedTotal = useMemo(() => count + reducerCount, [count, reducerCount])
  const renderCount = useRef(0)
  renderCount.current += 1
  const increment = useCallback(() => setCount((value) => value + 1), [])

  return (
    <View style={styles.fixture}>
      <Text selectable style={styles.value} testID="fixture-hook-value">
        state:{count} reducer:{reducerCount} total:{memoizedTotal} renders:{renderCount.current}
      </Text>
      <View style={styles.buttonRow}>
        <AuditButton label="State +1" onPress={increment} testID="fixture-state-button" />
        <AuditButton label="Reducer +1" onPress={dispatch} testID="fixture-reducer-button" />
      </View>
    </View>
  )
}

function ContextFixture() {
  const value = useContext(AuditContext)
  return (
    <Text selectable style={styles.value} testID="fixture-context-value">
      {value.label}
    </Text>
  )
}

function SuspenseFixture() {
  return (
    <Suspense
      fallback={
        <Text selectable style={styles.warning} testID="fixture-suspense-fallback">
          suspense-fallback
        </Text>
      }
    >
      <Text selectable style={styles.value} testID="fixture-suspense-content">
        suspense-content
      </Text>
    </Suspense>
  )
}

class AuditErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(_error: Error, _info: ErrorInfo) {}

  render() {
    if (this.state.error) {
      return (
        <Text selectable style={styles.warning} testID="fixture-error-fallback">
          error-fallback:{this.state.error.message}
        </Text>
      )
    }
    return this.props.children
  }
}

function ErrorFixture() {
  return (
    <Text selectable style={styles.value} testID="fixture-error-content">
      error-content
    </Text>
  )
}

function EffectFixture() {
  const [dependency, setDependency] = useState(0)
  const [passiveRuns, setPassiveRuns] = useState(0)
  const [layoutRuns, setLayoutRuns] = useState(0)

  useLayoutEffect(() => {
    setLayoutRuns(dependency + 1)
  }, [dependency])

  useEffect(() => {
    setPassiveRuns(dependency + 1)
  }, [dependency])

  return (
    <View style={styles.fixture}>
      <Text selectable style={styles.value} testID="fixture-effect-value">
        dependency:{dependency} passive:{passiveRuns} layout:{layoutRuns}
      </Text>
      <AuditButton
        label="Run effects"
        onPress={() => setDependency((value) => value + 1)}
        testID="fixture-effect-button"
      />
    </View>
  )
}

function SlowRenderer({ revision }: { revision: number }) {
  const startedAt = performance.now()
  while (performance.now() - startedAt < 8) {
    // A short deterministic render cost gives the profiler an observable sample.
  }
  return (
    <Text selectable style={styles.value} testID="fixture-slow-value">
      slow-render:{revision}
    </Text>
  )
}

function useRouterPathname(auditRouter: AnyRouter) {
  return useSyncExternalStore(
    (onStoreChange) => auditRouter.subscribe('onResolved', onStoreChange),
    () => auditRouter.state.location.pathname,
    () => auditRouter.state.location.pathname,
  )
}

function QueryFixture() {
  const query = useQuery<AuditQueryData>({ queryKey: auditQueryKey })
  const mutation = useMutation({
    mutationKey: ['expo-tool-audit-mutation'],
    mutationFn: async (label: string): Promise<AuditQueryData> => ({ label, revision: 2 }),
    onSuccess: (data) => queryClient.setQueryData(auditQueryKey, data),
  })

  const restoreQuery = () => {
    queryClient.setQueryData(auditQueryKey, auditQueryData)
  }

  return (
    <View style={styles.fixture}>
      <Text selectable style={styles.value} testID="fixture-query-value">
        query:{query.status}:{query.data?.label ?? 'none'}:{query.data?.revision ?? 0}
      </Text>
      <Text selectable style={styles.value} testID="fixture-mutation-value">
        mutation:{mutation.status}:{mutation.data?.label ?? 'none'}
      </Text>
      <View style={styles.buttonRow}>
        <AuditButton
          label="Mutate"
          onPress={() => mutation.mutate('mutation-value')}
          testID="fixture-mutation-button"
        />
        <AuditButton label="Restore query" onPress={restoreQuery} testID="fixture-query-restore" />
      </View>
    </View>
  )
}

function RouterFixture() {
  const pathname = useRouterPathname(router)
  return (
    <View style={styles.fixture}>
      <Text selectable style={styles.value} testID="fixture-router-value">
        pathname:{pathname}
      </Text>
      <View style={styles.buttonRow}>
        <AuditButton
          label="Home"
          onPress={() => void router.navigate({ to: '/' })}
          testID="fixture-router-home"
        />
        <AuditButton
          label="Details"
          onPress={() => void router.navigate({ to: '/details' })}
          testID="fixture-router-details"
        />
      </View>
    </View>
  )
}

export function ToolTestbed() {
  const [slowRevision, setSlowRevision] = useState(0)
  const [boundaryKey, setBoundaryKey] = useState(0)

  return (
    <View style={styles.card} testID="tool-testbed">
      <Text selectable style={styles.eyebrow}>
        EXHAUSTIVE TOOL FIXTURES
      </Text>
      <Text selectable style={styles.description}>
        Deterministic targets for React, Query, Router, profiler, effect, and override tools.
      </Text>

      <View style={styles.section}>
        <Text style={styles.heading}>Props, hooks, and context</Text>
        <PropFixture message="prop-original" />
        <HookFixture />
        <AuditContext.Provider value={{ label: 'context-original' }}>
          <ContextFixture />
        </AuditContext.Provider>
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Suspense and error boundary</Text>
        <SuspenseFixture />
        <AuditErrorBoundary key={boundaryKey}>
          <ErrorFixture />
        </AuditErrorBoundary>
        <AuditButton
          label="Reset boundary"
          onPress={() => setBoundaryKey((value) => value + 1)}
          testID="fixture-error-reset"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>Effects and profiler</Text>
        <EffectFixture />
        <SlowRenderer revision={slowRevision} />
        <AuditButton
          label="Render slow fixture"
          onPress={() => setSlowRevision((value) => value + 1)}
          testID="fixture-slow-button"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>TanStack Query</Text>
        <QueryFixture />
      </View>

      <View style={styles.section}>
        <Text style={styles.heading}>TanStack Router</Text>
        <RouterFixture />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    gap: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: '#d5d2c8',
    borderRadius: 24,
    backgroundColor: '#fffefa',
  },
  eyebrow: {
    color: '#646158',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  description: {
    color: '#555249',
    fontSize: 16,
    lineHeight: 23,
  },
  section: {
    gap: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#d5d2c8',
  },
  heading: {
    color: '#171714',
    fontSize: 18,
    fontWeight: '700',
  },
  fixture: { gap: 10 },
  value: {
    color: '#24231f',
    fontSize: 14,
    fontFamily: 'Courier',
  },
  warning: {
    color: '#9f2f24',
    fontSize: 14,
    fontFamily: 'Courier',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#171714',
  },
  buttonPressed: { opacity: 0.72 },
  buttonText: { color: '#fffefa', fontSize: 14, fontWeight: '700' },
})
