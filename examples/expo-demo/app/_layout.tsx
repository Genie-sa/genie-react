import { type Href, router, Stack, useNavigationContainerRef } from 'expo-router'
import { registerGenieTools } from 'genie-react'
import { Genie } from 'genie-react/native'
import { createNavigationTools, type NavigationState } from 'genie-react/navigation'
import { useEffect, useRef } from 'react'

export default function NavigationLayout() {
  const navigation = useNavigationContainerRef()
  const controller = useRef<ReturnType<typeof createNavigationTools> | null>(null)
  useEffect(() => {
    const integration = createNavigationTools({
      getState: () => navigation.getRootState(),
      isCurrentHref: (href) => {
        let state: NavigationState | undefined = navigation.getRootState()
        let name: string | undefined
        for (let depth = 0; state && depth < 50; depth += 1) {
          const route: NavigationState['routes'][number] | undefined =
            state.routes[state.index ?? 0]
          name = route?.name
          state = route?.state
        }
        return (href === '/' && name === 'index') || (href === '/details' && name === 'details')
      },
      router: {
        push: (href) => router.push(href as Href),
        replace: (href) => router.replace(href as Href),
        navigate: (href) => router.navigate(href as Href),
        dismissTo: (href) => router.dismissTo(href as Href),
        back: () => router.back(),
        canGoBack: () => router.canGoBack(),
      },
    })
    controller.current = integration
    const unregister = registerGenieTools(...integration.tools)
    return () => {
      unregister()
      integration.dispose()
      controller.current = null
    }
  }, [navigation])
  return (
    <>
      {__DEV__ && (
        <Genie
          appName="Expo navigation fixture"
          url={process.env.EXPO_PUBLIC_GENIE_URL ?? 'ws://127.0.0.1:4390/__genie/ws'}
        />
      )}
      <Stack
        screenListeners={{
          state: () => controller.current?.screenListeners.state(),
          transitionStart: (event) => controller.current?.screenListeners.transitionStart(event),
          transitionEnd: (event) => controller.current?.screenListeners.transitionEnd(event),
        }}
        screenOptions={{ animation: 'slide_from_right' }}
      />
    </>
  )
}
