import { router } from 'expo-router'
import { Button, Text, View } from 'react-native'

export default function NavigationHome() {
  return (
    <View style={{ padding: 24, gap: 16 }}>
      <Text testID="navigation-home">Navigation home</Text>
      <Button title="Open details" onPress={() => router.push('/details')} />
    </View>
  )
}
