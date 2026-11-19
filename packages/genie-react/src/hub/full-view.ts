import type { ToolDescriptor } from '../protocol'
import { numberField, recordOf } from './wire-guards'

/** Requests `view:"full"` only from apps that advertise it: older apps reject the unknown key and already return the full shape. */
export function withFullView(
  tools: readonly ToolDescriptor[],
  tool: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const properties = inputProperties(tools, tool)
  return properties && 'view' in properties ? { ...args, view: 'full' } : args
}

/** The largest value the app accepts for a numeric input, or null when it advertises none; an older app may accept less than this hub asks for. */
export function advertisedMaximum(
  tools: readonly ToolDescriptor[],
  tool: string,
  input: string,
): number | null {
  return numberField(recordOf(inputProperties(tools, tool)?.[input]), 'maximum')
}

function inputProperties(
  tools: readonly ToolDescriptor[],
  tool: string,
): Record<string, unknown> | null {
  const schema = recordOf(tools.find((descriptor) => descriptor.name === tool)?.inputJsonSchema)
  return recordOf(schema?.properties)
}
