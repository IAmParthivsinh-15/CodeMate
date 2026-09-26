import { useQueryClient } from '@tanstack/react-query'
import { useEarnHint } from '../coding/useEarnHint'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { ConfirmModal } from '../../components/ui/Modal'
import { Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContext'
import { Tooltip } from '../../components/ui/Tooltip'
import { errorMessage } from '../../services/apiClient'
import type { Game, GameMove, User } from '../../types/api'
import { cn } from '../../utils/cn'
import { colorName, titleCase } from '../../utils/format'
import { ME_QUERY_KEY, useAuth } from '../auth/authContext'
import { Board, type BoardArrow, type BoardMove } from '../chess/Board'
import { GameClock } from '../chess/GameClock'
import { GameStatusBanner } from '../chess/GameStatusBanner'
import { MoveList, ReplayControls } from '../chess/MoveList'
import { PlayerBar } from '../chess/PlayerBar'
import { useReplay, useReplayKeyboard } from '../chess/useReplay'
import { gamesApi } from './api'

interface RestGameViewProps {
  game: Game
  moves: GameMove[]
  thinking: boolean
  busy: string | null
  onMove: (m: BoardMove) => void
  runAction: (kind: 'resign' | 'abort' | 'draw') => Promise<boolean>
  onNewGame: () => void
}

/** Board + controls for AI and local games (both use the REST API). */
export function RestGameView({ game, moves, thinking, busy, onMove, runAction, onNewGame }: RestGameViewProps) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const isAi = game.mode === 'ai'
  const active = game.status === 'in_progress'
  const [flipped, setFlipped] = useState(false)
  const [autoFlip, setAutoFlip] = useState(false)
  const [confirm, setConfirm] = useState<null | 'resign' | 'abort' | 'draw'>(null)
  const [hint, setHint] = useState<{ ply: number; arrow: BoardArrow; san: string } | null>(null)
  const [hintLoading, setHintLoading] = useState(false)

  const replay = useReplay(game.initialFen, moves)
  useReplayKeyboard(replay)

  const baseOrientation = isAi ? (game.yourColor === 'b' ? 'black' : 'white') : autoFlip ? (game.turn === 'w' ? 'white' : 'black') : 'white'
  const orientation = flipped ? (baseOrientation === 'white' ? 'black' : 'white') : baseOrientation
  const bottom = orientation === 'white' ? 'w' : 'b'
  const top = bottom === 'w' ? 'b' : 'w'

  const myTurn = active && !thinking && (isAi ? game.turn === game.yourColor : true)
  const movable = replay.isLatest && myTurn ? (isAi ? (game.yourColor ?? 'none') : 'both') : 'none'
  const hintCredits = user?.hintCredits ?? 0
  const { earnHint, loading: earningHint } = useEarnHint()
  const showHint = hint && hint.ply === game.ply && replay.isLatest ? hint : null

  const requestHint = async () => {
    setHintLoading(true)
    try {
      const res = await gamesApi.hint(game._id)
      setHint({ ply: game.ply, arrow: { from: res.bestMove.from, to: res.bestMove.to, color: 'rgba(59, 130, 246, 0.85)' }, san: res.bestMove.san })
      qc.setQueryData<User | null>(ME_QUERY_KEY, (u) => (u ? { ...u, hintCredits: res.hintCredits } : u))
      toast.info(`Stockfish suggests ${res.bestMove.san}.`, 'Hint')
    } catch (err) {
      toast.error(errorMessage(err), 'No hint')
    } finally {
      setHintLoading(false)
    }
  }

  const doConfirm = async () => {
    if (!confirm) return
    const ok = await runAction(confirm)
    if (ok) setConfirm(null)
  }

  const sideFor = (c: 'w' | 'b') => (c === 'w' ? game.white : game.black)

  let statusLine: string
  if (!active) statusLine = 'Game over'
  else if (thinking) statusLine = isAi ? 'Engine thinking…' : 'Sending move…'
  else if (isAi) statusLine = game.turn === game.yourColor ? 'Your move' : "Engine's move"
  else statusLine = `${colorName(game.turn)} to move`

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] min-w-0 lg:max-w-[min(100%,calc(100vh-9rem))]">
        <PlayerBar
          side={sideFor(top)}
          color={top}
          active={active && game.turn === top}
          right={game.clocks && <GameClock clocks={game.clocks} color={top} frozen={!active} />}
          status={isAi && thinking && top !== game.yourColor ? <Spinner label="Engine thinking" className="text-muted" /> : null}
        />
        <Board
          fen={replay.fen}
          orientation={orientation}
          movable={movable}
          onMove={onMove}
          lastMove={replay.lastMove}
          arrows={showHint ? [showHint.arrow] : undefined}
          className="my-1.5"
        />
        <PlayerBar
          side={sideFor(bottom)}
          color={bottom}
          active={active && game.turn === bottom}
          right={game.clocks && <GameClock clocks={game.clocks} color={bottom} frozen={!active} />}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <GameStatusBanner
          status={game.status}
          result={game.result}
          endReason={game.endReason}
          yourColor={isAi ? game.yourColor : null}
          ratingChange={game.ratingChange}
          actions={
            <>
              {game.endReason !== 'aborted' && game.ply > 0 && (
                <ButtonLink to={`/games/${game._id}/analysis`} size="sm">
                  View analysis
                </ButtonLink>
              )}
              <Button size="sm" variant="secondary" onClick={onNewGame}>
                New game
              </Button>
            </>
          }
        />

        <Card className="flex min-h-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              {thinking && <Spinner className="text-primary" />}
              <span aria-live="polite" className={cn('text-sm font-medium', thinking && 'text-primary')}>
                {statusLine}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {isAi && game.difficulty && <Badge tone="primary">{titleCase(game.difficulty)}</Badge>}
              <Badge>{game.rated ? 'Rated' : 'Casual'}</Badge>
              {game.opening && <Badge title={game.opening.eco}>{game.opening.name}</Badge>}
            </div>
          </div>
          <MoveList
            moves={moves.map((m) => ({ ply: m.ply, san: m.san }))}
            currentPly={replay.ply}
            onSelect={replay.goTo}
            className="max-h-64 min-h-24 lg:max-h-[calc(100vh-30rem)]"
          />
          <div className="space-y-2 border-t border-line p-3">
            <ReplayControls ply={replay.ply} total={replay.total} onFirst={replay.first} onPrev={replay.prev} onNext={replay.next} onLast={replay.last} />
            {!replay.isLatest && (
              <button type="button" onClick={replay.last} className="w-full rounded-md py-1 text-xs font-medium text-primary hover:underline">
                Viewing move {replay.ply} of {replay.total} · Back to current position
              </button>
            )}
          </div>
        </Card>

        <Card className="p-3">
          <div className="flex flex-wrap gap-2">
            {isAi && active && (
              hintCredits > 0 ? (
                <Button variant="secondary" size="sm" onClick={requestHint} loading={hintLoading} disabled={!myTurn || !replay.isLatest}>
                  💡 Hint <span className="text-xs text-muted">({hintCredits})</span>
                </Button>
              ) : (
                <Tooltip content="No hints left: solve a coding problem at your level to earn one, then come straight back">
                  <Button variant="secondary" size="sm" onClick={earnHint} loading={earningHint}>
                    💡 Earn a hint
                  </Button>
                </Tooltip>
              )
            )}
            {isAi && active && hintCredits > 0 && (
              <button type="button" onClick={earnHint} disabled={earningHint} className="self-center text-xs font-medium text-primary hover:underline disabled:opacity-60">
                Earn more →
              </button>
            )}
            {!isAi && active && (
              <Button variant="secondary" size="sm" onClick={() => setConfirm('draw')} disabled={!!busy}>
                ½ Draw
              </Button>
            )}
            {active && game.ply < 2 && (
              <Button variant="secondary" size="sm" onClick={() => setConfirm('abort')} disabled={!!busy || thinking}>
                Abort
              </Button>
            )}
            {active && (
              <Button variant="outline" size="sm" onClick={() => setConfirm('resign')} disabled={!!busy || thinking}>
                ⚑ Resign
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
              ⇅ Flip
            </Button>
            {!isAi && (
              <label className="flex items-center gap-2 px-2 text-sm text-muted">
                <input type="checkbox" checked={autoFlip} onChange={(e) => setAutoFlip(e.target.checked)} className="size-4 accent-[var(--primary)]" />
                Auto-flip
              </label>
            )}
          </div>
        </Card>
      </div>

      <ConfirmModal
        open={confirm !== null}
        title={confirm === 'resign' ? 'Resign this game?' : confirm === 'abort' ? 'Abort this game?' : 'Agree to a draw?'}
        message={
          confirm === 'resign'
            ? isAi
              ? 'The game ends as a loss for you.' + (game.rated ? ' Rated games affect your rating.' : '')
              : `${colorName(game.turn)} (the side to move) resigns.`
            : confirm === 'abort'
              ? 'Aborted games have no result and are not rated.'
              : 'Both sides agree the game is drawn.'
        }
        confirmLabel={confirm === 'resign' ? 'Resign' : confirm === 'abort' ? 'Abort game' : 'Agree draw'}
        variant={confirm === 'draw' ? 'primary' : 'danger'}
        loading={!!busy && busy !== 'move'}
        onConfirm={doConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
