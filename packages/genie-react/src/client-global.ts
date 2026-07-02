import { createGenieClient, sessionCollector } from './client'
import { deriveHubWsUrl } from './client/hub-url'
import { memoryCollector } from './collectors/memory'
import { reactCollector } from './collectors/react'
import './collectors/react/hook'
import { GENIE_DEFAULT_HUB_PORT, readGenieGlobal } from './protocol'

// Self-starting script-tag build served by the hub: any React setup attaches with one <script src>, no bundler integration.
if (typeof window !== 'undefined' && !readGenieGlobal()) {
  const script = document.currentScript
  const src = script instanceof HTMLScriptElement && script.src ? script.src : undefined
  createGenieClient({
    url: deriveHubWsUrl(src, GENIE_DEFAULT_HUB_PORT),
    collectors: [sessionCollector(), reactCollector(), memoryCollector()],
  }).start()
}
