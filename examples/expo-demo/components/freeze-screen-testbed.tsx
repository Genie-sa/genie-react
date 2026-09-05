import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { enableFreeze, Screen, ScreenContainer } from 'react-native-screens'

enableFreeze(true)

export function FrozenScreenProbe() {
  const [count, setCount] = useState(0)
  return (
    <Pressable testID="screen-increment" onPress={() => setCount((value) => value + 1)}>
      <Text>Screen count: {count}</Text>
    </Pressable>
  )
}

export function FreezeScreenTestbed() {
  const [mode, setMode] = useState<'active' | 'covered' | 'removed'>('active')
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text testID="screen-mode">Native screen: {mode}</Text>
      <View style={{ flexDirection: 'row', gap: 20 }}>
        {(['active', 'covered', 'removed'] as const).map((value) => (
          <Pressable key={value} testID={`screen-${value}`} onPress={() => setMode(value)}>
            <Text>{value}</Text>
          </Pressable>
        ))}
      </View>
      <ScreenContainer style={{ height: 100 }}>
        {mode !== 'removed' && (
          <Screen key="retained" activityState={mode === 'covered' ? 0 : 2}>
            <FrozenScreenProbe />
          </Screen>
        )}
        {mode === 'covered' && (
          <Screen key="cover" activityState={2}>
            <Text>Covering screen</Text>
          </Screen>
        )}
      </ScreenContainer>
    </View>
  )
}
