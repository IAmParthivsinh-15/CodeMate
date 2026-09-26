import { api } from '../../services/apiClient'
import type {
  AiAnswer,
  ChatMessage,
  CoachNarrative,
  CoachReport,
  ExplainResponse,
  KnowledgeSearchResponse,
  Puzzle,
} from '../../types/api'

export const aiApi = {
  // Game analysis RAG
  gameChat: (gameId: string, message: string, selectedPly?: number) =>
    api.post<AiAnswer>(`/api/games/${gameId}/chat`, { message, ...(selectedPly ? { selectedPly } : {}) }),
  gameChatHistory: (gameId: string) => api.get<{ messages: ChatMessage[] }>(`/api/games/${gameId}/chat`),
  clearGameChat: (gameId: string) => api.del<{ message: string }>(`/api/games/${gameId}/chat`),
  explainMove: (gameId: string, ply: number) => api.post<ExplainResponse>(`/api/games/${gameId}/moves/${ply}/explain`),
  practiceMistake: (gameId: string, ply: number) => api.post<{ puzzle: Puzzle }>(`/api/games/${gameId}/mistakes/${ply}/practice`),

  // General chess knowledge
  chessChat: (message: string) => api.post<AiAnswer>('/api/chess/chat', { message }),
  chessChatHistory: () => api.get<{ messages: ChatMessage[] }>('/api/chess/chat'),
  clearChessChat: () => api.del<{ message: string }>('/api/chess/chat'),
  searchKnowledge: (q: string, limit = 8) => api.get<KnowledgeSearchResponse>('/api/chess/knowledge/search', { q, limit }),

  // Coach
  coachReport: () => api.get<{ report: CoachReport }>('/api/coach/report').then((r) => r.report),
  coachSummary: () => api.post<{ report: CoachReport; narrative: CoachNarrative }>('/api/coach/summary'),
  coachChat: (message: string) => api.post<CoachNarrative>('/api/coach/chat', { message }),
  coachChatHistory: () => api.get<{ messages: ChatMessage[] }>('/api/coach/chat'),
}
