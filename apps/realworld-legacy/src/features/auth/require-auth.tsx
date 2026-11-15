import { type ReactNode, useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { Spinner } from '../../components/spinner'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { restoreSession } from '../../store/session'

export function RequireAuth({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch()
  const location = useLocation()
  const status = useAppSelector((state) => state.session.status)

  useEffect(() => {
    if (status === 'unknown') dispatch(restoreSession())
  }, [dispatch, status])

  if (status === 'signed-out') {
    return (
      <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />
    )
  }
  if (status !== 'signed-in') return <Spinner label="Restoring your session" />
  return <>{children}</>
}
