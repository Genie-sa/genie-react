import { router } from 'expo-router'
import { useState } from 'react'
import { Button, Text, View } from 'react-native'

export default function NavigationDetails() {
  const [count, setCount] = useState(0)
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text testID="navigation-details">Details count: {count}</Text>
      <Button title="Increment details" onPress={() => setCount((value) => value + 1)} />
      <Button title="Push another details" onPress={() => router.push('/details')} />
      <Button title="Back" onPress={() => router.back()} />
    </View>
  )
}
