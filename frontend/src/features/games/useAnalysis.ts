import { useQuery } from '@tanstack/react-query'
import type { AnalysisResponse } from '../../types/api'
import { gameKeys, gamesApi } from './api'

const inFlight = (d?: AnalysisResponse) =>
  !!d && (d.status === 'pending' || d.status === 'running' || (d.status === 'completed' && d.aiStatus === 'pending'))

/**
 * GET /api/games/:id/analysis. Polls every 2 s while the engine or the AI
 * report is still running; the `analysis:update` socket event also
 * invalidates this query (see SocketProvider).
 */
export function useAnalysis(gameId: string, { poll = true, forcePoll = false }: { poll?: boolean; forcePoll?: boolean } = {}) {
  return useQuery({
    queryKey: gameKeys.analysis(gameId),
    queryFn: () => gamesApi.analysis(gameId),
    enabled: !!gameId,
    refetchInterval: (q) => {
      if (!poll) return false
      if (forcePoll || inFlight(q.state.data)) return 2000
      // Finished games are analysed automatically; right after the game ends the
      // status can still read "none" for a moment, so check a few more times.
      if (q.state.data?.status === 'none' && q.state.dataUpdateCount < 4) return 2000
      return false
    },
  })
}
