import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { THEME_LABELS, themeLabel } from '../../utils/chess'
import { cn } from '../../utils/cn'
import { colorName, titleCase } from '../../utils/format'
import { puzzlesApi, type PuzzleQuery } from './api'
import { PuzzleSolver } from './PuzzleSolver'

const THEME_OPTIONS = [{ value: '', label: 'All themes' }, ...Object.entries(THEME_LABELS).map(([value, label]) => ({ value, label }))]
const SOLVED_OPTIONS = [
  { value: '', label: 'All puzzles' },
  { value: 'false', label: 'Unsolved' },
  { value: 'true', label: 'Solved' },
]

export function PuzzlesPage() {
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('puzzle')
  const theme = params.get('theme') ?? ''
  const solved = (params.get('solved') ?? '') as '' | 'true' | 'false'
  const page = Number(params.get('page') ?? 1) || 1
  const q: PuzzleQuery = { page, limit: 12, theme: theme || undefined, solved: solved || undefined }

  const list = useQuery({ queryKey: ['puzzles', 'list', q], queryFn: () => puzzlesApi.list(q), placeholderData: keepPreviousData })
  const selected = useQuery({
    queryKey: ['puzzles', 'detail', selectedId],
    queryFn: () => puzzlesApi.get(selectedId!),
    enabled: !!selectedId,
  })
  const next = useQuery({
    queryKey: ['puzzles', 'next', theme],
    queryFn: () => puzzlesApi.next(theme || undefined),
    enabled: !selectedId,
  })

  const set = (patch: Record<string, string | null>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    setParams(n)
  }

  const active = selectedId ? selected.data : next.data
  const activeLoading = selectedId ? selected.isPending : next.isPending
  const activeError = selectedId ? selected.error : next.error

  const goNext = async () => {
    const p = await puzzlesApi.next(theme || undefined).catch(() => null)
    if (p && p._id !== active?._id) set({ puzzle: p._id })
    else set({ puzzle: null })
  }

  return (
    <>
      <PageHeader title="Puzzles" description="Positions from your own games where Stockfish found a better move." />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section aria-label="Current puzzle">
          {activeLoading ? (
            <Skeleton className="aspect-square w-full max-w-xl" />
          ) : activeError ? (
            <ErrorState title="Couldn't load the puzzle" error={activeError} onRetry={() => (selectedId ? selected.refetch() : next.refetch())} />
          ) : active ? (
            <PuzzleSolver key={active._id} puzzle={active} onNext={goNext} />
          ) : (
            <Card>
              <EmptyState
                icon="✦"
                title={list.data?.pagination.total ? 'All caught up' : 'No puzzles yet'}
                description={
                  list.data?.pagination.total
                    ? 'You have solved every open puzzle. Play and analyze more games to get new ones.'
                    : 'Puzzles are created from your mistakes once a game is analyzed. You can also press “Practice this position” on any mistake in an analysis.'
                }
                action={<ButtonLink to="/play/ai">Play a game</ButtonLink>}
              />
            </Card>
          )}
        </section>

        <aside aria-label="Puzzle list" className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Select aria-label="Filter by theme" options={THEME_OPTIONS} value={theme} onChange={(e) => set({ theme: e.target.value, page: null })} />
            <Select aria-label="Filter by status" options={SOLVED_OPTIONS} value={solved} onChange={(e) => set({ solved: e.target.value, page: null })} />
          </div>
          <Card>
            {list.isPending ? (
              <div className="space-y-2 p-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState compact title="Couldn't load puzzles" error={list.error} onRetry={() => list.refetch()} />
            ) : list.data.items.length === 0 ? (
              <p className="p-4 text-sm text-muted">No puzzles match.</p>
            ) : (
              <ul className="divide-y divide-line">
                {list.data.items.map((p) => (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => set({ puzzle: p._id })}
                      aria-current={active?._id === p._id ? 'true' : undefined}
                      className={cn('flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-surface-2', active?._id === p._id && 'bg-primary-soft')}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{themeLabel(p.theme)}</p>
                        <p className="text-xs text-muted">
                          {colorName(p.sideToMove)} to move · {titleCase(p.difficulty)}
                        </p>
                      </div>
                      {p.solved ? <Badge tone="success">Solved</Badge> : p.attempts > 0 ? <Badge tone="warning">{p.attempts} tries</Badge> : <Badge>New</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {list.data && (
              <div className="border-t border-line px-2">
                <Pagination info={list.data.pagination} onPage={(pg) => set({ page: String(pg) })} />
              </div>
            )}
          </Card>
        </aside>
      </div>
    </>
  )
}
