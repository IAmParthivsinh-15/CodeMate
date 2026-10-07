import { useQuery } from '@tanstack/react-query'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/ErrorState'
import { Markdown } from '../../components/ui/Markdown'
import { Modal } from '../../components/ui/Modal'
import { SkeletonText } from '../../components/ui/Skeleton'
import type { Classification } from '../../types/api'
import { CLASSIFICATION } from '../../utils/chess'
import { aiApi } from './api'
import { EngineFactsCard } from './EngineFactsCard'
import { SourcesList } from './SourcesList'
import { usePracticeMistake } from './usePracticeMistake'

interface ExplainMoveModalProps {
  gameId: string
  ply: number | null
  onClose: () => void
}

const SECTIONS = [
  { key: 'whatHappened', title: 'What happened' },
  { key: 'whyItMatters', title: 'Why it matters' },
  { key: 'betterMove', title: 'Better move' },
  { key: 'concept', title: 'Concept' },
  { key: 'lookFor', title: 'What to look for next time' },
] as const

/** "Explain with AI" (spec §15): the five-part explanation of one analysed move. */
export function ExplainMoveModal({ gameId, ply, onClose }: ExplainMoveModalProps) {
  const open = ply != null
  const explain = useQuery({
    queryKey: ['explain', gameId, ply],
    queryFn: () => aiApi.explainMove(gameId, ply!),
    enabled: open,
    staleTime: Infinity,
    retry: false,
  })
  const { practice, loadingPly } = usePracticeMistake(gameId)
  const data = explain.data
  const meta = data ? CLASSIFICATION[data.move.classification as Classification] : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={
        data ? (
          <span>
            {data.move.moveNumber}
            {data.move.color === 'White' ? '.' : '…'} {data.move.played}{' '}
            {meta && (
              <span className="text-sm font-medium" style={{ color: meta.color }}>
                {meta.label}
              </span>
            )}
          </span>
        ) : (
          'Explain this move'
        )
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {data?.canPractice && ply != null && (
            <Button onClick={() => practice(ply)} loading={loadingPly === ply}>
              Practice this position
            </Button>
          )}
        </>
      }
    >
      {explain.isPending ? (
        <div className="space-y-4" aria-busy="true">
          <p className="text-sm text-muted">Checking Stockfish's analysis and the knowledge base…</p>
          <SkeletonText lines={4} />
          <SkeletonText lines={3} />
        </div>
      ) : explain.isError ? (
        <ErrorState compact title="Couldn't explain this move" error={explain.error} onRetry={() => explain.refetch()} />
      ) : data ? (
        <div className="space-y-4">
          <EngineFactsCard facts={[data.move]} />
          {SECTIONS.map((s) => {
            const text = data.explanation[s.key]
            if (!text) return null
            return (
              <section key={s.key}>
                <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
                <Markdown className="text-muted">{text}</Markdown>
              </section>
            )
          })}
          {data.explanation.keyConcepts?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {data.explanation.keyConcepts.map((c) => (
                <span key={c} className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary">
                  {c}
                </span>
              ))}
            </div>
          )}
          <SourcesList sources={data.sources} />
          {data.degraded && <p className="text-[11px] text-subtle">Engine-facts mode (no LLM configured)</p>}
        </div>
      ) : null}
    </Modal>
  )
}
