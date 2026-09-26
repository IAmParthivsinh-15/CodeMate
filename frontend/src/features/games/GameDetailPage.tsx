import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { buttonClass } from '../../components/ui/buttonStyles'
import { Card, CardBody } from '../../components/ui/Card'
import { CopyButton } from '../../components/ui/CopyButton'
import { ErrorState } from '../../components/ui/ErrorState'
import { PageSpinner } from '../../components/ui/Spinner'
import { CLASSIFICATION } from '../../utils/chess'
import { endReasonLabel, formatDateTime, formatEval, resultLabel, titleCase } from '../../utils/format'
import { useAuth } from '../auth/authContext'
import { Board } from '../chess/Board'
import { EvalBar } from '../chess/EvalBar'
import { MoveList, ReplayControls } from '../chess/MoveList'
import { PlayerBar } from '../chess/PlayerBar'
import { useReplay, useReplayKeyboard } from '../chess/useReplay'
import { gameKeys, gamesApi } from './api'
import { AnalysisBadge } from './GameBadges'
import { resumeHref } from './links'
import { useAnalysis } from './useAnalysis'

export function GameDetailPage() {
  const { gameId = '' } = useParams()
  const [params] = useSearchParams()
  const initialPly = params.get('ply') ? Number(params.get('ply')) : null
  const game = useQuery({ queryKey: gameKeys.detail(gameId), queryFn: () => gamesApi.get(gameId) })

  if (game.isPending) return <PageSpinner />
  if (game.isError) return <ErrorState title="Couldn't load this game" error={game.error} onRetry={() => game.refetch()} />
  return <Replay key={gameId} gameId={gameId} initialPly={initialPly} />
}

function Replay({ gameId, initialPly }: { gameId: string; initialPly: number | null }) {
  const { user } = useAuth()
  const { data: game } = useQuery({ queryKey: gameKeys.detail(gameId), queryFn: () => gamesApi.get(gameId) })
  const analysis = useAnalysis(gameId, { poll: false })
  const [flipped, setFlipped] = useState(false)
  const replay = useReplay(game?.initialFen ?? '', game?.moves ?? [], initialPly)
  useReplayKeyboard(replay)
  if (!game) return null

  const a = analysis.data?.analysis ?? null
  const current = a && replay.ply > 0 ? a.moveAnalysis.find((m) => m.ply === replay.ply) : null
  const evalCp = current ? current.evaluationAfter : a && replay.ply === 0 ? a.moveAnalysis[0]?.evaluationBefore : null
  const evalMate = current ? current.mateAfter : a && replay.ply === 0 ? a.moveAnalysis[0]?.mateBefore : null
  const showEval = !!a && (user?.preferences?.showEvaluation ?? true)

  const base = game.yourColor === 'b' ? 'black' : 'white'
  const orientation = flipped ? (base === 'white' ? 'black' : 'white') : base
  const bottom = orientation === 'white' ? 'w' : 'b'
  const top = bottom === 'w' ? 'b' : 'w'
  const live = game.status === 'in_progress' || game.status === 'waiting'
  const classByPly = new Map(a?.moveAnalysis.map((m) => [m.ply, m.classification]) ?? [])

  return (
    <>
      <PageHeader
        title={`${game.white.username ?? 'White'} vs ${game.black.username ?? 'Black'}`}
        docTitle="Game replay"
        description={
          <>
            {titleCase(game.mode)} · {formatDateTime(game.createdAt)}
            {game.opening && <> · {game.opening.name}</>}
          </>
        }
        back={
          <Link to="/games" className="text-muted hover:text-fg">
            ← My games
          </Link>
        }
        actions={
          <>
            {live ? (
              <ButtonLink to={resumeHref(game)}>Resume game</ButtonLink>
            ) : (
              game.ply > 0 &&
              game.endReason !== 'aborted' && <ButtonLink to={`/games/${game._id}/analysis${replay.ply ? `?ply=${replay.ply}` : ''}`}>Open analysis</ButtonLink>
            )}
            {game.ply > 0 && (
              <a href={gamesApi.pgnUrl(game._id)} download className={buttonClass('secondary')}>
                ⤓ PGN
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="mx-auto flex w-full max-w-[min(100%,calc(100vh-10rem))] min-w-0 gap-2">
          {showEval && <EvalBar cp={evalCp} mate={evalMate} orientation={orientation} className="my-12" />}
          <div className="min-w-0 flex-1">
            <PlayerBar side={top === 'w' ? game.white : game.black} color={top} />
            <Board fen={replay.fen} orientation={orientation} lastMove={replay.lastMove} className="my-1.5" />
            <PlayerBar side={bottom === 'w' ? game.white : game.black} color={bottom} />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{live ? 'In progress' : resultLabel(game.result)}</span>
              {game.result !== '*' && <span className="font-mono text-sm text-muted">{game.result}</span>}
              {game.endReason && <Badge>{endReasonLabel(game.endReason)}</Badge>}
              <AnalysisBadge status={analysis.data?.status ?? game.analysisStatus} />
            </div>
            {current && (
              <p className="mt-2 text-sm">
                <span className="font-mono">{current.playedMove}</span>{' '}
                <span className="font-medium" style={{ color: CLASSIFICATION[current.classification].color }}>
                  {CLASSIFICATION[current.classification].label}
                </span>
                <span className="text-muted">
                  {' '}
                  · eval {formatEval(current.evaluationAfter, current.mateAfter)}
                  {current.bestMove && current.bestMove !== current.playedMove && <> · best {current.bestMove}</>}
                </span>
              </p>
            )}
          </Card>

          <Card className="flex min-h-0 flex-col">
            <MoveList
              moves={game.moves.map((m) => ({ ply: m.ply, san: m.san, classification: classByPly.get(m.ply) }))}
              currentPly={replay.ply}
              onSelect={replay.goTo}
              className="max-h-72 min-h-24 lg:max-h-[calc(100vh-34rem)]"
            />
            <div className="space-y-2 border-t border-line p-3">
              <ReplayControls ply={replay.ply} total={replay.total} onFirst={replay.first} onPrev={replay.prev} onNext={replay.next} onLast={replay.last} />
              <div className="flex items-center justify-between text-xs text-muted">
                <span>
                  Move {Math.ceil(replay.ply / 2)} · ply {replay.ply}/{replay.total}
                </span>
                <button type="button" onClick={() => setFlipped((f) => !f)} className="font-medium hover:text-fg">
                  ⇅ Flip board
                </button>
              </div>
              {!replay.isLatest && (
                <button type="button" onClick={replay.last} className="w-full py-1 text-xs font-medium text-primary hover:underline">
                  Back to final position
                </button>
              )}
            </div>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium tracking-wide text-muted uppercase">FEN</span>
                <CopyButton text={replay.fen} label="Copy FEN" />
              </div>
              <code className="block rounded-md bg-surface-2 p-2 font-mono text-xs break-all select-all">{replay.fen}</code>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
