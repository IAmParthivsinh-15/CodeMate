import { io, type Socket } from 'socket.io-client'
import type { SocketAck } from '../types/api'
import { refreshAccessToken, tokenStore } from './apiClient'

export const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL ?? '').replace(/\/$/, '')

/** Create (but do not connect) the app's single Socket.IO client. */
export function createSocket(): Socket {
  const socket = io(SOCKET_URL || undefined, {
    autoConnect: false,
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Called on every (re)connect attempt, so a refreshed token is picked up.
    auth: (cb) => cb({ token: tokenStore.get() ?? undefined }),
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 8000,
  })

  // An expired token rejects the handshake: refresh over REST, then retry.
  // The server currently reports JWT verification failures (including expiry)
  // as UNAUTHORIZED rather than TOKEN_EXPIRED, so treat that as refreshable too.
  const REFRESHABLE = new Set(['TOKEN_EXPIRED', 'NO_TOKEN', 'TOKEN_INVALID', 'UNAUTHORIZED'])
  let refreshing = false
  let lastRefresh = 0
  socket.on('connect_error', async (err: Error & { data?: { code?: string } }) => {
    const code = err.data?.code
    // At most one refresh attempt per 10 s, so a revoked session can't loop.
    if (code && REFRESHABLE.has(code) && !refreshing && Date.now() - lastRefresh > 10_000) {
      lastRefresh = Date.now()
      refreshing = true
      const token = await refreshAccessToken()
      refreshing = false
      if (token) socket.connect()
    }
  })
  return socket
}

/** Promise wrapper around emit-with-ack, with a timeout. Rejects with { code, message }. */
export function emitAck<T>(socket: Socket, event: string, payload?: unknown, timeoutMs = 10_000): Promise<T> {
  return new Promise((resolve, reject) => {
    // Always send a payload: the server's handlers take (payload, ack), so an
    // ack-only emit would land in the payload slot and never be answered.
    socket.timeout(timeoutMs).emit(event, payload ?? {}, (err: Error | null, ack: SocketAck<T>) => {
      if (err) {
        reject(new SocketError('TIMEOUT', 'The server did not respond in time.'))
        return
      }
      if (!ack || !ack.ok) {
        const e = ack && !ack.ok ? ack.error : { code: 'UNKNOWN', message: 'Request failed' }
        reject(new SocketError(e.code, e.message))
        return
      }
      resolve(ack as T)
    })
  })
}

export class SocketError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SocketError'
    this.code = code
  }
}
