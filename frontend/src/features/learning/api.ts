import { api } from '../../services/apiClient'
import type { Paginated, Puzzle, PuzzleAttemptResponse } from '../../types/api'

export interface PuzzleQuery {
  page?: number
  limit?: number
  solved?: 'true' | 'false'
  theme?: string
}

export const puzzlesApi = {
  list: (q: PuzzleQuery) => api.get<Paginated<Puzzle>>('/api/puzzles', { ...q }),
  next: (theme?: string) => api.get<{ puzzle: Puzzle | null }>('/api/puzzles/next', { theme }).then((r) => r.puzzle),
  get: (id: string) => api.get<{ puzzle: Puzzle }>(`/api/puzzles/${id}`).then((r) => r.puzzle),
  attempt: (id: string, uci: string) => api.post<PuzzleAttemptResponse>(`/api/puzzles/${id}/attempt`, { move: { uci } }),
  reveal: (id: string) => api.post<{ puzzle: Puzzle }>(`/api/puzzles/${id}/reveal`).then((r) => r.puzzle),
}

/** Ply of the puzzle position's move in the source game. */
export const puzzleSourcePly = (p: Pick<Puzzle, 'sourceMoveNumber' | 'sideToMove'>) =>
  p.sourceMoveNumber ? (p.sourceMoveNumber - 1) * 2 + (p.sideToMove === 'w' ? 1 : 2) : null
