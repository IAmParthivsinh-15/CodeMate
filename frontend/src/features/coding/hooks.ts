import { useQuery } from '@tanstack/react-query'
import type { BadgeTone } from '../../components/ui/Badge'
import { codingApi } from './api'

export function useLanguages() {
  return useQuery({ queryKey: ['coding', 'languages'], queryFn: codingApi.languages, staleTime: 5 * 60_000 })
}

export const difficultyTone = (d: string): BadgeTone =>
  d === 'beginner' ? 'success' : d === 'intermediate' ? 'info' : d === 'advanced' ? 'warning' : 'danger'
