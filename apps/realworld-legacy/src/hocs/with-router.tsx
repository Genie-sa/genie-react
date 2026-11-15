import type { ComponentType } from 'react'
import {
  type Location,
  type NavigateFunction,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'

export interface RouterProps {
  router: {
    location: Location
    navigate: NavigateFunction
    params: Readonly<Record<string, string | undefined>>
  }
}

export function withRouter<P extends RouterProps>(Wrapped: ComponentType<P>) {
  function WithRouter(props: Omit<P, keyof RouterProps>) {
    const location = useLocation()
    const navigate = useNavigate()
    const params = useParams()
    return <Wrapped {...(props as P)} router={{ location, navigate, params }} />
  }
  WithRouter.displayName = `withRouter(${Wrapped.displayName ?? Wrapped.name})`
  return WithRouter
}
