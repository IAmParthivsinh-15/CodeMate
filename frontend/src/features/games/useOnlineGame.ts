import { useQueryClient } from '@tanstack/react-query'
import { Chess } from 'chess.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useSocket, useSocketEvent } from '../../app/socketContext'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import { emitAck, SocketError } from '../../services/socket'
import type { Color, Game, GameMove, LiveState } from '../../types/api'
import { ME_QUERY_KEY, useAuth } from '../auth/authContext'
import type { BoardMove } from '../chess/Board'
import { gameKeys, gamesApi } from './api'

export type OpponentPresence =
  | { kind: 'unknown' }
  | { kind: 'connected' }
  | { kind: 'disconnected'; deadline: number }
  | { kind: 'reconnected'; at: number }

export interface OnlinePreview {
  fen: string
  san: string
  from: string
  to: string
  ply: number
}

const newMoveId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`

/**
 * Live online game over Socket.IO. The server's `game:state` is the only
 * source of truth: the client proposes moves (with clientMoveId + expectedPly)
 * and re-renders whatever state comes back. Resyncs on reconnect and on
 * STALE_POSITION.
 */
export function useOnlineGame(gameId: string) {
  const { socket, status } = useSocket()
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()

  const [game, setGame] = useState<Game | null>(null)
  const [state, setState] = useState<LiveState | null>(null)
  const [moves, setMoves] = useState<GameMove[]>([])
  const [loadError, setLoadError] = useState<unknown>(null)
  const [preview, setPreview] = useState<OnlinePreview | null>(null)
  const [opponent, setOpponent] = useState<OpponentPresence>({ kind: 'unknown' })
  const [incomingDraw, setIncomingDraw] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  // Refs mirror the latest values for event handlers that fire between renders.
  const stateRef = useRef<LiveState | null>(null)
  const movesRef = useRef<GameMove[]>([])
  const yourColorRef = useRef<Color | null>(null)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const myId = user?._id ?? ''
  const yourColor: Color | null = game?.yourColor ?? null
  const opponentId = state ? (yourColor === 'w' ? state.blackPlayerId : state.whitePlayerId) : null

  /** Full reload of the REST view (players, moves, rating change). */
  const reloadGame = useCallback(async () => {
    try {
      const g = await gamesApi.get(gameId)
      yourColorRef.current = g.yourColor
      setGame(g)
      movesRef.current = g.moves
      setMoves(g.moves)
      qc.setQueryData(gameKeys.detail(g._id), g)
    } catch (err) {
      setLoadError(err)
    }
  }, [gameId, qc])

  const applyState = useCallback(
    (s: LiveState | null | undefined) => {
      if (!s || String(s.gameId) !== gameId) return
      stateRef.current = s
      setState(s)
      setIncomingDraw(!!s.drawOfferBy && s.drawOfferBy !== yourColorRef.current)
      const known = movesRef.current
      if (s.move && s.move.ply === known.length + 1) {
        const m = s.move
        const next = [...known, { ply: m.ply, san: m.san, uci: m.uci, color: m.color, fen: m.fen, clockMs: m.clockMs }]
        movesRef.current = next
        setMoves(next)
      } else if (s.ply !== known.length) {
        void reloadGame()
      }
      if (s.status === 'completed' || s.status === 'abandoned') {
        void reloadGame()
        void qc.invalidateQueries({ queryKey: gameKeys.all })
        void qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
        void qc.invalidateQueries({ queryKey: ['dashboard'] })
      }
    },
    [gameId, reloadGame, qc],
  )

  // Subscribe to the room (on load and after every reconnect) and resync.
  useEffect(() => {
    if (!socket || status !== 'connected') return
    let cancelled = false
    emitAck<{ game: Game; state: LiveState | null }>(socket, 'room:ready', { gameId })
      .then((res) => {
        if (cancelled) return
        yourColorRef.current = res.game.yourColor
        setGame(res.game)
        movesRef.current = res.game.moves
        setMoves(res.game.moves)
        setLoadError(null)
        if (res.state) applyState(res.state)
        else if (res.game.status !== 'waiting') void reloadGame()
      })
      .catch((err) => !cancelled && setLoadError(err))
    return () => {
      cancelled = true
    }
  }, [socket, status, gameId, applyState, reloadGame])

  // Opponent presence on load.
  useEffect(() => {
    if (!socket || status !== 'connected' || !opponentId) return
    emitAck<{ presence: Record<string, boolean> }>(socket, 'presence:query', { userIds: [opponentId] })
      .then((res) =>
        setOpponent((p) => {
          if (p.kind !== 'unknown') return p
          return res.presence[opponentId] ? { kind: 'connected' } : { kind: 'disconnected', deadline: 0 }
        }),
      )
      .catch(() => undefined)
  }, [socket, status, opponentId])

  const resync = useCallback(async () => {
    if (!socket) return
    try {
      const res = await emitAck<{ state: LiveState | null }>(socket, 'game:state', { gameId })
      applyState(res.state)
    } catch {
      void reloadGame()
    }
  }, [socket, gameId, applyState, reloadGame])

  // ---- server events ----
  useSocketEvent<LiveState>('game:state', applyState)
  useSocketEvent<{ gameId: string; state: LiveState }>('game:start', (p) => {
    if (p.gameId !== gameId) return
    void reloadGame().then(() => applyState(p.state))
    toast.success('Your opponent joined. Good luck!', 'Game started')
  })
  useSocketEvent<{ gameId: string; opponent: { username: string } }>('room:joined', (p) => {
    if (p.gameId === gameId) void reloadGame()
  })
  useSocketEvent<{ gameId: string; state: LiveState }>('game:finish', (p) => {
    if (p.gameId === gameId) applyState(p.state)
  })
  useSocketEvent<{ gameId: string; by: Color }>('draw:offer', (p) => {
    if (p.gameId === gameId) setIncomingDraw(true)
  })
  useSocketEvent<{ gameId: string }>('draw:reject', (p) => {
    if (p.gameId === gameId) toast.info('Your draw offer was declined.')
  })
  useSocketEvent<{ gameId: string; by: string }>('game:pause', (p) => {
    if (p.gameId === gameId && p.by !== myId) toast.info('Your opponent paused the game.')
  })
  useSocketEvent<{ gameId: string; by: string }>('game:resume', (p) => {
    if (p.gameId === gameId && p.by !== myId) toast.info('Your opponent resumed the game.')
  })
  useSocketEvent<{ gameId: string; userId: string; graceMs: number }>('player:disconnected', (p) => {
    if (p.gameId === gameId && p.userId !== myId) setOpponent({ kind: 'disconnected', deadline: Date.now() + p.graceMs })
  })
  useSocketEvent<{ gameId: string; userId: string }>('player:reconnected', (p) => {
    if (p.gameId === gameId && p.userId !== myId) setOpponent({ kind: 'reconnected', at: Date.now() })
  })

  // "Reconnected" is a transient notice.
  useEffect(() => {
    if (opponent.kind !== 'reconnected') return
    const t = window.setTimeout(() => setOpponent({ kind: 'connected' }), 4000)
    return () => window.clearTimeout(t)
  }, [opponent])

  // ---- actions ----
  const move = useCallback(
    async (m: BoardMove) => {
      const s = stateRef.current
      if (!socket || !s || s.status !== 'in_progress' || preview) return
      let p: OnlinePreview
      try {
        const chess = new Chess(s.fen)
        const played = chess.move({ from: m.from, to: m.to, promotion: m.promotion })
        p = { fen: chess.fen(), san: played.san, from: m.from, to: m.to, ply: s.ply + 1 }
      } catch {
        return
      }
      setPreview(p)
      const payload = {
        gameId,
        move: { from: m.from, to: m.to, ...(m.promotion ? { promotion: m.promotion } : {}) },
        clientMoveId: newMoveId(),
        expectedPly: s.ply,
      }
      try {
        let res: { state: LiveState }
        try {
          res = await emitAck<{ state: LiveState }>(socket, 'game:move', payload)
        } catch (err) {
          // Same clientMoveId is safe to resend once after a timeout.
          if (err instanceof SocketError && err.code === 'TIMEOUT') res = await emitAck<{ state: LiveState }>(socket, 'game:move', payload)
          else throw err
        }
        applyState(res.state)
      } catch (err) {
        if (err instanceof SocketError && (err.code === 'STALE_POSITION' || err.code === 'CONCURRENT_MOVE')) {
          toast.info('The position changed. Synced with the server.')
          await resync()
        } else {
          toast.error(errorMessage(err), 'Move not accepted')
        }
      } finally {
        setPreview(null)
      }
    },
    [socket, gameId, preview, applyState, resync, toast],
  )

  const action = useCallback(
    async (event: 'game:resign' | 'draw:offer' | 'draw:accept' | 'draw:reject' | 'game:pause' | 'game:resume' | 'room:leave') => {
      if (!socket) return false
      setPending(event)
      try {
        const res = await emitAck<{ state?: LiveState; accepted?: boolean }>(socket, event, { gameId })
        if (res.state) applyState(res.state)
        if (event === 'draw:offer') toast.info(res.accepted ? 'Draw agreed.' : 'Draw offered. Waiting for your opponent…')
        if (event === 'draw:accept' || event === 'draw:reject') setIncomingDraw(false)
        return true
      } catch (err) {
        toast.error(errorMessage(err))
        return false
      } finally {
        setPending(null)
      }
    },
    [socket, gameId, applyState, toast],
  )

  return {
    game,
    state,
    moves,
    preview,
    loadError,
    yourColor,
    opponent,
    incomingDraw,
    pending,
    socketStatus: status,
    move,
    action,
    resync,
    reloadGame,
  }
}
