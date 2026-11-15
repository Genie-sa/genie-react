export async function register(): Promise<void> {
  if (process.env.NODE_ENV !== 'production' && process.env.NEXT_RUNTIME === 'nodejs') {
    const { registerGenie } = await import('genie-react/next')
    await registerGenie()
  }
}
