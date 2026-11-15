import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { genie } from 'genie-react/vite'
import { defineConfig } from 'vite'
import { mockApi } from './mock-api/plugin.ts'

const DEFAULT_PORT = 5480

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./.vite', import.meta.url)),
  server: {
    host: '127.0.0.1',
    port: Number(process.env.DASHBOARD_PORT ?? DEFAULT_PORT),
    strictPort: true,
    watch: { ignored: ['**/.variants/**'] },
  },
  preview: {
    host: '127.0.0.1',
    port: Number(process.env.DASHBOARD_PORT ?? DEFAULT_PORT),
    strictPort: true,
  },
  plugins: [
    genie({ appName: 'Meridian Ops' }),
    mockApi(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
})
