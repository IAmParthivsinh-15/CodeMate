import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { useAuth } from '../features/auth/authContext'
import { createSocket, emitAck } from '../services/socket'
import { SocketContext, type SocketStatus } from './socketContext'

const HEARTBEAT_MS = 25_000

/**
 * One Socket.IO connection per signed-in session. Exposes the connection
 * status (spec §54), a server clock offset for rendering clocks, and routes
 * background notifications (analysis / submissions) into the query cache.
 */
export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?._id ?? null
  const qc = useQueryClient()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [status, setStatus] = useState<SocketStatus>('idle')
  const [clockOffsetMs, setClockOffsetMs] = useState(0)
  const [activeGames, setActiveGames] = useState<string[]>([])

  useEffect(() => {
    if (!userId) return
    const s = createSocket()
    let heartbeat: number | undefined

    const beat = async () => {
      const sent = Date.now()
      try {
        const ack = await emitAck<{ serverTime: number }>(s, 'presence:heartbeat', {})
        const recv = Date.now()
        setClockOffsetMs(ack.serverTime - (sent + recv) / 2)
      } catch {
        // A missed heartbeat is harmless; Socket.IO's ping detects dead links.
      }
    }

    const onConnect = () => {
      setStatus('connected')
      void beat()
      window.clearInterval(heartbeat)
      heartbeat = window.setInterval(beat, HEARTBEAT_MS)
    }
    const onDisconnect = (reason: string) => {
      window.clearInterval(heartbeat)
      setStatus(reason === 'io client disconnect' ? 'idle' : navigator.onLine ? 'reconnecting' : 'offline')
    }
    const onConnectError = () => setStatus(s.active ? 'reconnecting' : 'offline')
    const onReconnectAttempt = () => setStatus(navigator.onLine ? 'reconnecting' : 'offline')
    const onReconnectFailed = () => setStatus('offline')
    const onSession = (p: { activeGames?: string[] }) => setActiveGames(p.activeGames ?? [])
    const onAnalysis = (p: { gameId: string }) => {
      void qc.invalidateQueries({ queryKey: ['analysis', p.gameId] })
      void qc.invalidateQueries({ queryKey: ['games'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      void qc.invalidateQueries({ queryKey: ['puzzles'] })
    }
    const onSubmission = (p: { submissionId: string; firstAccept?: boolean }) => {
      void qc.invalidateQueries({ queryKey: ['submission', p.submissionId] })
      if (p.firstAccept) void qc.invalidateQueries({ queryKey: ['auth', 'me'] })
    }
    const onOffline = () => setStatus('offline')
    const onOnline = () => {
      if (!s.connected) {
        setStatus('reconnecting')
        s.connect()
      }
    }

    s.on('connect', onConnect)
    s.on('disconnect', onDisconnect)
    s.on('connect_error', onConnectError)
    s.on('session', onSession)
    s.on('analysis:update', onAnalysis)
    s.on('submission:update', onSubmission)
    s.io.on('reconnect_attempt', onReconnectAttempt)
    s.io.on('reconnect_failed', onReconnectFailed)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    setSocket(s)
    setStatus('connecting')
    s.connect()

    return () => {
      window.clearInterval(heartbeat)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
      s.io.off('reconnect_attempt', onReconnectAttempt)
      s.io.off('reconnect_failed', onReconnectFailed)
      s.removeAllListeners()
      s.disconnect()
      setSocket(null)
      setStatus('idle')
      setActiveGames([])
    }
  }, [userId, qc])

  const value = useMemo(() => ({ socket, status, clockOffsetMs, activeGames }), [socket, status, clockOffsetMs, activeGames])
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
}
