import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useSocketEvent } from '../../app/socketContext'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { ErrorState } from '../../components/ui/ErrorState'
import { Markdown } from '../../components/ui/Markdown'
import { Select } from '../../components/ui/Select'
import { PageSpinner } from '../../components/ui/Spinner'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage, isApiError } from '../../services/apiClient'
import type { CodeLanguage, Problem } from '../../types/api'
import { titleCase } from '../../utils/format'
import { ME_QUERY_KEY, useAuth } from '../auth/authContext'
import { codingApi, isFinalStatus, LANGUAGE_LABEL } from './api'
import { CodeEditor } from './CodeEditor'
import { ExecutionBanner } from './ExecutionBanner'
import { difficultyTone, useLanguages } from './hooks'
import { SubmissionResult } from './SubmissionResult'

const draftKey = (problemId: string, lang: string) => `codemate.code.${problemId}.${lang}`

function readDraft(problem: Problem, lang: CodeLanguage): string {
  try {
    const d = localStorage.getItem(draftKey(problem._id, lang))
    if (d != null) return d
  } catch {
    // Storage unavailable.
  }
  return problem.starterCode?.[lang] ?? ''
}

export function ProblemPage() {
  const { problemId = '' } = useParams()
  const problem = useQuery({ queryKey: ['coding', 'problem', problemId], queryFn: () => codingApi.problem(problemId) })
  if (problem.isPending) return <PageSpinner />
  if (problem.isError) return <ErrorState title="Couldn't load this problem" error={problem.error} onRetry={() => problem.refetch()} />
  return <ProblemWorkspace key={problem.data._id} problem={problem.data} />
}

