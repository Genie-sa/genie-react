import { memo } from 'react'
import { Text } from 'react-native'

export const MemoNameRow = memo(({ value }: { value: number }) => (
  <Text testID="memo-name-row">Memo row: {value}</Text>
))

export const NamedMemoRow = memo(function InnerNamedRow({ value }: { value: number }) {
  return <Text testID="named-memo-row">Named row: {value}</Text>
})

export const ExplicitMemoRow = memo(({ value }: { value: number }) => (
  <Text testID="explicit-memo-row">Explicit row: {value}</Text>
))
ExplicitMemoRow.displayName = 'CustomMemoRow'
