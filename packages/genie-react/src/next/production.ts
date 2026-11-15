// Resolved through the `production` export condition of genie-react/next and genie-react/script, so a production server build carries neither the hub nor the protocol behind them.
import type { GenieScriptProps } from '../script'
import type { RegisterGenieOptions } from './register'

export function GenieScript(_props: GenieScriptProps = {}): null {
  return null
}

export async function registerGenie(_options: RegisterGenieOptions = {}): Promise<void> {}

export async function stopGenieHub(): Promise<void> {}
