import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { ButtonLink } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Modal } from '../../components/ui/Modal'
import { Pagination } from '../../components/ui/Pagination'
import { Select } from '../../components/ui/Select'
import { Skeleton } from '../../components/ui/Skeleton'
import type { Submission } from '../../types/api'
import { formatDateTime } from '../../utils/format'
import { codingApi, LANGUAGE_LABEL } from './api'
import { CodeEditor } from './CodeEditor'
import { SubmissionResult } from './SubmissionResult'
import { SubmissionStatusBadge } from './SubmissionStatusBadge'

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'wrong_answer', label: 'Wrong answer' },
  { value: 'compilation_error', label: 'Compilation error' },
  { value: 'runtime_error', label: 'Runtime error' },
  { value: 'time_limit_exceeded', label: 'Time limit exceeded' },
]

const problemOf = (s: Submission) => (s.problem && typeof s.problem === 'object' ? s.problem : null)

function SubmissionDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['submission', id], queryFn: () => codingApi.submission(id!), enabled: !!id })
  const s = detail.data
  return (
    <Modal open={!!id} onClose={onClose} size="lg" title={s ? (problemOf(s)?.title ?? 'Submission') : 'Submission'}>
      {detail.isPending ? (
        <Skeleton className="h-40" />
      ) : detail.isError ? (
        <ErrorState compact error={detail.error} onRetry={() => detail.refetch()} />
      ) : s ? (
        <div className="space-y-4">
          <SubmissionResult submission={s} />
          {s.code && <CodeEditor value={s.code} onChange={() => undefined} language={s.language} readOnly height="16rem" ariaLabel="Submitted code" />}
        </div>
      ) : null}
    </Modal>
  )
}

export function SubmissionsPage() {
  const [params, setParams] = useSearchParams()
  const page = Number(params.get('page') ?? 1) || 1
  const status = params.get('status') ?? ''
  const [openId, setOpenId] = useState<string | null>(null)
  const q = { page, limit: 20, status: status || undefined }
  const subs = useQuery({ queryKey: ['coding', 'submissions', q], queryFn: () => codingApi.submissions(q), placeholderData: keepPreviousData })

  return (
    <>
      <PageHeader
        title="My submissions"
        back={
          <Link to="/coding" className="text-muted hover:text-fg">
            ← Problems
          </Link>
        }
      />
      <div className="mb-4 w-full sm:w-56">
        <Select
          aria-label="Filter by status"
          options={STATUS_OPTIONS}
          value={status}
          onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}
        />
      </div>
      <Card>
        {subs.isPending ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        ) : subs.isError ? (
          <ErrorState title="Couldn't load submissions" error={subs.error} onRetry={() => subs.refetch()} />
        ) : subs.data.items.length === 0 ? (
          <EmptyState icon="⇪" title="No submissions yet" description="Solve a problem to see your history here." action={<ButtonLink to="/coding">Browse problems</ButtonLink>} />
        ) : (
          <>
            <ul className="divide-y divide-line">
              {subs.data.items.map((s) => {
                const p = problemOf(s)
                return (
                  <li key={s._id}>
                    <button type="button" onClick={() => setOpenId(s._id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left hover:bg-surface-2">
                      <span className="min-w-0 flex-1 truncate font-medium">{p?.title ?? 'Deleted problem'}</span>
                      <SubmissionStatusBadge status={s.status} />
                      <span className="w-20 text-xs text-muted">{LANGUAGE_LABEL[s.language] ?? s.language}</span>
                      <span className="w-16 text-xs text-muted">{s.kind === 'run' ? 'Run' : 'Submit'}</span>
                      <span className="w-20 text-xs text-muted tabular-nums">
                        {s.totalCount ? `${s.passedCount}/${s.totalCount}` : '—'}
                      </span>
                      <span className="text-xs text-muted">{formatDateTime(s.createdAt)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-line px-3">
              <Pagination
                info={subs.data.pagination}
                onPage={(pg) => setParams({ ...(status ? { status } : {}), page: String(pg) })}
              />
            </div>
          </>
        )}
      </Card>
      <SubmissionDetail id={openId} onClose={() => setOpenId(null)} />
    </>
  )
}
