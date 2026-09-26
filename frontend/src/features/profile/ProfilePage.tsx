import { useQuery } from '@tanstack/react-query'
import { PageHeader } from '../../components/layout/PageHeader'
import { ButtonLink } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton } from '../../components/ui/Skeleton'
import { StatTile } from '../../components/ui/StatTile'
import { formatDate, formatNumber, formatPercent } from '../../utils/format'
import { useUser } from '../auth/authContext'
import { LANGUAGE_LABEL } from '../coding/api'
import { RatingChart } from '../dashboard/RatingChart'
import { usersApi } from './api'

export function ProfilePage() {
  const user = useUser()
  const stats = useQuery({ queryKey: ['users', 'me', 'statistics'], queryFn: usersApi.statistics })
  const history = useQuery({ queryKey: ['users', 'me', 'rating-history'], queryFn: usersApi.ratingHistory })
  const cs = user.chessStats
  const decided = cs.wins + cs.losses + cs.draws

  return (
    <>
      <PageHeader title="Profile" actions={<ButtonLink to="/settings" variant="secondary">Settings</ButtonLink>} />
      <Card className="mb-5">
        <CardBody className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 place-items-center rounded-full bg-primary-soft text-2xl font-semibold text-primary" aria-hidden="true">
            {user.username.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold">{user.username}</p>
            <p className="truncate text-sm text-muted">{user.email}</p>
            <p className="text-xs text-subtle">Member since {formatDate(user.createdAt)}</p>
          </div>
          <div className="rounded-xl border border-line bg-surface-2 px-4 py-2 text-center">
            <p className="text-xs text-muted">Hint credits</p>
            <p className="text-2xl font-semibold tabular-nums">{user.hintCredits}</p>
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Rating" value={cs.rating} hint={`Peak ${cs.peakRating}`} tone="primary" />
        <StatTile label="Games" value={cs.gamesPlayed} hint={`${cs.wins}W · ${cs.draws}D · ${cs.losses}L`} />
        <StatTile label="Win rate" value={decided ? formatPercent((cs.wins / decided) * 100) : '—'} />
        <StatTile label="Problems solved" value={user.codingStats.problemsSolved} hint={LANGUAGE_LABEL[user.codingStats.preferredLanguage] ?? user.codingStats.preferredLanguage} />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader title="Rating history" />
          <CardBody>
            {history.isPending ? (
              <Skeleton className="h-52" />
            ) : history.isError ? (
              <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
            ) : history.data.history.length === 0 ? (
              <EmptyState compact title="No rated games yet" description="Play a rated game to start your rating history." action={<ButtonLink to="/play/ai" size="sm">Play rated</ButtonLink>} />
            ) : (
              <RatingChart
                startRating={history.data.history[0].before}
                points={history.data.history.map((h) => ({ at: h.createdAt, rating: h.after, delta: h.delta }))}
                height={220}
              />
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Analysis stats" />
          <CardBody>
            {stats.isPending ? (
              <Skeleton className="h-40" />
            ) : stats.isError ? (
              <ErrorState compact error={stats.error} onRetry={() => stats.refetch()} />
            ) : (
              <dl className="space-y-2 text-sm">
                {[
                  ['Games analyzed', formatNumber(stats.data.chess.gamesAnalyzed)],
                  ['Accuracy', formatPercent(stats.data.chess.accuracy)],
                  ['Avg. centipawn loss', formatNumber(stats.data.chess.averageCentipawnLoss)],
                  ['Code submissions', formatNumber(stats.data.coding.submissions)],
                  ['Acceptance rate', formatPercent(stats.data.coding.acceptanceRate)],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-2">
                    <dt className="text-muted">{k}</dt>
                    <dd className="font-medium tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  )
}
