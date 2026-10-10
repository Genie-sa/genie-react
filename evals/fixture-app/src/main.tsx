import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Genie } from 'genie-react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles.css'

const queryClient = new QueryClient()
const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      {import.meta.env.DEV && <Genie />}
    </QueryClientProvider>
  </StrictMode>,
)
