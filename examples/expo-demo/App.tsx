import { QueryClientProvider } from '@tanstack/react-query'
import { StatusBar } from 'expo-status-bar'
import { Genie } from 'genie-react/native'
import { useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { ToolTestbed } from './components/tool-testbed'
import { queryClient, router } from './lib/runtime'

const defaultHubHost = process.env.EXPO_OS === 'android' ? '10.0.2.2' : '127.0.0.1'
const genieUrl = process.env.EXPO_PUBLIC_GENIE_URL ?? `ws://${defaultHubHost}:4390/__genie/ws`
const geniePlugins = ['expo-audit']

export default function App() {
  const [count, setCount] = useState(0)

  return (
    <QueryClientProvider client={queryClient}>
      {__DEV__ && (
        <Genie
          appName="Expo demo"
          plugins={geniePlugins}
          queryClient={queryClient}
          router={router}
          url={genieUrl}
        />
      )}
      <ScrollView
        contentContainerStyle={styles.container}
        contentInsetAdjustmentBehavior="automatic"
      >
        <View style={styles.card}>
          <Text selectable style={styles.eyebrow}>
            GENIE REACT / EXPO
          </Text>
          <Text selectable style={styles.title}>
            Native integration demo
          </Text>
          <Text selectable style={styles.description}>
            This screen exercises the React Native entry point, Metro bundling, and live render
            inspection through the local Genie hub.
          </Text>

          <View style={styles.connection}>
            <Text selectable style={styles.label}>
              Hub URL
            </Text>
            <Text selectable style={styles.url} testID="genie-hub-url">
              {genieUrl}
            </Text>
          </View>

          <View style={styles.counter}>
            <Text selectable style={styles.label}>
              Counter
            </Text>
            <Text selectable style={styles.count} testID="counter-value">
              {count}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCount((value) => value + 1)}
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              testID="increment-button"
            >
              <Text style={styles.buttonText}>Increment</Text>
            </Pressable>
          </View>
        </View>
        <ToolTestbed />
      </ScrollView>
      <StatusBar style="dark" />
    </QueryClientProvider>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    gap: 20,
    padding: 24,
    backgroundColor: '#f2f1ec',
  },
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
  title: {
    color: '#171714',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -1,
  },
  description: {
    color: '#555249',
    fontSize: 17,
    lineHeight: 25,
  },
  connection: {
    gap: 6,
    padding: 16,
    borderRadius: 16,
    backgroundColor: '#e9e7df',
  },
  label: {
    color: '#646158',
    fontSize: 13,
    fontWeight: '600',
  },
  url: {
    color: '#24231f',
    fontSize: 14,
    fontFamily: 'Courier',
  },
  counter: {
    gap: 12,
    alignItems: 'flex-start',
  },
  count: {
    color: '#171714',
    fontSize: 44,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  button: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 20,
    borderRadius: 14,
    backgroundColor: '#171714',
  },
  buttonPressed: {
    opacity: 0.72,
  },
  buttonText: {
    color: '#fffefa',
    fontSize: 16,
    fontWeight: '700',
  },
})
