import { useQuery } from '@tanstack/react-query'
import { useCallback, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { Tabs } from '../../components/ui/Tabs'
import { useAiStatus } from '../../hooks/useMeta'
import { titleCase } from '../../utils/format'
import { aiApi } from './api'
import { ChatView } from './ChatView'
import { useChat } from './useChat'

const TOPICS = [
  'What is a pin and how do I use it?',
  'How should I play the opening as a beginner?',
  'Explain the Lucena position',
  'How do I attack a castled king?',
  'What are weak squares?',
  'How do I avoid hanging pieces?',
]

function KnowledgeChat() {
  const chat = useChat({
    key: ['chat', 'chess'],
    loadHistory: useCallback(() => aiApi.chessChatHistory(), []),
    send: useCallback((text: string) => aiApi.chessChat(text), []),
    clear: useCallback(() => aiApi.clearChessChat(), []),
  })
  const ai = useAiStatus()
  return (
    <Card className="flex flex-col">
      {ai.data && !ai.data.enabled && (
        <p className="border-b border-line bg-surface-2 px-4 py-2 text-xs text-muted">
          Engine-facts mode: no LLM is configured, so answers are assembled directly from the knowledge base.
        </p>
      )}
      <ChatView
        messages={chat.messages}
        loading={chat.history.isPending}
        sending={chat.sending}
        onSend={(t) => chat.send(t)}
        onClear={chat.clear}
        suggestions={TOPICS}
        placeholder="Ask about tactics, openings, endgames, strategy…"
        heightClass="h-[min(32rem,60vh)]"
        empty={
          <EmptyState
            compact
            icon="❖"
            title="Ask the chess knowledge base"
            description="Answers cite the lessons they come from. Try one of the topics below."
          />
        }
      />
    </Card>
  )
}

function KnowledgeBrowser({ initial }: { initial: string }) {
  const [, setParams] = useSearchParams()
  const [text, setText] = useState(initial)
  const [q, setQ] = useState(initial)
  const results = useQuery({
    queryKey: ['knowledge', 'search', q],
    queryFn: () => aiApi.searchKnowledge(q, 8),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const v = text.trim()
    setQ(v)
    setParams(v ? { tab: 'browse', q: v } : { tab: 'browse' }, { replace: true })
  }

  return (
    <div className="space-y-4">
      <form onSubmit={onSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <Input label="Search the knowledge base" placeholder="e.g. knight fork, opposition, isolated pawn" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button type="submit" disabled={text.trim().length < 2}>
          Search
        </Button>
      </form>

      {q.trim().length < 2 ? (
        <div className="flex flex-wrap gap-1.5">
          {['pin', 'fork', 'skewer', 'opposition', 'king safety', 'pawn structure', 'opening principles'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setText(t)
                setQ(t)
                setParams({ tab: 'browse', q: t }, { replace: true })
              }}
              className="rounded-full border border-line bg-surface px-3 py-1 text-sm text-muted hover:border-primary hover:text-primary"
            >
              {t}
            </button>
          ))}
        </div>
      ) : results.isPending ? (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : results.isError ? (
        <ErrorState title="Search failed" error={results.error} onRetry={() => results.refetch()} />
      ) : results.data.results.length === 0 ? (
        <EmptyState title="Nothing found" description="Try a different word, like the name of a tactic or an endgame." />
      ) : (
        <ul className="space-y-3">
          {results.data.results.map((r, i) => (
            <li key={`${r.source}-${r.section}-${i}`}>
              <Card className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{r.title}</h3>
                  {r.section && r.section !== r.title && <span className="text-sm text-muted">· {r.section}</span>}
                </div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {r.topic && <Badge tone="primary">{titleCase(r.topic)}</Badge>}
                  {r.subcategory && <Badge>{titleCase(r.subcategory)}</Badge>}
                  {r.difficulty && <Badge tone="info">{titleCase(r.difficulty)}</Badge>}
                </div>
                <p className="mt-2 line-clamp-6 text-sm whitespace-pre-line text-muted">{r.text}</p>
                <p className="mt-2 font-mono text-[11px] text-subtle">{r.source}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ChessKnowledgePage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const tab = (params.get('tab') ?? (q ? 'browse' : 'ask')) === 'browse' ? 'browse' : 'ask'
  return (
    <>
      <PageHeader title="Chess knowledge" description="Ask questions about chess ideas, or browse the lessons the AI draws on." />
      <Tabs
        className="mb-4 max-w-xs"
        ariaLabel="Knowledge mode"
        value={tab}
        onChange={(v) => setParams(v === 'browse' ? { tab: 'browse', ...(q ? { q } : {}) } : {}, { replace: true })}
        tabs={[
          { value: 'ask', label: 'Ask' },
          { value: 'browse', label: 'Browse' },
        ]}
      />
      <div className="mx-auto max-w-3xl">{tab === 'ask' ? <KnowledgeChat /> : <KnowledgeBrowser key={q} initial={q} />}</div>
    </>
  )
}
