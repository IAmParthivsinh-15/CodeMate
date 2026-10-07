import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import type { GameSummary } from '../../types/api'
import { endReasonLabel, formatDate, signed, titleCase } from '../../utils/format'
import { gameKeys, gamesApi } from './api'
import { AnalysisBadge, OutcomeBadge } from './GameBadges'
import { resumeHref } from './links'

const MODE_OPTIONS = [
  { value: '', label: 'All modes' },
  { value: 'ai', label: 'vs AI' },
  { value: 'online', label: 'Online' },
  { value: 'local', label: 'Local' },
]
const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'completed', label: 'Finished' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'abandoned', label: 'Aborted' },
]

function ratingDelta(g: GameSummary) {
  if (!g.ratingChange || !g.yourColor) return null
  const d = g.yourColor === 'w' ? g.ratingChange.white : g.ratingChange.black
  return d ?? null
}

function GameActions({ g }: { g: GameSummary }) {
  const live = g.status === 'in_progress' || g.status === 'waiting'
  if (live) {
    return (
      <ButtonLink to={resumeHref(g)} size="sm">
        Resume
      </ButtonLink>
    )
  }
  return (
    <div className="flex gap-1.5">
      <ButtonLink to={`/games/${g._id}`} size="sm" variant="secondary">
        Replay
      </ButtonLink>
      {g.plies > 0 && g.endReason !== 'aborted' && (
        <ButtonLink to={`/games/${g._id}/analysis`} size="sm" variant="secondary">
          Analysis
        </ButtonLink>
      )}
    </div>
  )
}

export function GamesListPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1
  const mode = params.get('mode') ?? ''
  const status = params.get('status') ?? ''
  const q = { page, limit: 15, mode: mode || undefined, status: status || undefined }
  const games = useQuery({ queryKey: gameKeys.list(q), queryFn: () => gamesApi.list(q), placeholderData: keepPreviousData })

  const update = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    if (k !== 'page') next.delete('page')
    setParams(next)
  }

  return (
    <>
      <PageHeader
        title="My games"
        description="Replay any game, download its PGN, or open the analysis."
        actions={<ButtonLink to="/play">New game</ButtonLink>}
      />
      <div className="mb-4 grid grid-cols-2 gap-3 sm:flex">
        <Select aria-label="Filter by mode" options={MODE_OPTIONS} value={mode} onChange={(e) => update('mode', e.target.value)} className="sm:w-40" />
        <Select aria-label="Filter by status" options={STATUS_OPTIONS} value={status} onChange={(e) => update('status', e.target.value)} className="sm:w-40" />
      </div>

      <Card>
        {games.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : games.isError ? (
          <ErrorState title="Couldn't load your games" error={games.error} onRetry={() => games.refetch()} />
        ) : games.data.items.length === 0 ? (
          <EmptyState
            icon="♟"
            title={mode || status ? 'No games match these filters' : 'No games yet'}
            description={mode || status ? 'Try another filter.' : 'Play your first game. It will show up here with its analysis.'}
            action={!mode && !status && <ButtonLink to="/play/ai">Play vs AI</ButtonLink>}
          />
        ) : (
          <>
            {/* Table on wide screens */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="border-b border-line text-left text-xs tracking-wide text-muted uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">Result</th>
                    <th className="px-4 py-3 font-medium">Opponent</th>
                    <th className="px-4 py-3 font-medium">Opening</th>
                    <th className="px-4 py-3 font-medium">Moves</th>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Analysis</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {games.data.items.map((g) => {
                    const d = ratingDelta(g)
                    return (
                      <tr key={g._id} className="hover:bg-surface-2">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <OutcomeBadge outcome={g.outcome} status={g.status} />
                            {d != null && <span className={d >= 0 ? 'text-xs text-success' : 'text-xs text-danger'}>{signed(d)}</span>}
                          </div>
                          {g.endReason && <p className="mt-0.5 text-xs text-muted">{endReasonLabel(g.endReason)}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/games/${g._id}`} className="font-medium hover:text-primary">
                            {g.opponent}
                          </Link>
                          <p className="text-xs text-muted">
                            {titleCase(g.mode)}
                            {g.rated ? ' · rated' : ''}
                            {g.yourColor ? ` · as ${g.yourColor === 'w' ? 'white' : 'black'}` : ''}
                          </p>
                        </td>
                        <td className="max-w-56 truncate px-4 py-3 text-muted" title={g.opening ?? undefined}>
                          {g.opening ?? '—'}
                        </td>
                        <td className="px-4 py-3 tabular-nums">{Math.ceil(g.plies / 2)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-muted">{formatDate(g.createdAt)}</td>
                        <td className="px-4 py-3">
                          <AnalysisBadge status={g.analysisStatus} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <GameActions g={g} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Cards on small screens */}
            <ul className="divide-y divide-line md:hidden">
              {games.data.items.map((g) => (
                <li key={g._id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{g.opponent}</span>
                    <OutcomeBadge outcome={g.outcome} status={g.status} />
                  </div>
                  <div className="flex flex-wrap gap-1.5 text-xs text-muted">
                    <Badge>{titleCase(g.mode)}</Badge>
                    <AnalysisBadge status={g.analysisStatus} />
                    <span>{formatDate(g.createdAt)}</span>
                    <span>· {Math.ceil(g.plies / 2)} moves</span>
                  </div>
                  {g.opening && <p className="truncate text-xs text-muted">{g.opening}</p>}
                  <GameActions g={g} />
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-3">
              <Pagination info={games.data.pagination} onPage={(p) => update('page', String(p))} />
            </div>
          </>
        )}
      </Card>
    </>
  )
}
