import { createGenieClient, reactCollector, sessionCollector } from 'genie-react/client'
import { memoryCollector, perfCollector, timelineCollector } from 'genie-react/collectors'
import { reduxCollector } from 'genie-react/collectors/redux'
import { store } from '../store'
import { registerAppTools } from './app-tools'

createGenieClient({
  url: process.env.GENIE_HUB_URL,
  collectors: [
    sessionCollector(),
    reactCollector(),
    memoryCollector(),
    perfCollector(),
    timelineCollector(),
    reduxCollector(store, { name: 'app' }),
  ],
}).start()

registerAppTools()
