import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '../../components/ui/Button'
import { Markdown } from '../../components/ui/Markdown'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { cn } from '../../utils/cn'
import { EngineFactsCard } from './EngineFactsCard'
import { SourcesList } from './SourcesList'
import type { DisplayMessage } from './useChat'

interface ChatViewProps {
  messages: DisplayMessage[]
  loading?: boolean
  sending?: boolean
  onSend: (text: string) => Promise<boolean>
  suggestions?: string[]
  placeholder?: string
  empty?: ReactNode
  /** Shown above the composer, e.g. "Asking about 14… Nxe5". */
  context?: ReactNode
  onClear?: () => void
  onJumpToPly?: (ply: number) => void
  className?: string
  /** Max height of the scrolling message area. */
  heightClass?: string
}

function AssistantMessage({ m, onJumpToPly }: { m: DisplayMessage; onJumpToPly?: (ply: number) => void }) {
  return (
    <div className="space-y-2">
      <Markdown>{m.content}</Markdown>
      <EngineFactsCard facts={m.facts} onJump={onJumpToPly} />
      {m.keyConcepts && m.keyConcepts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {m.keyConcepts.slice(0, 6).map((c) => (
            <span key={c} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
              {c}
            </span>
          ))}
        </div>
      )}
      <SourcesList sources={m.sources} />
      {m.degraded && <p className="text-[11px] text-subtle">Engine-facts mode (no LLM configured)</p>}
    </div>
  )
}

/** Chat thread + composer shared by the game chat, knowledge chat and coach chat. */
export function ChatView({
  messages,
  loading,
  sending,
  onSend,
  suggestions,
  placeholder = 'Ask a question…',
  empty,
  context,
  onClear,
  onJumpToPly,
  className,
  heightClass = 'h-[26rem]',
}: ChatViewProps) {
  const [text, setText] = useState('')
  const inputId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])

  const submit = async (value: string) => {
    const q = value.trim()
    if (q.length < 2 || sending) return
    setText('')
    const ok = await onSend(q)
    if (!ok) setText(q)
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void submit(text)
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit(text)
    }
  }

  return (
    <div className={cn('flex min-h-0 flex-col', className)}>
      <div ref={scrollRef} className={cn('min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4', heightClass)} aria-live="polite" aria-busy={sending}>
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="ml-auto h-8 w-2/3" />
            <Skeleton className="h-16 w-5/6" />
          </div>
        ) : messages.length === 0 ? (
          (empty ?? <p className="py-6 text-center text-sm text-muted">Ask anything to get started.</p>)
        ) : (
          messages.map((m) =>
            m.role === 'user' ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-fg">
                  {m.content}
                  {m.ply ? <span className="mt-0.5 block text-[11px] opacity-75">about ply {m.ply}</span> : null}
                </div>
              </div>
            ) : (
              <div key={m.id} className="max-w-[95%] rounded-2xl rounded-bl-sm border border-line bg-surface px-3.5 py-2.5">
                <AssistantMessage m={m} onJumpToPly={onJumpToPly} />
              </div>
            ),
          )
        )}
        {sending && (
          <div className="flex items-center gap-2 text-sm text-muted" role="status">
            <Spinner /> Thinking…
          </div>
        )}
      </div>

      <div className="space-y-2 border-t border-line p-3">
        {suggestions && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <button
                key={s}
                type="button"
                disabled={sending}
                onClick={() => void submit(s)}
                className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs text-muted transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {context && <div className="text-xs text-muted">{context}</div>}
        <form onSubmit={onSubmit} className="flex items-end gap-2">
          <label className="sr-only" htmlFor={inputId}>
            Message
          </label>
          <textarea
            id={inputId}
            rows={1}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 focus:outline-none"
          />
          <Button type="submit" disabled={text.trim().length < 2} loading={sending} aria-label="Send message">
            Send
          </Button>
        </form>
        {onClear && messages.length > 0 && (
          <button type="button" onClick={onClear} className="text-xs text-subtle hover:text-fg">
            Clear conversation
          </button>
        )}
      </div>
    </div>
  )
}
