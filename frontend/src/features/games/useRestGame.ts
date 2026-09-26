import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Chess } from 'chess.js'
import { useCallback, useRef, useState } from 'react'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage, isApiError } from '../../services/apiClient'
import type { Game, GameMove } from '../../types/api'
import { ME_QUERY_KEY } from '../auth/authContext'
import type { BoardMove } from '../chess/Board'
import { gameKeys, gamesApi } from './api'

export interface OptimisticMove {
  fen: string
  san: string
  from: string
  to: string
  ply: number
}

/**
 * Server-authoritative game over REST (AI and local modes).
 * The player's move is shown optimistically, then replaced by what the server
 * returns (including the engine's reply); on error it rolls back with a toast.
 */
export function useRestGame(gameId: string | null) {
  const qc = useQueryClient()
  const toast = useToast()
  const [optimistic, setOptimistic] = useState<OptimisticMove | null>(null)
  const [busy, setBusy] = useState<null | 'move' | 'resign' | 'abort' | 'draw'>(null)
  const inFlight = useRef(false)

  const query = useQuery({
    queryKey: gameKeys.detail(gameId ?? ''),
    queryFn: () => gamesApi.get(gameId!),
    enabled: !!gameId,
  })
  const game = query.data

  const setGame = useCallback(
    (g: Game) => {
      qc.setQueryData(gameKeys.detail(g._id), g)
      if (g.status === 'completed' || g.status === 'abandoned') {
        void qc.invalidateQueries({ queryKey: gameKeys.all })
        void qc.invalidateQueries({ queryKey: ['dashboard'] })
        void qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
      }
    },
    [qc],
  )

  const move = useCallback(
    async (m: BoardMove) => {
      if (!game || inFlight.current || game.status !== 'in_progress') return
      // Local preview only; the server decides.
      let preview: OptimisticMove
      try {
        const chess = new Chess(game.fen)
        const played = chess.move({ from: m.from, to: m.to, promotion: m.promotion })
        preview = { fen: chess.fen(), san: played.san, from: m.from, to: m.to, ply: game.ply + 1 }
      } catch {
        return
      }
      inFlight.current = true
      setOptimistic(preview)
      setBusy('move')
      try {
        const res = await gamesApi.move(game._id, { from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) }, game.ply)
        setGame(res.game)
      } catch (err) {
        toast.error(errorMessage(err), 'Move not accepted')
        if (isApiError(err) && ['STALE_POSITION', 'CONCURRENT_MOVE', 'GAME_NOT_ACTIVE'].includes(err.code)) void query.refetch()
      } finally {
        setOptimistic(null)
        setBusy(null)
        inFlight.current = false
      }
    },
    [game, setGame, toast, query],
  )

  const runAction = useCallback(
    async (kind: 'resign' | 'abort' | 'draw') => {
      if (!game) return false
      setBusy(kind)
      try {
        const fn = kind === 'resign' ? gamesApi.resign : kind === 'abort' ? gamesApi.abort : gamesApi.draw
        setGame(await fn(game._id))
        return true
      } catch (err) {
        toast.error(errorMessage(err))
        return false
      } finally {
        setBusy(null)
      }
    },
    [game, setGame, toast],
  )

  // Moves to display: server moves plus the optimistic one.
  const moves: GameMove[] = game
    ? optimistic
      ? [...game.moves, { ply: optimistic.ply, san: optimistic.san, uci: `${optimistic.from}${optimistic.to}`, color: game.turn, fen: optimistic.fen }]
      : game.moves
    : []

  return { query, game, moves, optimistic, busy, move, runAction, setGame }
}
