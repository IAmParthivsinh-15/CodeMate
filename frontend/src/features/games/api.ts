import { api, buildUrl } from '../../services/apiClient'
import type {
  AnalysisResponse,
  CreateGameBody,
  Game,
  GameSummary,
  HintResponse,
  MoveInput,
  MoveResponse,
  Paginated,
} from '../../types/api'

export interface GamesQuery {
  page?: number
  limit?: number
  mode?: string
  status?: string
}

export const gamesApi = {
  create: (body: CreateGameBody) => api.post<{ game: Game }>('/api/games', body).then((r) => r.game),
  list: (q: GamesQuery) => api.get<Paginated<GameSummary>>('/api/games', { ...q }),
  get: (id: string) => api.get<{ game: Game }>(`/api/games/${id}`).then((r) => r.game),
  move: (id: string, move: MoveInput, expectedPly?: number) => api.post<MoveResponse>(`/api/games/${id}/moves`, { move, expectedPly }),
  botMove: (id: string) => api.post<MoveResponse>(`/api/games/${id}/bot-move`),
  resign: (id: string) => api.post<{ game: Game }>(`/api/games/${id}/resign`).then((r) => r.game),
  abort: (id: string) => api.post<{ game: Game }>(`/api/games/${id}/abort`).then((r) => r.game),
  draw: (id: string) => api.post<{ game: Game }>(`/api/games/${id}/draw`).then((r) => r.game),
  hint: (id: string) => api.post<HintResponse>(`/api/games/${id}/hint`),
  pgnUrl: (id: string) => buildUrl(`/api/games/${id}/pgn`),
  analyze: (id: string) => api.post<{ status: string }>(`/api/games/${id}/analyze`),
  analysis: (id: string) => api.get<AnalysisResponse>(`/api/games/${id}/analysis`),
}

export const gameKeys = {
  all: ['games'] as const,
  list: (q: GamesQuery) => ['games', 'list', q] as const,
  detail: (id: string) => ['games', 'detail', id] as const,
  analysis: (id: string) => ['analysis', id] as const,
}
