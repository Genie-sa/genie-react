import type { ToolDescriptor } from '../protocol'
import { recordOf } from './wire-guards'

/** Requests `view:"full"` only from apps that advertise it: older apps reject the unknown key and already return the full shape. */
export function withFullView(
  tools: readonly ToolDescriptor[],
  tool: string,
  args: Record<string, unknown>,
): Record<string, unknown> {
  const schema = recordOf(tools.find((descriptor) => descriptor.name === tool)?.inputJsonSchema)
  const properties = recordOf(schema?.properties)
  return properties && 'view' in properties ? { ...args, view: 'full' } : args
}
