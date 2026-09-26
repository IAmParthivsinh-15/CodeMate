import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Input } from '../../components/ui/Input'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import { titleCase } from '../../utils/format'
import { useAuth } from '../auth/authContext'
import { codingApi } from './api'
import { difficultyTone } from './hooks'
import { ExecutionBanner } from './ExecutionBanner'

const DIFFICULTY_OPTIONS = [
  { value: '', label: 'Any difficulty' },
  ...['beginner', 'intermediate', 'advanced', 'master', 'grandmaster', 'legendary'].map((d) => ({ value: d, label: titleCase(d) })),
]

export function ProblemListPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1
  const difficulty = params.get('difficulty') ?? ''
  const tag = params.get('tag') ?? ''
  const search = params.get('search') ?? ''
  const [searchText, setSearchText] = useState(search)

  const set = (patch: Record<string, string>) => {
    const n = new URLSearchParams(params)
    for (const [k, v] of Object.entries(patch)) {
      if (v) n.set(k, v)
      else n.delete(k)
    }
    if (!('page' in patch)) n.delete('page')
    setParams(n, { replace: true })
  }

  // Debounced search.
  useEffect(() => {
    if (searchText === search) return
    const t = window.setTimeout(() => set({ search: searchText.trim() }), 300)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchText])

  const q = { page, limit: 20, difficulty: difficulty || undefined, tag: tag || undefined, search: search || undefined }
  const problems = useQuery({ queryKey: ['coding', 'problems', q], queryFn: () => codingApi.problems(q), placeholderData: keepPreviousData })
  const tags = useQuery({ queryKey: ['coding', 'tags'], queryFn: codingApi.tags, staleTime: 10 * 60_000 })

  return (
    <>
      <PageHeader
        title="Coding problems"
        description={
          <>
            Solve a problem for the first time to earn a chess hint credit (you have <strong className="text-fg">{user?.hintCredits ?? 0}</strong>).
          </>
        }
        actions={
          <ButtonLink to="/coding/submissions" variant="secondary">
            My submissions
          </ButtonLink>
        }
      />
      <ExecutionBanner className="mb-4" />
      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_12rem]">
        <Input aria-label="Search problems" placeholder="Search by title…" value={searchText} onChange={(e) => setSearchText(e.target.value)} type="search" />
        <Select aria-label="Difficulty" options={DIFFICULTY_OPTIONS} value={difficulty} onChange={(e) => set({ difficulty: e.target.value })} />
        <Select
          aria-label="Tag"
          options={[{ value: '', label: 'Any tag' }, ...(tags.data ?? []).map((t) => ({ value: t, label: t }))]}
          value={tag}
          onChange={(e) => set({ tag: e.target.value })}
        />
      </div>

      <Card>
        {problems.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : problems.isError ? (
          <ErrorState title="Couldn't load problems" error={problems.error} onRetry={() => problems.refetch()} />
        ) : problems.data.items.length === 0 ? (
          <EmptyState icon="</>" title="No problems found" description={search || tag || difficulty ? 'Try clearing the filters.' : 'No problems have been published yet.'} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {problems.data.items.map((p) => (
                <li key={p._id}>
                  <Link to={`/coding/${p.slug || p._id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span
                      className={p.solved ? 'text-success' : 'text-subtle'}
                      aria-label={p.solved ? 'Solved' : 'Not solved'}
                      title={p.solved ? 'Solved' : 'Not solved'}
                    >
                      {p.solved ? '✓' : '○'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.title}</p>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {p.tags.slice(0, 4).map((t) => (
                          <span key={t} className="text-xs text-muted">
                            #{t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Badge tone={difficultyTone(p.difficulty)}>{titleCase(p.difficulty)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="border-t border-line px-3">
              <Pagination info={problems.data.pagination} onPage={(pg) => set({ page: String(pg) })} />
            </div>
          </>
        )}
      </Card>
    </>
  )
}
