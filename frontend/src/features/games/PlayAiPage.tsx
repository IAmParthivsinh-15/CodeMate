import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Segmented } from '../../components/ui/Segmented'
import { Skeleton } from '../../components/ui/Skeleton'
import { PageSpinner } from '../../components/ui/Spinner'
import { Switch } from '../../components/ui/Switch'
import { useToast } from '../../components/ui/toastContext'
import { useMeta } from '../../hooks/useMeta'
import { errorMessage } from '../../services/apiClient'
import type { Difficulty } from '../../types/api'
import { titleCase } from '../../utils/format'
import { useAuth } from '../auth/authContext'
import { gameKeys, gamesApi } from './api'
import { RestGameView } from './RestGameView'
import { useRestGame } from './useRestGame'

type ColorChoice = 'white' | 'black' | 'random'

function AiSetup({ onCreated }: { onCreated: (id: string) => void }) {
  const { user } = useAuth()
  const meta = useMeta()
  const qc = useQueryClient()
  const toast = useToast()
  const [color, setColor] = useState<ColorChoice>('white')
  const [difficulty, setDifficulty] = useState<Difficulty>(user?.preferences?.defaultDifficulty ?? 'intermediate')
  const [rated, setRated] = useState(true)
  const [creating, setCreating] = useState(false)

  const start = async () => {
    setCreating(true)
    try {
      const game = await gamesApi.create({ mode: 'ai', color, difficulty, rated })
      qc.setQueryData(gameKeys.detail(game._id), game)
      void qc.invalidateQueries({ queryKey: gameKeys.all })
      onCreated(game._id)
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't start the game")
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Play vs Stockfish"
        description="Pick a side and a level. Finished games are analyzed automatically."
        back={
          <Link to="/play" className="text-muted hover:text-fg">
            ← Play
          </Link>
        }
      />
      <Card>
        <CardBody className="space-y-6">
          <Segmented<ColorChoice>
            label="Your colour"
            value={color}
            onChange={setColor}
            options={[
              { value: 'white', label: '♔ White' },
              { value: 'black', label: '♚ Black' },
              { value: 'random', label: '⚄ Random' },
            ]}
          />
          {meta.isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="grid grid-cols-3 gap-2">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            </div>
          ) : meta.isError ? (
            <ErrorState compact title="Couldn't load difficulty levels" error={meta.error} onRetry={() => meta.refetch()} />
          ) : (
            <Segmented<Difficulty>
              label="Difficulty"
              value={difficulty}
              onChange={setDifficulty}
              columns={3}
              options={meta.data.difficulties.map((d) => ({ value: d.key, label: titleCase(d.key), hint: `~${d.elo} Elo` }))}
            />
          )}
          <Switch checked={rated} onChange={setRated} label="Rated game" description="Rated games against the engine change your rating." />
          <Button size="lg" className="w-full" onClick={start} loading={creating} disabled={meta.isPending}>
            Start game
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}

export function PlayAiPage() {
  const [params, setParams] = useSearchParams()
  const gameId = params.get('game')
  const { query, game, moves, optimistic, busy, move, runAction } = useRestGame(gameId)

  if (!gameId) return <AiSetup onCreated={(id) => setParams({ game: id })} />
  if (query.isPending) return <PageSpinner />
  if (query.isError || !game) return <ErrorState title="Couldn't load this game" error={query.error} onRetry={() => query.refetch()} />

  return (
    <>
      <PageHeader
        title={`vs ${game.mode === 'ai' ? (game.yourColor === 'w' ? game.black.username : game.white.username) : 'AI'}`}
        docTitle="Play vs AI"
        back={
          <Link to="/play" className="text-muted hover:text-fg">
            ← Play
          </Link>
        }
      />
      <RestGameView
        key={game._id}
        game={game}
        moves={moves}
        thinking={!!optimistic || busy === 'move'}
        busy={busy}
        onMove={move}
        runAction={runAction}
        onNewGame={() => setParams({})}
      />
    </>
  )
}
