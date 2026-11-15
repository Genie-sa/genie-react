declare module '*.css'

declare const process: {
  env: {
    NODE_ENV: 'development' | 'production'
    GENIE_HUB_URL: string
  }
}
