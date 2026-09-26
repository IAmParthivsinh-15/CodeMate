import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useState } from 'react'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import type { ChatMessage, EngineFact, Source } from '../../types/api'

export interface DisplayMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  ply?: number
  sources?: Source[]
  facts?: EngineFact[]
  keyConcepts?: string[]
  recommendations?: string[]
  degraded?: boolean
  groundingWarnings?: string[]
}

export interface ChatReply {
  answer: string
  sources?: Source[]
  facts?: EngineFact[]
  keyConcepts?: string[]
  recommendations?: string[]
  degraded?: boolean
  groundingWarnings?: string[]
}

let seq = 0
const nextId = () => `m${Date.now()}-${seq++}`

const fromHistory = (m: ChatMessage): DisplayMessage => ({
  id: nextId(),
  role: m.role === 'user' ? 'user' : 'assistant',
  content: m.content,
  ply: m.ply,
  sources: m.sources,
  facts: m.facts,
  keyConcepts: m.keyConcepts,
  degraded: m.degraded,
})

/**
 * Conversation state for one AI thread: history from the server plus
 * messages sent in this session.
 */
export function useChat(opts: {
  key: readonly unknown[]
  loadHistory: () => Promise<{ messages: ChatMessage[] }>
  send: (text: string, ply?: number) => Promise<ChatReply>
  clear?: () => Promise<unknown>
}) {
  const qc = useQueryClient()
  const toast = useToast()
  const history = useQuery({ queryKey: opts.key, queryFn: opts.loadHistory, staleTime: 30_000 })
  // The question being answered right now (not yet in the cached history).
  const [pending, setPending] = useState<DisplayMessage | null>(null)
  const sending = pending !== null

  const base = useMemo(() => (history.data?.messages ?? []).map(fromHistory), [history.data])
  const messages = pending ? [...base, pending] : base
  const { send: sendFn, clear: clearFn, key } = opts

  const send = useCallback(
    async (text: string, ply?: number) => {
      setPending({ id: nextId(), role: 'user', content: text, ply })
      try {
        const r = await sendFn(text, ply)
        // Append both turns to the cached thread, the same shape GET returns.
        qc.setQueryData<{ messages: ChatMessage[] }>(key, (old) => ({
          messages: [
            ...(old?.messages ?? []),
            { role: 'user', content: text, ply },
            {
              role: 'assistant',
              content: r.answer,
              ply,
              sources: r.sources,
              facts: r.facts,
              keyConcepts: r.keyConcepts,
              degraded: r.degraded,
            },
          ],
        }))
        return true
      } catch (err) {
        toast.error(errorMessage(err), 'The AI could not answer')
        return false
      } finally {
        setPending(null)
      }
    },
    [sendFn, toast, qc, key],
  )

  const clear = useCallback(async () => {
    if (!clearFn) return
    try {
      await clearFn()
      qc.setQueryData(key, { messages: [] })
    } catch (err) {
      toast.error(errorMessage(err))
    }
  }, [clearFn, qc, key, toast])

  return { messages, history, send, sending, clear: clearFn ? clear : undefined }
}
