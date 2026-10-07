import { api } from '../../services/apiClient'
import type { CodeLanguage, Preferences, RatingHistoryResponse, User, UserStatistics } from '../../types/api'

export interface UpdateMeBody {
  username?: string
  preferences?: Partial<Omit<Preferences, 'pieceSet'>> & { pieceSet?: string }
  preferredLanguage?: CodeLanguage
}

export const usersApi = {
  updateMe: (body: UpdateMeBody) => api.patch<{ user: User }>('/api/users/me', body).then((r) => r.user),
  statistics: () => api.get<UserStatistics>('/api/users/me/statistics'),
  ratingHistory: () => api.get<RatingHistoryResponse>('/api/users/me/rating-history'),
}
