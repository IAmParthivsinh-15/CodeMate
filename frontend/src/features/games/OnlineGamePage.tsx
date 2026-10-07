import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useSocket } from '../../app/socketContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { ConfirmModal } from '../../components/ui/Modal'
import { PageSpinner, Spinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContext'
import type { Clocks, Color } from '../../types/api'
import { cn } from '../../utils/cn'
import { colorName, formatDuration } from '../../utils/format'
import { Board } from '../chess/Board'
import { GameClock } from '../chess/GameClock'
import { GameStatusBanner } from '../chess/GameStatusBanner'
import { MoveList, ReplayControls } from '../chess/MoveList'
import { PlayerBar } from '../chess/PlayerBar'
import { useReplay, useReplayKeyboard } from '../chess/useReplay'
import { useOnlineGame, type OpponentPresence } from './useOnlineGame'

function useNow(active: boolean, intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const t = window.setInterval(() => setNow(Date.now()), intervalMs)
    return () => window.clearInterval(t)
  }, [active, intervalMs])
  return now
}

function OpponentStatus({ presence }: { presence: OpponentPresence }) {
  const now = useNow(presence.kind === 'disconnected' && presence.deadline > 0)
  if (presence.kind === 'unknown') return null
  if (presence.kind === 'connected') return <Badge tone="success">● Connected</Badge>
  if (presence.kind === 'reconnected') return <Badge tone="success">Reconnected</Badge>
  const left = presence.deadline ? Math.max(0, presence.deadline - now) : null
  return (
    <Badge tone="danger" title="If they don't return in time, they lose by abandonment.">
      Disconnected{left != null ? ` · ${formatDuration(left)}` : ''}
    </Badge>
  )
}

function ConnectionBanner({ status }: { status: string }) {
  if (status === 'connected') return null
  const text =
    status === 'offline'
      ? 'Offline. Your moves cannot be sent until the connection is back.'
      : status === 'reconnecting'
        ? 'Reconnecting… The game will resync automatically.'
        : 'Connecting to the game server…'
  return (
    <div role="status" className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', status === 'offline' ? 'bg-danger-soft text-danger' : 'bg-warning-soft text-warning')}>
      {status !== 'offline' && <Spinner />}
      {text}
    </div>
  )
}

