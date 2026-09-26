import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { setUnauthorizedHandler, tokenStore } from '../../services/apiClient'
import type { User } from '../../types/api'
import { authApi, type RegisterInput } from './api'
import { AuthContext, ME_QUERY_KEY, type AuthContextValue, type AuthStatus } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ME_QUERY_KEY,
    queryFn: authApi.me,
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  })

  // A request that stays 401 after refreshing means the session is over.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      tokenStore.set(null)
      if (qc.getQueryData(ME_QUERY_KEY)) qc.setQueryData(ME_QUERY_KEY, null)
    })
    return () => setUnauthorizedHandler(null)
  }, [qc])

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login(email, password)
      tokenStore.set(res.token)
      qc.setQueryData<User | null>(ME_QUERY_KEY, res.user)
      return res.user
    },
    [qc],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const res = await authApi.register(input)
      tokenStore.set(res.token)
      qc.setQueryData<User | null>(ME_QUERY_KEY, res.user)
      return res.user
    },
    [qc],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // Logging out locally is what matters.
    }
    tokenStore.set(null)
    qc.removeQueries({ predicate: (q) => q.queryKey[0] !== ME_QUERY_KEY[0] })
    qc.setQueryData(ME_QUERY_KEY, null)
  }, [qc])

  const refreshUser = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
  }, [qc])

  const user = me.data ?? null
  const status: AuthStatus = me.isPending ? 'loading' : user ? 'authenticated' : me.isError ? 'error' : 'anonymous'

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, error: me.error, login, register, logout, refreshUser, retry: () => void me.refetch() }),
    [user, status, me, login, register, logout, refreshUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
