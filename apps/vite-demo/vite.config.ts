import { genie } from 'genie-react/vite'
import stylex from '@stylexjs/unplugin'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    genie(),
    stylex.vite({
      dev: mode === 'development',
      debug: mode === 'development',
      enableDebugClassNames: true,
      useCSSLayers: true,
    }),
    react(),
  ],
}))
