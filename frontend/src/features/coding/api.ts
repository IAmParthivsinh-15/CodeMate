import { api } from '../../services/apiClient'
import type { CodeLanguage, LanguagesResponse, Paginated, Problem, ProblemSummary, Submission } from '../../types/api'

export interface ProblemQuery {
  page?: number
  limit?: number
  difficulty?: string
  tag?: string
  search?: string
}

export const codingApi = {
  languages: () => api.get<LanguagesResponse>('/api/coding/languages'),
  tags: () => api.get<{ tags: string[] }>('/api/coding/tags').then((r) => r.tags),
  problems: (q: ProblemQuery) => api.get<Paginated<ProblemSummary>>('/api/coding/problems', { ...q }),
  problem: (idOrSlug: string) => api.get<{ problem: Problem }>(`/api/coding/problems/${encodeURIComponent(idOrSlug)}`).then((r) => r.problem),
  submit: (body: { problemId: string; language: CodeLanguage; code: string; kind: 'run' | 'submit' }) =>
    api.post<{ submission: Submission }>('/api/coding/submissions', body).then((r) => r.submission),
  submissions: (q: { page?: number; limit?: number; problemId?: string; status?: string }) =>
    api.get<Paginated<Submission>>('/api/coding/submissions', { ...q }),
  submission: (id: string) => api.get<{ submission: Submission }>(`/api/coding/submissions/${id}`).then((r) => r.submission),
}

export const isFinalStatus = (s: string) => s !== 'queued' && s !== 'running'

export const LANGUAGE_LABEL: Record<string, string> = { javascript: 'JavaScript', python: 'Python', java: 'Java', cpp: 'C++' }
