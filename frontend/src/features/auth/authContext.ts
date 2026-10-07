import { createContext, useContext } from 'react'
import type { User } from '../../types/api'
import type { RegisterInput } from './api'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'error'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  error: unknown
  login: (email: string, password: string) => Promise<User>
  register: (input: RegisterInput) => Promise<User>
  logout: () => Promise<void>
  /** Re-fetch /api/auth/me (e.g. after hint credits change). */
  refreshUser: () => Promise<void>
  retry: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export const ME_QUERY_KEY = ['auth', 'me'] as const

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}

/** The signed-in user. Only use below a ProtectedRoute. */
export function useUser(): User {
  const { user } = useAuth()
  if (!user) throw new Error('useUser called without a signed-in user')
  return user
}
