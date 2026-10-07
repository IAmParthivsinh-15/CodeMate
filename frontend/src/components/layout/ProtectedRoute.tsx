import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../features/auth/authContext'
import { ErrorState } from '../ui/ErrorState'
import { PageSpinner } from '../ui/Spinner'

export interface FromState {
  from?: { pathname: string; search?: string; hash?: string }
}

/** Renders children only for signed-in users; otherwise redirects to /login, remembering where they were going. */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, error, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <PageSpinner />
  if (status === 'error') return <ErrorState title="Couldn't check your session" error={error} onRetry={retry} />
  if (status === 'anonymous') {
    const state: FromState = { from: { pathname: location.pathname, search: location.search, hash: location.hash } }
    return <Navigate to="/login" replace state={state} />
  }
  return <>{children}</>
}

/** For /login and /register: signed-in users go straight to where they were heading. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <PageSpinner />
  if (status === 'authenticated') {
    const from = (location.state as FromState | null)?.from
    const to = from ? `${from.pathname}${from.search ?? ''}${from.hash ?? ''}` : '/dashboard'
    return <Navigate to={to} replace />
  }
  return <>{children}</>
}
