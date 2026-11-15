import { createGenieClient, reactCollector, sessionCollector } from 'genie-react/client'
import { memoryCollector, perfCollector, timelineCollector } from 'genie-react/collectors'
import { registerAppTools } from './app-tools'

createGenieClient({
  url: process.env.GENIE_HUB_URL,
  collectors: [
    sessionCollector(),
    reactCollector(),
    memoryCollector(),
    perfCollector(),
    timelineCollector(),
  ],
}).start()

registerAppTools()
