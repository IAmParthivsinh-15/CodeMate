import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Card } from '../../components/ui/Card'
import { Skeleton } from '../../components/ui/Skeleton'
import { formatRelative } from '../../utils/format'
import { gameKeys, gamesApi } from './api'
import { resumeHref } from './links'

const MODES = [
  { to: '/play/ai', icon: '♜', title: 'Play vs AI', text: 'Stockfish from beginner (~1000) to legendary (~2700). Rated or casual.' },
  { to: '/play/online', icon: '⚡', title: 'Play online', text: 'Quick match by time control, or a private room with a code for a friend.' },
  { to: '/play/local', icon: '⇄', title: 'Local game', text: 'Two players on one device. Great for over-the-board practice.' },
]

export function PlayHubPage() {
  const ongoing = useQuery({
    queryKey: gameKeys.list({ status: 'in_progress', limit: 5 }),
    queryFn: () => gamesApi.list({ status: 'in_progress', limit: 5 }),
  })

  return (
    <>
      <PageHeader title="Play" description="Every finished game feeds your analysis, puzzles and coach." />
      <div className="grid gap-4 sm:grid-cols-3">
        {MODES.map((m) => (
          <Link
            key={m.to}
            to={m.to}
            className="group rounded-card border border-line bg-surface p-5 shadow-card transition-colors hover:border-primary focus-visible:border-primary"
          >
            <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-2xl text-primary" aria-hidden="true">
              {m.icon}
            </div>
            <h2 className="mt-4 font-semibold group-hover:text-primary">{m.title}</h2>
            <p className="mt-1 text-sm text-muted">{m.text}</p>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <div className="border-b border-line px-5 py-3">
          <h2 className="font-semibold">Games in progress</h2>
        </div>
        {ongoing.isPending ? (
          <div className="space-y-2 p-5">
            <Skeleton className="h-10" />
            <Skeleton className="h-10" />
          </div>
        ) : ongoing.isError ? (
          <p className="p-5 text-sm text-muted">Couldn't load your ongoing games.</p>
        ) : ongoing.data.items.length === 0 ? (
          <p className="p-5 text-sm text-muted">No games in progress. Start one above.</p>
        ) : (
          <ul className="divide-y divide-line">
            {ongoing.data.items.map((g) => (
              <li key={g._id}>
                <Link to={resumeHref(g)} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{g.opponent}</p>
                    <p className="text-xs text-muted">
                      {g.plies} plies · started {formatRelative(g.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="primary">{g.mode}</Badge>
                    <span className="text-sm font-medium text-primary">Resume →</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
