import { registerRootComponent } from 'expo'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'

function LateHookProbe() {
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)
  useEffect(() => {
    const { startGenie } = require('genie-react/native') as typeof import('genie-react/native')
    startGenie({
      url: process.env.EXPO_PUBLIC_GENIE_URL ?? 'ws://127.0.0.1:4390/__genie/ws',
      appName: 'Late Hook Expo',
    })
    setReady(true)
  }, [])
  return (
    <View style={{ padding: 80 }}>
      <Text>Late hook ready: {String(ready)}</Text>
      <Text testID="late-count">Count: {count}</Text>
      <Pressable
        accessibilityRole="button"
        testID="late-increment"
        onPress={() => setCount((value) => value + 1)}
      >
        <Text>Increment late probe</Text>
      </Pressable>
    </View>
  )
}
registerRootComponent(LateHookProbe)
