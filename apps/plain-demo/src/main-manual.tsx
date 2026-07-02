import 'genie-react/hook'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createGenieClient, reactCollector, sessionCollector } from 'genie-react/client'
import { memoryCollector, queryCollector } from 'genie-react/collectors'
import { App } from './lab'

const HUB_WS_URL = 'ws://localhost:4390/__genie/ws'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
})

createGenieClient({
  url: HUB_WS_URL,
  collectors: [
    sessionCollector(),
    reactCollector(),
    memoryCollector(),
    queryCollector(queryClient),
  ],
}).start()

const rootElement = document.getElementById('root')
if (rootElement) {
  createRoot(rootElement).render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}
