import { createContext, type ReactNode, useContext } from 'react'

export interface FeatureFlagsValue {
  flags: Record<string, boolean>
  isEnabled: (name: string) => boolean
}

const FeatureFlagsContext = createContext<FeatureFlagsValue>({ flags: {}, isEnabled: () => false })

interface FeatureFlagsProviderProps {
  flags: Record<string, boolean>
  children: ReactNode
}

export function FeatureFlagsProvider({ flags, children }: FeatureFlagsProviderProps) {
  const value = { flags, isEnabled: (name: string) => flags[name] === true }
  return <FeatureFlagsContext.Provider value={value}>{children}</FeatureFlagsContext.Provider>
}

export function useFeatureFlags(): FeatureFlagsValue {
  return useContext(FeatureFlagsContext)
}

interface FeatureGateProps {
  flag: string
  children: ReactNode
  fallback?: ReactNode
}

export function FeatureGate({ flag, children, fallback = null }: FeatureGateProps) {
  const { isEnabled } = useFeatureFlags()
  return <>{isEnabled(flag) ? children : fallback}</>
}
