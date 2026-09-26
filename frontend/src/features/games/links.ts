import type { GameSummary } from '../../types/api'

/** Where to continue a game that is still in progress. */
export function resumeHref(g: Pick<GameSummary, '_id' | 'mode'>) {
  if (g.mode === 'online') return `/play/online/${g._id}`
  return `/play/${g.mode}?game=${g._id}`
}

export const analysisHref = (gameId: string, ply?: number | null) => `/games/${gameId}/analysis${ply ? `?ply=${ply}` : ''}`
