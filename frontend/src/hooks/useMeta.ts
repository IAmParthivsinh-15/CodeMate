import { useQuery } from '@tanstack/react-query'
import { api } from '../services/apiClient'
import type { AiStatus, MetaResponse } from '../types/api'

/** Difficulties (with Elo) and time controls. Public and effectively static. */
export function useMeta() {
  return useQuery({
    queryKey: ['meta'],
    queryFn: () => api.get<MetaResponse>('/api/meta'),
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

/** Which LLM provider is active ("none" = engine-facts mode). */
export function useAiStatus() {
  return useQuery({
    queryKey: ['ai', 'status'],
    queryFn: () => api.get<AiStatus>('/api/ai/status'),
    staleTime: 5 * 60_000,
  })
}
