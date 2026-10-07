import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '../services/apiClient'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Don't retry client errors (404, 401, validation); retry flaky network/5xx once.
        retry: (count, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) return false
          return count < 1
        },
      },
      mutations: { retry: false },
    },
  })
}