function WaitingRoom({ roomCode, onCancel, cancelling }: { roomCode?: string; onCancel: () => void; cancelling: boolean }) {
  const toast = useToast()
  const copy = async () => {
    if (!roomCode) return
    try {
      await navigator.clipboard.writeText(roomCode)
      toast.success('Room code copied.')
    } catch {
      toast.error('Copy failed. Select the code and copy it manually.')
    }
  }
  return (
    <Card className="mx-auto max-w-md">
      <CardBody className="space-y-5 text-center">
        <div className="flex items-center justify-center gap-2 text-muted">
          <Spinner /> Waiting for an opponent to join…
        </div>
        <div>
          <p className="text-xs font-medium tracking-wider text-muted uppercase">Room code</p>
          <p className="mt-1 font-mono text-4xl font-semibold tracking-[0.3em] select-all" aria-label={`Room code ${roomCode ?? ''}`}>
            {roomCode ?? '······'}
          </p>
        </div>
        <p className="text-sm text-muted">Share this code with a friend. They can enter it under “Join a room” on the online page.</p>
        <div className="flex justify-center gap-2">
          <Button onClick={copy} disabled={!roomCode}>
            Copy code
          </Button>
          <Button variant="secondary" onClick={onCancel} loading={cancelling}>
            Cancel room
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export function OnlineGamePage() {
  const { gameId = '' } = useParams()
  const navigate = useNavigate()
  const { clockOffsetMs } = useSocket()
  const g = useOnlineGame(gameId)
  const { game, state, moves, preview, yourColor, socketStatus } = g
  const [confirmResign, setConfirmResign] = useState(false)
  const [flipped, setFlipped] = useState(false)

  const displayMoves = preview && state
    ? [...moves, { ply: preview.ply, san: preview.san, uci: `${preview.from}${preview.to}`, color: state.turn, fen: preview.fen }]
    : moves
  const replay = useReplay(game?.initialFen ?? 'start', displayMoves)
  useReplayKeyboard(replay)

  if (g.loadError && !game) {
    return <ErrorState title="Couldn't open this game" error={g.loadError} onRetry={() => g.reloadGame()} />
  }
  if (!game) {
    return (
      <div className="space-y-4">
        <ConnectionBanner status={socketStatus} />
        <PageSpinner />
      </div>
    )
  }

  const status = state?.status ?? game.status
  const back = (
    <Link to="/play/online" className="text-muted hover:text-fg">
      ← Online lobby
    </Link>
  )

  if (status === 'waiting') {
    return (
      <>
        <PageHeader title="Private room" back={back} />
        <div className="space-y-4">
          <ConnectionBanner status={socketStatus} />
          <WaitingRoom
            roomCode={game.roomCode}
            cancelling={g.pending === 'room:leave'}
            onCancel={async () => {
              if (await g.action('room:leave')) navigate('/play/online')
            }}
          />
        </div>
      </>
    )
  }

  const active = status === 'in_progress'
  const turn: Color = state?.turn ?? game.turn
  const clocks: Clocks | null = state?.clocks ?? game.clocks
  const paused = state?.paused ?? game.paused
  const baseOrientation = yourColor === 'b' ? 'black' : 'white'
  const orientation = flipped ? (baseOrientation === 'white' ? 'black' : 'white') : baseOrientation
  const bottom: Color = orientation === 'white' ? 'w' : 'b'
  const top: Color = bottom === 'w' ? 'b' : 'w'
  const myTurn = active && !paused && turn === yourColor && !preview && socketStatus === 'connected'
  const drawOfferBy = state?.drawOfferBy ?? null
  const iOffered = drawOfferBy != null && drawOfferBy === yourColor
  const opponentColor: Color | null = yourColor === 'w' ? 'b' : yourColor === 'b' ? 'w' : null

  const sideFor = (c: Color) => (c === 'w' ? game.white : game.black)
  const clockFor = (c: Color) => clocks && <GameClock clocks={clocks} color={c} offsetMs={clockOffsetMs} frozen={!active || paused} />

  return (
    <>
      <PageHeader
        title={`vs ${opponentColor ? (sideFor(opponentColor).username ?? 'Opponent') : 'Opponent'}`}
        docTitle="Online game"
        back={back}
        actions={
          <div className="flex items-center gap-2">
            <Badge>{game.rated ? 'Rated' : 'Casual'}</Badge>
            {game.timeControl && (
              <Badge tone="primary">
                {game.timeControl.initialMs / 60000}+{game.timeControl.incrementMs / 1000}
              </Badge>
            )}
          </div>
        }
      />
      <div className="mb-4 empty:hidden">
        <ConnectionBanner status={socketStatus} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] min-w-0 lg:max-w-[min(100%,calc(100vh-10rem))]">
          <PlayerBar
            side={sideFor(top)}
            color={top}
            active={active && turn === top}
            right={clockFor(top)}
            status={top === opponentColor ? <OpponentStatus presence={g.opponent} /> : null}
          />
          <div className="relative">
            <Board
              fen={replay.fen === 'start' ? game.fen : replay.fen}
              orientation={orientation}
              movable={replay.isLatest && myTurn && yourColor ? yourColor : 'none'}
              onMove={g.move}
              lastMove={replay.lastMove}
              className="my-1.5"
            />
            {paused && active && (
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <span className="rounded-lg bg-black/70 px-4 py-2 text-sm font-medium text-white">Paused</span>
              </div>
            )}
          </div>
          <PlayerBar
            side={sideFor(bottom)}
            color={bottom}
            active={active && turn === bottom}
            right={clockFor(bottom)}
            status={bottom === opponentColor ? <OpponentStatus presence={g.opponent} /> : null}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <GameStatusBanner
            status={status}
            result={state?.result ?? game.result}
            endReason={state?.endReason ?? game.endReason}
            yourColor={yourColor}
            ratingChange={game.ratingChange}
            actions={
              <>
                {game.ply > 0 && (
                  <ButtonLink to={`/games/${game._id}/analysis`} size="sm">
                    View analysis
                  </ButtonLink>
                )}
                <ButtonLink to="/play/online" size="sm" variant="secondary">
                  New game
                </ButtonLink>
              </>
            }
          />

          {active && g.incomingDraw && !iOffered && (
            <Card className="border-primary/50 p-3">
              <p className="text-sm font-medium">Your opponent offers a draw.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" onClick={() => g.action('draw:accept')} loading={g.pending === 'draw:accept'}>
                  Accept
                </Button>
                <Button size="sm" variant="secondary" onClick={() => g.action('draw:reject')} loading={g.pending === 'draw:reject'}>
                  Decline
                </Button>
              </div>
            </Card>
          )}

          <Card className="flex min-h-0 flex-col">
            <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
              <span className="text-sm font-medium" aria-live="polite">
                {!active
                  ? 'Game over'
                  : paused
                    ? 'Game paused'
                    : preview
                      ? 'Sending move…'
                      : turn === yourColor
                        ? 'Your move'
                        : `${colorName(turn)} to move`}
              </span>
              {game.opening && <Badge>{game.opening.name}</Badge>}
            </div>
            <MoveList
              moves={displayMoves.map((m) => ({ ply: m.ply, san: m.san }))}
              currentPly={replay.ply}
              onSelect={replay.goTo}
              className="max-h-64 min-h-24 lg:max-h-[calc(100vh-32rem)]"
            />
            <div className="space-y-2 border-t border-line p-3">
              <ReplayControls ply={replay.ply} total={replay.total} onFirst={replay.first} onPrev={replay.prev} onNext={replay.next} onLast={replay.last} />
              {!replay.isLatest && (
                <button type="button" onClick={replay.last} className="w-full py-1 text-xs font-medium text-primary hover:underline">
                  Back to current position
                </button>
              )}
            </div>
          </Card>

          <Card className="p-3">
            <div className="flex flex-wrap gap-2">
              {active && (
                <>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => g.action('draw:offer')}
                    disabled={iOffered || socketStatus !== 'connected'}
                    loading={g.pending === 'draw:offer'}
                  >
                    {iOffered ? 'Draw offered' : '½ Offer draw'}
                  </Button>
                  {!game.rated && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => g.action(paused ? 'game:resume' : 'game:pause')}
                      loading={g.pending === 'game:pause' || g.pending === 'game:resume'}
                      disabled={socketStatus !== 'connected'}
                    >
                      {paused ? '▶ Resume' : '⏸ Pause'}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setConfirmResign(true)} disabled={socketStatus !== 'connected'}>
                    ⚑ Resign
                  </Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => setFlipped((f) => !f)} aria-pressed={flipped}>
                ⇅ Flip
              </Button>
              <Button size="sm" variant="ghost" onClick={() => g.resync()} disabled={socketStatus !== 'connected'}>
                ↻ Resync
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <ConfirmModal
        open={confirmResign}
        title="Resign this game?"
        message={game.rated ? 'The game ends as a loss and affects your rating.' : 'The game ends as a loss.'}
        confirmLabel="Resign"
        loading={g.pending === 'game:resign'}
        onConfirm={async () => {
          if (await g.action('game:resign')) setConfirmResign(false)
        }}
        onCancel={() => setConfirmResign(false)}
      />
    </>
  )
}
