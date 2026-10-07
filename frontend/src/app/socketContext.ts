import { createContext, useContext, useEffect, useRef } from 'react'
import type { Socket } from 'socket.io-client'

export type SocketStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline'

export interface SocketContextValue {
  socket: Socket | null
  status: SocketStatus
  /** serverTime - clientTime, estimated from heartbeats (ms). */
  clockOffsetMs: number
  /** Active online games the server reported on connect. */
  activeGames: string[]
}

export const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'idle', clockOffsetMs: 0, activeGames: [] })

export function useSocket(): SocketContextValue {
  return useContext(SocketContext)
}

/** Subscribe to a server event for the lifetime of the component. The latest handler is always used. */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void) {
  const { socket } = useSocket()
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!socket) return
    const fn = (payload: T) => ref.current(payload)
    socket.on(event, fn)
    return () => {
      socket.off(event, fn)
    }
  }, [socket, event])
}
