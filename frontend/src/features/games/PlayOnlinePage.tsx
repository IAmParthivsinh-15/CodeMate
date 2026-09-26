import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useSocket, useSocketEvent } from '../../app/socketContext'
import { ConnectionIndicator } from '../../components/layout/ConnectionIndicator'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Segmented } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { Spinner } from '../../components/ui/Spinner'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/toastContext'
import { useMeta } from '../../hooks/useMeta'
import { errorMessage } from '../../services/apiClient'
import { emitAck } from '../../services/socket'
import type { Game } from '../../types/api'
import { formatDuration } from '../../utils/format'

type ColorChoice = 'white' | 'black' | 'random'

function TimeControlPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const meta = useMeta()
  if (meta.isPending) return <Skeleton className="h-16" />
  if (meta.isError) return <ErrorState compact title="Couldn't load time controls" error={meta.error} onRetry={() => meta.refetch()} />
  return (
    <Segmented
      label="Time control"
      value={value}
      onChange={onChange}
      columns={Math.min(5, meta.data.timeControls.length)}
      options={meta.data.timeControls.map((t) => ({ value: t.key, label: t.key, hint: t.label.split(' ')[0] }))}
    />
  )
}

function QuickMatch() {
  const { socket, status } = useSocket()
  const navigate = useNavigate()
  const toast = useToast()
  const [timeControl, setTimeControl] = useState('5+0')
  const [rated, setRated] = useState(true)
  const [queuedAt, setQueuedAt] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const queuedRef = useRef(false)

  useEffect(() => {
    queuedRef.current = queuedAt != null
    if (queuedAt == null) return
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [queuedAt])

  // Restore the queue state (e.g. after a refresh while queued).
  useEffect(() => {
    if (!socket || status !== 'connected') return
    emitAck<{ queued: boolean; waitingMs?: number }>(socket, 'matchmaking:status', {})
      .then((r) => {
        if (r.queued) setQueuedAt(Date.now() - (r.waitingMs ?? 0))
      })
      .catch(() => undefined)
  }, [socket, status])

  // Leave the queue when leaving the lobby.
  useEffect(() => {
    return () => {
      if (queuedRef.current && socket?.connected) emitAck(socket, 'matchmaking:leave', {}).catch(() => undefined)
    }
  }, [socket])

  useSocketEvent<{ gameId: string }>('matchmaking:matched', (p) => {
    queuedRef.current = false
    setQueuedAt(null)
    toast.success('Opponent found!')
    navigate(`/play/online/${p.gameId}`)
  })

  const join = async () => {
    if (!socket) return
    setBusy(true)
    try {
      await emitAck(socket, 'matchmaking:join', { timeControl, rated })
      setNow(Date.now())
      setQueuedAt(Date.now())
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't join the queue")
    } finally {
      setBusy(false)
    }
  }

  const leave = async () => {
    if (!socket) return
    setBusy(true)
    try {
      await emitAck(socket, 'matchmaking:leave', {})
    } catch {
      // The server also drops us from the queue on disconnect.
    } finally {
      setQueuedAt(null)
      setBusy(false)
    }
  }

  const connected = status === 'connected'
  return (
    <Card>
      <CardHeader title="Quick match" subtitle="Get paired with a player near your rating." />
      <CardBody className="space-y-5">
        {queuedAt != null ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
            <Spinner className="scale-150 text-primary" />
            <p className="font-medium">Looking for an opponent…</p>
            <p className="font-mono text-2xl tabular-nums">{formatDuration(now - queuedAt)}</p>
            <p className="text-xs text-muted">
              {timeControl} · {rated ? 'Rated' : 'Casual'}
            </p>
            <Button variant="secondary" onClick={leave} loading={busy}>
              Cancel
            </Button>
          </div>
        ) : (
          <>
            <TimeControlPicker value={timeControl} onChange={setTimeControl} />
            <Switch checked={rated} onChange={setRated} label="Rated" description="Only rated players are paired with rated seekers." />
            <Button className="w-full" size="lg" onClick={join} loading={busy} disabled={!connected}>
              Find opponent
            </Button>
          </>
        )}
      </CardBody>
    </Card>
  )
}

function PrivateRoom() {
  const { socket, status } = useSocket()
  const navigate = useNavigate()
  const toast = useToast()
  const [timeControl, setTimeControl] = useState('10+0')
  const [color, setColor] = useState<ColorChoice>('random')
  const [rated, setRated] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState<null | 'create' | 'join'>(null)
  const connected = status === 'connected'

  const create = async () => {
    if (!socket) return
    setBusy('create')
    try {
      const res = await emitAck<{ game: Game }>(socket, 'room:create', { timeControl, rated, color })
      navigate(`/play/online/${res.game._id}`)
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't create the room")
      setBusy(null)
    }
  }

  const join = async (e: FormEvent) => {
    e.preventDefault()
    const roomCode = code.trim().toUpperCase()
    if (!socket || roomCode.length < 4) return
    setBusy('join')
    try {
      const res = await emitAck<{ game: Game; started: boolean }>(socket, 'room:join', { roomCode })
      navigate(`/play/online/${res.game._id}`)
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't join the room")
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader title="Play a friend" subtitle="Create a private room and share the code, or join one." />
      <CardBody className="space-y-5">
        <TimeControlPicker value={timeControl} onChange={setTimeControl} />
        <Segmented<ColorChoice>
          label="Your colour"
          value={color}
          onChange={setColor}
          options={[
            { value: 'white', label: 'White' },
            { value: 'random', label: 'Random' },
            { value: 'black', label: 'Black' },
          ]}
        />
        <Switch checked={rated} onChange={setRated} label="Rated" description="Casual rooms can be paused." />
        <Button className="w-full" onClick={create} loading={busy === 'create'} disabled={!connected || busy === 'join'}>
          Create room
        </Button>

        <div className="relative py-1 text-center text-xs text-subtle">
          <span className="relative z-10 bg-surface px-2">or</span>
          <span className="absolute inset-x-0 top-1/2 border-t border-line" aria-hidden="true" />
        </div>

        <form onSubmit={join} className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Join a room"
              placeholder="ABC123"
              value={code}
              maxLength={8}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="font-mono tracking-widest uppercase"
              autoComplete="off"
            />
          </div>
          <Button type="submit" variant="secondary" loading={busy === 'join'} disabled={!connected || code.trim().length < 4 || busy === 'create'}>
            Join
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}

export function PlayOnlinePage() {
  const { status } = useSocket()
  return (
    <>
      <PageHeader
        title="Play online"
        description="Live games with server-side clocks. If you disconnect, you have 60 seconds to come back."
        back={
          <Link to="/play" className="text-muted hover:text-fg">
            ← Play
          </Link>
        }
        actions={<ConnectionIndicator showLabel className="rounded-full border border-line bg-surface px-3 py-1.5" />}
      />
      {status !== 'connected' && (
        <div role="status" className="mb-4 flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
          {status === 'offline' ? 'Offline: online play needs a live connection.' : <><Spinner /> Connecting to the game server…</>}
        </div>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        <QuickMatch />
        <PrivateRoom />
      </div>
    </>
  )
}
