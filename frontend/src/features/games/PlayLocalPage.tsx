import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Button } from '../../components/ui/Button'
import { Card, CardBody } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import { gameKeys, gamesApi } from './api'
import { RestGameView } from './RestGameView'
import { useRestGame } from './useRestGame'

export function PlayLocalPage() {
  const [params, setParams] = useSearchParams()
  const gameId = params.get('game')
  const qc = useQueryClient()
  const toast = useToast()
  const [creating, setCreating] = useState(false)
  const { query, game, moves, optimistic, busy, move, runAction } = useRestGame(gameId)

  const start = async () => {
    setCreating(true)
    try {
      const g = await gamesApi.create({ mode: 'local' })
      qc.setQueryData(gameKeys.detail(g._id), g)
      void qc.invalidateQueries({ queryKey: gameKeys.all })
      setParams({ game: g._id })
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't start the game")
    } finally {
      setCreating(false)
    }
  }

  const back = (
    <Link to="/play" className="text-muted hover:text-fg">
      ← Play
    </Link>
  )

  if (!gameId) {
    return (
      <div className="mx-auto max-w-xl">
        <PageHeader title="Local game" description="Two players, one device. Pass the board after each move." back={back} />
        <Card>
          <CardBody className="space-y-4">
            <ul className="space-y-1.5 text-sm text-muted">
              <li>• Both sides move from this screen; turn on auto-flip to rotate the board each move.</li>
              <li>• Offer a draw or resign at any time (the side to move resigns).</li>
              <li>• Local games are casual and can be analyzed afterwards.</li>
            </ul>
            <Button size="lg" className="w-full" onClick={start} loading={creating}>
              Start local game
            </Button>
          </CardBody>
        </Card>
      </div>
    )
  }
  if (query.isPending) return <PageSpinner />
  if (query.isError || !game) return <ErrorState title="Couldn't load this game" error={query.error} onRetry={() => query.refetch()} />

  return (
    <>
      <PageHeader title="Local game" back={back} />
      <RestGameView
        key={game._id}
        game={game}
        moves={moves}
        thinking={!!optimistic}
        busy={busy}
        onMove={move}
        runAction={runAction}
        onNewGame={() => setParams({})}
      />
    </>
  )
}
