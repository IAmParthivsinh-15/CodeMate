import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonStyles'
import { Card } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageSpinner } from '../../components/ui/Spinner'
import { Tabs } from '../../components/ui/Tabs'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import type { Game, GameAnalysis } from '../../types/api'
import { parseUci, themeLabel } from '../../utils/chess'
import { endReasonLabel, resultLabel } from '../../utils/format'
import { useAuth } from '../auth/authContext'
import { ExplainMoveModal } from '../ai/ExplainMoveModal'
import { GameChat } from '../ai/GameChat'
import { usePracticeMistake } from '../ai/usePracticeMistake'
import { Board, type BoardArrow } from '../chess/Board'
import { EvalBar } from '../chess/EvalBar'
import { MoveList, ReplayControls } from '../chess/MoveList'
import { useReplay, useReplayKeyboard } from '../chess/useReplay'
import { AiReportCard } from './analysis/AiReportCard'
import { AnalysisPipeline } from './analysis/AnalysisPipeline'
import { EvalGraph } from './analysis/EvalGraph'
import { MoveDetail } from './analysis/MoveDetail'
import { SideStatsCard } from './analysis/SideStatsCard'
import { gameKeys, gamesApi } from './api'
import { useAnalysis } from './useAnalysis'

export function GameAnalysisPage() {
  const { gameId = '' } = useParams()
  const [params] = useSearchParams()
  const initialPly = params.get('ply') ? Number(params.get('ply')) : null
  const qc = useQueryClient()
  const toast = useToast()
  const [requested, setRequested] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const game = useQuery({ queryKey: gameKeys.detail(gameId), queryFn: () => gamesApi.get(gameId) })
  const analysis = useAnalysis(gameId, { forcePoll: requested })

  const analyze = async () => {
    setAnalyzing(true)
    try {
      await gamesApi.analyze(gameId)
      setRequested(true)
      await qc.invalidateQueries({ queryKey: gameKeys.analysis(gameId) })
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't start the analysis")
    } finally {
      setAnalyzing(false)
    }
  }

  if (game.isPending) return <PageSpinner />
  if (game.isError) return <ErrorState title="Couldn't load this game" error={game.error} onRetry={() => game.refetch()} />

  const g = game.data
  const finished = g.status === 'completed' || g.status === 'abandoned'
  const header = (
    <PageHeader
      title="Game analysis"
      description={
        <>
          {g.white.username ?? 'White'} vs {g.black.username ?? 'Black'} · {resultLabel(g.result)}
          {g.endReason ? ` · ${endReasonLabel(g.endReason)}` : ''}
          {g.opening ? ` · ${g.opening.name}` : ''}
        </>
      }
      back={
        <Link to={`/games/${g._id}`} className="text-muted hover:text-fg">
          ← Replay
        </Link>
      }
      actions={
        g.ply > 0 && (
          <a href={gamesApi.pgnUrl(g._id)} download className={buttonClass('secondary')}>
            ⤓ PGN
          </a>
        )
      }
    />
  )

  if (analysis.isPending) {
    return (
      <>
        {header}
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="h-96" />
        </div>
      </>
    )
  }
  if (analysis.isError) {
    return (
      <>
        {header}
        <ErrorState title="Couldn't load the analysis" error={analysis.error} onRetry={() => analysis.refetch()} />
      </>
    )
  }

  const data = analysis.data
  if (data.status !== 'completed' || !data.analysis) {
    return (
      <>
        {header}
        <div className="mx-auto max-w-lg space-y-4">
          <AnalysisPipeline status={data.status} aiStatus={data.aiStatus} gameFinished={finished} onAnalyze={analyze} analyzing={analyzing} />
          {!finished && (
            <ButtonLink to={g.mode === 'online' ? `/play/online/${g._id}` : `/play/${g.mode}?game=${g._id}`} variant="secondary">
              Back to the game
            </ButtonLink>
          )}
          {g.ply === 0 && <p className="text-center text-sm text-muted">This game has no moves to analyze.</p>}
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <AnalysisWorkspace key={gameId} game={g} analysis={data.analysis} aiStatus={data.aiStatus} initialPly={initialPly} />
    </>
  )
}

function AnalysisWorkspace({
  game,
  analysis,
  aiStatus,
  initialPly,
}: {
  game: Game
  analysis: GameAnalysis
  aiStatus: GameAnalysis['aiStatus']
  initialPly: number | null
}) {
  const { user } = useAuth()
  const [, setParams] = useSearchParams()
  const [tab, setTab] = useState<'chat' | 'report' | 'stats'>('chat')
  const [explainPly, setExplainPly] = useState<number | null>(null)
  const [flipped, setFlipped] = useState(false)
  const { practice, loadingPly } = usePracticeMistake(game._id)

  const validPly = initialPly != null && Number.isInteger(initialPly) && initialPly >= 0 && initialPly <= game.moves.length ? initialPly : null
  const replay = useReplay(game.initialFen, game.moves, validPly)

  // Keep ?ply=N in the URL so a position can be shared or bookmarked.
  const goTo = (ply: number) => {
    const p = Math.max(0, Math.min(replay.total, ply))
    replay.goTo(p)
    setParams(p > 0 ? { ply: String(p) } : {}, { replace: true })
  }
  useReplayKeyboard(
    { next: () => goTo(replay.ply + 1), prev: () => goTo(replay.ply - 1), first: () => goTo(0), last: () => goTo(replay.total) },
    explainPly === null,
  )

  const byPly = new Map(analysis.moveAnalysis.map((m) => [m.ply, m]))
  const selected = replay.ply > 0 ? (byPly.get(replay.ply) ?? null) : null
  const next = byPly.get(replay.ply + 1) ?? null
  // Best move from the current position = the engine's choice for the next ply.
  const bestArrow: BoardArrow[] = []
  const bestUci = parseUci(next?.bestMoveUci)
  if (bestUci) bestArrow.push({ from: bestUci.from, to: bestUci.to, color: 'rgba(34, 160, 90, 0.8)' })

  const evalCp = selected ? selected.evaluationAfter : analysis.moveAnalysis[0]?.evaluationBefore
  const evalMate = selected ? selected.mateAfter : analysis.moveAnalysis[0]?.mateBefore
  const base = game.yourColor === 'b' ? 'black' : 'white'
  const orientation = flipped ? (base === 'white' ? 'black' : 'white') : base
  const showEval = user?.preferences?.showEvaluation ?? true

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_24rem] xl:grid-cols-[minmax(0,1fr)_28rem]">
      {/* Board column */}
      <div className="min-w-0 space-y-4">
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-11rem))] gap-2">
          {showEval && <EvalBar cp={evalCp} mate={evalMate} orientation={orientation} />}
          <div className="min-w-0 flex-1">
            <Board fen={replay.fen} orientation={orientation} lastMove={replay.lastMove} arrows={bestArrow} id="analysis-board" />
            <div className="mt-2 flex items-center gap-2">
              <ReplayControls
                ply={replay.ply}
                total={replay.total}
                onFirst={() => goTo(0)}
                onPrev={() => goTo(replay.ply - 1)}
                onNext={() => goTo(replay.ply + 1)}
                onLast={() => goTo(replay.total)}
                className="flex-1"
              />
              <button type="button" onClick={() => setFlipped((f) => !f)} className="h-9 rounded-lg border border-line px-3 text-sm hover:bg-surface-2" aria-pressed={flipped}>
                ⇅
              </button>
            </div>
            {next?.bestMove && (
              <p className="mt-1.5 text-xs text-muted">
                <span className="mr-1 inline-block size-2 rounded-full bg-[rgb(34,160,90)]" aria-hidden="true" />
                Green arrow: Stockfish's best move here ({next.bestMove})
              </p>
            )}
          </div>
        </div>

        <Card className="p-3">
          <p className="mb-1 px-1 text-xs font-medium tracking-wide text-muted uppercase">Evaluation</p>
          <EvalGraph moves={analysis.moveAnalysis} selectedPly={replay.ply} onSelect={goTo} />
        </Card>

        {analysis.themes.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Themes in this game:</span>
            {analysis.themes.map((t) => (
              <Badge key={t} tone="warning">
                {themeLabel(t)}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Analysis column */}
      <div className="flex min-w-0 flex-col gap-4">
        <MoveDetail
          move={selected}
          yourColor={game.yourColor}
          isLocal={game.mode === 'local'}
          onExplain={setExplainPly}
          onPractice={practice}
          practicing={loadingPly === selected?.ply}
        />

        <Card>
          <MoveList
            moves={game.moves.map((m) => ({ ply: m.ply, san: m.san, classification: byPly.get(m.ply)?.classification }))}
            currentPly={replay.ply}
            onSelect={goTo}
            className="max-h-56"
          />
        </Card>

        <Card className="flex min-h-0 flex-col">
          <div className="border-b border-line p-2">
            <Tabs
              ariaLabel="Analysis panels"
              value={tab}
              onChange={setTab}
              tabs={[
                { value: 'chat', label: 'Ask AI' },
                { value: 'report', label: 'AI report' },
                { value: 'stats', label: 'Stats' },
              ]}
            />
          </div>
          <div role="tabpanel">
            {tab === 'chat' && (
              <GameChat
                gameId={game._id}
                selectedPly={replay.ply}
                selectedSan={selected?.playedMove}
                onJumpToPly={goTo}
                heightClass="h-[22rem]"
              />
            )}
            {tab === 'report' && <AiReportCard report={analysis.aiReport} aiStatus={aiStatus} onJump={goTo} />}
            {tab === 'stats' && (
              <div className="p-3">
                <SideStatsCard analysis={analysis} yourColor={game.mode === 'local' ? null : game.yourColor} />
              </div>
            )}
          </div>
        </Card>
      </div>

      <ExplainMoveModal gameId={game._id} ply={explainPly} onClose={() => setExplainPly(null)} />
    </div>
  )
}
