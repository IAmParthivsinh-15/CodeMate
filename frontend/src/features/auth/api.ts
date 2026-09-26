import { api, isApiError, request } from '../../services/apiClient'
import type { AuthResponse, User } from '../../types/api'

export interface RegisterInput {
  username: string
  email: string
  password: string
  confirmPassword: string
}

export const authApi = {
  login: (email: string, password: string) => api.post<AuthResponse>('/api/auth/login', { email, password }),
  register: (input: RegisterInput) => api.post<AuthResponse>('/api/auth/register', input),
  logout: () => api.post<{ message: string }>('/api/auth/logout', {}),
  /** Current user, or null when not signed in (401 after the refresh attempt). */
  async me(): Promise<User | null> {
    try {
      const res = await request<{ user: User }>('/api/auth/me')
      return res.user
    } catch (e) {
      if (isApiError(e) && e.status === 401) return null
      throw e
    }
  },
}
