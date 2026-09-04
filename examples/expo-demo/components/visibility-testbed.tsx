import { Activity, useState } from 'react'
import { Freeze } from 'react-freeze'
import { Pressable, Text, View } from 'react-native'

export function VisibilityProbe() {
  const [count, setCount] = useState(0)
  return (
    <View>
      <Text testID="visibility-probe-value">Preserved count: {count}</Text>
      <Pressable
        accessibilityRole="button"
        testID="visibility-increment"
        onPress={() => setCount((value) => value + 1)}
      >
        <Text>Increment probe</Text>
      </Pressable>
    </View>
  )
}

export function VisibilityTestbed() {
  const [mode, setMode] = useState<'visible' | 'hidden' | 'frozen' | 'unmounted'>('visible')
  return (
    <View style={{ gap: 12, padding: 16, backgroundColor: '#fffefa' }}>
      <Text>Lifecycle visibility test</Text>
      <Text testID="visibility-mode">Mode: {mode}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {(
          [
            ['Freeze', 'frozen'],
            ['Thaw', 'visible'],
            ['Hide', 'hidden'],
            ['Unmount', 'unmounted'],
          ] as const
        ).map(([label, value]) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            testID={`visibility-${label.toLowerCase()}`}
            onPress={() => setMode(value)}
          >
            <Text>{label}</Text>
          </Pressable>
        ))}
      </View>
      {mode !== 'unmounted' && (
        <Activity mode={mode === 'hidden' ? 'hidden' : 'visible'}>
          <Freeze freeze={mode === 'frozen'}>
            <VisibilityProbe />
          </Freeze>
        </Activity>
      )}
    </View>
  )
}