function ProblemWorkspace({ problem }: { problem: Problem }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const langs = useLanguages()
  const available = (langs.data?.languages ?? []).map((l) => l.key)
  const preferred = (user?.codingStats?.preferredLanguage ?? 'javascript') as CodeLanguage
  const [language, setLanguage] = useState<CodeLanguage>(preferred)
  const [code, setCode] = useState(() => readDraft(problem, preferred))
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [sending, setSending] = useState<null | 'run' | 'submit'>(null)
  const [execError, setExecError] = useState<string | null>(null)
  const announced = useRef<string | null>(null)

  const executionAvailable = langs.data?.executionAvailable ?? true

  // Persist drafts per language.
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        localStorage.setItem(draftKey(problem._id, language), code)
      } catch {
        // ignore
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [code, language, problem._id])

  const submission = useQuery({
    queryKey: ['submission', submissionId],
    queryFn: () => codingApi.submission(submissionId!),
    enabled: !!submissionId,
    // Poll every second until judged; the socket event also refreshes it.
    refetchInterval: (q) => (q.state.data && isFinalStatus(q.state.data.status) ? false : 1000),
  })

  useSocketEvent<{ submissionId: string }>('submission:update', (p) => {
    if (p.submissionId === submissionId) void submission.refetch()
  })

  useEffect(() => {
    const s = submission.data
    if (!s || !isFinalStatus(s.status) || announced.current === s._id) return
    announced.current = s._id
    if (s.kind === 'submit') {
      void qc.invalidateQueries({ queryKey: ['coding', 'problems'] })
      void qc.invalidateQueries({ queryKey: ['dashboard'] })
      if (s.firstAccept) {
        void qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
        toast.success('First solve! You earned a chess hint credit.', 'Accepted')
      } else if (s.status === 'accepted') toast.success('All tests passed.', 'Accepted')
    }
  }, [submission.data, qc, toast])

  const changeLanguage = (l: CodeLanguage) => {
    setLanguage(l)
    setCode(readDraft(problem, l))
  }

  const resetCode = () => setCode(problem.starterCode?.[language] ?? '')

  const send = async (kind: 'run' | 'submit') => {
    setExecError(null)
    setSending(kind)
    try {
      const s = await codingApi.submit({ problemId: problem._id, language, code, kind })
      qc.setQueryData(['submission', s._id], s)
      setSubmissionId(s._id)
    } catch (err) {
      if (isApiError(err) && err.code === 'EXECUTION_UNAVAILABLE') {
        setExecError('Code execution is not configured on this server, so your code could not be run. Your code is saved in this browser.')
      } else if (isApiError(err) && err.code === 'RATE_LIMITED') {
        setExecError('You are submitting too quickly. Wait a few seconds and try again.')
      } else {
        toast.error(errorMessage(err), 'Submission failed')
      }
    } finally {
      setSending(null)
    }
  }

  const judging = !!submission.data && !isFinalStatus(submission.data.status)
  const langOptions = (available.length ? available : (['javascript', 'python', 'java', 'cpp'] as CodeLanguage[])).map((k) => ({
    value: k,
    label: LANGUAGE_LABEL[k] ?? k,
  }))

  return (
    <>
      <PageHeader
        title={problem.title}
        back={
          <Link to="/coding" className="text-muted hover:text-fg">
            ← Problems
          </Link>
        }
        actions={
          <div className="flex items-center gap-2">
            {problem.solved && <Badge tone="success">✓ Solved</Badge>}
            <Badge tone={difficultyTone(problem.difficulty)}>{titleCase(problem.difficulty)}</Badge>
          </div>
        }
      />
      <ExecutionBanner className="mb-4" />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="min-w-0">
          <CardBody className="space-y-5">
            <div className="flex flex-wrap gap-1.5">
              {problem.tags.map((t) => (
                <Badge key={t}>#{t}</Badge>
              ))}
              <Badge tone="info">{problem.mode === 'function' ? 'Function' : 'Standard I/O'}</Badge>
            </div>
            <Markdown className="text-[0.9rem]">{problem.statement}</Markdown>
            {problem.inputFormat && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Input</h3>
                <Markdown className="text-muted">{problem.inputFormat}</Markdown>
              </section>
            )}
            {problem.outputFormat && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Output</h3>
                <Markdown className="text-muted">{problem.outputFormat}</Markdown>
              </section>
            )}
            {problem.constraints && (
              <section>
                <h3 className="mb-1 text-sm font-semibold">Constraints</h3>
                <Markdown className="text-muted">{problem.constraints}</Markdown>
              </section>
            )}
            {problem.samples.length > 0 && (
              <section className="space-y-3">
                <h3 className="text-sm font-semibold">Examples</h3>
                {problem.samples.map((s, i) => (
                  <div key={i} className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <p className="mb-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">Input {i + 1}</p>
                      <pre className="overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-xs whitespace-pre-wrap">{s.input}</pre>
                    </div>
                    <div>
                      <p className="mb-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">Output {i + 1}</p>
                      <pre className="overflow-x-auto rounded-md bg-surface-2 p-2 font-mono text-xs whitespace-pre-wrap">{s.output}</pre>
                    </div>
                  </div>
                ))}
              </section>
            )}
            <p className="text-xs text-subtle">
              {problem.timeLimitSec ? `Time limit ${problem.timeLimitSec}s` : ''}
              {problem.memoryLimitKb ? ` · Memory ${Math.round(problem.memoryLimitKb / 1024)} MB` : ''}
            </p>
          </CardBody>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line p-3">
              <div className="w-40">
                <Select aria-label="Language" options={langOptions} value={language} onChange={(e) => changeLanguage(e.target.value as CodeLanguage)} />
              </div>
              <Button variant="ghost" size="sm" onClick={resetCode}>
                Reset to starter code
              </Button>
            </div>
            <div className="p-3">
              <CodeEditor value={code} onChange={setCode} language={language} height="min(28rem, 55vh)" />
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line p-3">
              {!executionAvailable && <span className="mr-auto text-xs text-muted">Run and Submit are unavailable on this server.</span>}
              <Button variant="secondary" onClick={() => send('run')} loading={sending === 'run'} disabled={!executionAvailable || !!sending || judging || !code.trim()}>
                ▶ Run samples
              </Button>
              <Button onClick={() => send('submit')} loading={sending === 'submit'} disabled={!executionAvailable || !!sending || judging || !code.trim()}>
                Submit
              </Button>
            </div>
          </Card>

          {execError && (
            <div role="alert" className="rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning">
              {execError}
            </div>
          )}

          {submissionId && (
            <Card>
              <CardHeader title="Result" />
              <CardBody>
                {submission.isPending ? (
                  <p className="text-sm text-muted">Waiting for the judge…</p>
                ) : submission.isError ? (
                  <ErrorState compact title="Couldn't load the result" error={submission.error} onRetry={() => submission.refetch()} />
                ) : (
                  <SubmissionResult submission={submission.data} />
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
