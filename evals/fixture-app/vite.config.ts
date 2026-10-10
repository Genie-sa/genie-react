import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { genie } from 'genie-react/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  cacheDir: fileURLToPath(new URL('./.vite', import.meta.url)),
  plugins: [genie(), react()],
})
