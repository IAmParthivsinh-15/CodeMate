import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useSocketEvent } from '../../app/socketContext'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { ErrorState } from '../../components/ui/ErrorState'
import { Markdown } from '../../components/ui/Markdown'
import { Select } from '../../components/ui/Select'
import { PageSpinner, Spinner } from '../../components/ui/Spinner'
import { SplitPane } from '../../components/ui/SplitPane'
import { useToast } from '../../components/ui/toastContext'
import { useMediaQuery } from '../../hooks/useMediaQuery'
import { errorMessage, isApiError } from '../../services/apiClient'
import type { CodeLanguage, Problem, Submission, TestResult } from '../../types/api'
import { cn } from '../../utils/cn'
import { formatRelative, titleCase } from '../../utils/format'
import { safeReturnTo } from '../../utils/returnTo'
import { ME_QUERY_KEY, useAuth } from '../auth/authContext'
import { codingApi, isFinalStatus, LANGUAGE_LABEL } from './api'
import { CodeEditor } from './CodeEditor'
import { difficultyTone, useLanguages } from './hooks'
import { statusMeta } from './statusMeta'
import { SubmissionStatusBadge } from './SubmissionStatusBadge'

const draftKey = (problemId: string, lang: string) => `codemate.code.${problemId}.${lang}`
const REDIRECT_SECONDS = 3

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

type LeftTab = 'description' | 'submissions'
type ConsoleTab = 'testcase' | 'result'

/** LeetCode-style workspace: statement | editor over a test console, all resizable. */
function ProblemWorkspace({ problem }: { problem: Problem }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const returnTo = safeReturnTo(params.get('returnTo'))
  const wide = useMediaQuery('(min-width: 1024px)')

  const langs = useLanguages()
  const available = (langs.data?.languages ?? []).map((l) => l.key)
  const executionAvailable = langs.data?.executionAvailable ?? true
  const preferred = (user?.codingStats?.preferredLanguage ?? 'javascript') as CodeLanguage
  const [language, setLanguage] = useState<CodeLanguage>(preferred)
  const [code, setCode] = useState(() => readDraft(problem, preferred))

  const [leftTab, setLeftTab] = useState<LeftTab>('description')
  const [consoleTab, setConsoleTab] = useState<ConsoleTab>('testcase')
  const [selectedCase, setSelectedCase] = useState(0)
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [sending, setSending] = useState<null | 'run' | 'submit'>(null)
  const [execError, setExecError] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number | null>(null)
  const announced = useRef<string | null>(null)

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

  // React once to each finished submission: refresh data, celebrate, start the redirect.
  useEffect(() => {
    const s = submission.data
    if (!s || !isFinalStatus(s.status) || announced.current === s._id) return
    announced.current = s._id
    if (s.kind !== 'submit') return
    void qc.invalidateQueries({ queryKey: ['coding'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
    if (s.firstAccept) {
      void qc.invalidateQueries({ queryKey: ME_QUERY_KEY })
      if (returnTo) setCountdown(REDIRECT_SECONDS)
      else toast.success('First solve! You earned a chess hint credit.', 'Accepted')
    } else if (s.status === 'accepted') {
      toast.success(returnTo ? 'Accepted, but you had already solved this one, so no new hint.' : 'All tests passed.', 'Accepted')
    }
  }, [submission.data, qc, toast, returnTo])

  // Automatic redirect back to the game after a hint-earning solve.
  useEffect(() => {
    if (countdown == null || !returnTo) return
    if (countdown <= 0) {
      navigate(returnTo)
      return
    }
    const t = window.setTimeout(() => setCountdown((c) => (c == null ? c : c - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [countdown, returnTo, navigate])

  const changeLanguage = (l: CodeLanguage) => {
    setLanguage(l)
    setCode(readDraft(problem, l))
  }

  const judging = !!submission.data && !isFinalStatus(submission.data.status)
  const canSend = executionAvailable && !sending && !judging && !!code.trim()

  const send = useCallback(
    async (kind: 'run' | 'submit') => {
      setExecError(null)
      setSending(kind)
      setConsoleTab('result')
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
          setExecError(errorMessage(err))
        }
      } finally {
        setSending(null)
      }
    },
    [problem._id, language, code, qc],
  )

  // Shortcuts: Ctrl/Cmd+' runs samples, Ctrl/Cmd+Enter submits.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || !canSend) return
      if (e.key === 'Enter') {
        e.preventDefault()
        void send('submit')
      } else if (e.key === "'") {
        e.preventDefault()
        void send('run')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canSend, send])

  const langOptions = (available.length ? available : (['javascript', 'python', 'java', 'cpp'] as CodeLanguage[])).map((k) => ({
    value: k,
    label: LANGUAGE_LABEL[k] ?? k,
  }))

  const toolbar = (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2">
      <Link to="/coding" className="text-sm text-muted hover:text-fg">
        ← Problems
      </Link>
      <span className="mx-1 hidden h-4 w-px bg-line sm:block" />
      <h1 className="min-w-0 truncate text-sm font-semibold">{problem.title}</h1>
      <div className="ml-auto flex items-center gap-2 lg:absolute lg:left-1/2 lg:ml-0 lg:-translate-x-1/2">
        <Button variant="secondary" size="sm" onClick={() => send('run')} loading={sending === 'run'} disabled={!canSend} title="Run sample tests (Ctrl+')">
          ▶ Run
        </Button>
        <Button size="sm" onClick={() => send('submit')} loading={sending === 'submit'} disabled={!canSend} title="Submit (Ctrl+Enter)">
          ☁ Submit
        </Button>
      </div>
      {returnTo && (
        <Link to={returnTo} className="hidden rounded-full bg-primary-soft px-2.5 py-1 text-xs font-medium text-primary hover:underline lg:ml-auto lg:inline">
          ♟ Back to game
        </Link>
      )}
    </div>
  )

  const left = (
    <Panel
      header={
        <PanelTabs
          value={leftTab}
          onChange={setLeftTab}
          tabs={[
            { value: 'description', label: '📄 Description' },
            { value: 'submissions', label: '🕘 Submissions' },
          ]}
        />
      }
    >
      {leftTab === 'description' ? <Description problem={problem} earningHint={!!returnTo} /> : <ProblemSubmissions problemId={problem._id} onOpen={(id) => { setSubmissionId(id); setConsoleTab('result') }} />}
    </Panel>
  )

  const editor = (
    <Panel
      header={
        <div className="flex w-full items-center gap-2 px-2">
          <span className="text-sm font-medium text-success">{'</>'}</span>
          <span className="text-sm font-medium">Code</span>
          <div className="ml-auto w-36">
            <Select aria-label="Language" options={langOptions} value={language} onChange={(e) => changeLanguage(e.target.value as CodeLanguage)} className="h-8 py-0 text-xs" />
          </div>
          <button
            type="button"
            onClick={() => setCode(problem.starterCode?.[language] ?? '')}
            title="Reset to starter code"
            aria-label="Reset to starter code"
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-fg"
          >
            ↺
          </button>
        </div>
      }
      bodyClassName="p-0"
    >
      <CodeEditor value={code} onChange={setCode} language={language} height="100%" className="h-full rounded-none border-0" />
    </Panel>
  )

  const consolePanel = (
    <Panel
      header={
        <PanelTabs
          value={consoleTab}
          onChange={setConsoleTab}
          tabs={[
            { value: 'testcase', label: '✅ Testcase' },
            { value: 'result', label: <>{judging || sending ? <Spinner className="scale-75" label="Running" /> : '▶'} Test Result</> },
          ]}
        />
      }
    >
      {consoleTab === 'testcase' ? (
        <Testcases problem={problem} selected={selectedCase} onSelect={setSelectedCase} />
      ) : (
        <ResultView submission={submission.data} pending={!!sending || (submission.isPending && !!submissionId)} error={execError} loadError={submission.isError ? submission.error : null} onRetry={() => submission.refetch()} />
      )}
    </Panel>
  )

  return (
    <div className="relative flex flex-col gap-2 lg:h-[calc(100dvh-5rem)]">
      {toolbar}
      {!executionAvailable && (
        <div role="status" className="rounded-lg border border-warning/40 bg-warning-soft px-3 py-2 text-xs text-warning">
          Code execution isn't configured on this server: you can write code, but Run and Submit are disabled.
        </div>
      )}
      {countdown != null && returnTo && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border border-success/40 bg-success-soft px-4 py-2.5 text-sm text-success">
          <span className="font-semibold">🎉 Accepted! Hint earned.</span>
          <span>Returning to your game in {Math.max(countdown, 0)}…</span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => navigate(returnTo)}>
              Go now
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setCountdown(null)}>
              Stay here
            </Button>
          </span>
        </div>
      )}
      {wide ? (
        <SplitPane
          direction="horizontal"
          storageKey="codemate.split.problem"
          initial={42}
          min={25}
          max={65}
          className="flex-1"
          first={left}
          second={<SplitPane direction="vertical" storageKey="codemate.split.editor" initial={62} min={25} max={85} className="h-full" first={editor} second={consolePanel} label="Resize editor and console" />}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <div className="max-h-[60vh]">{left}</div>
          <div className="h-[55vh]">{editor}</div>
          <div className="min-h-64">{consolePanel}</div>
        </div>
      )}
    </div>
  )
}

// ------------------------------------------------------------- panels ---

function Panel({ header, children, bodyClassName }: { header: ReactNode; children: ReactNode; bodyClassName?: string }) {
  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex h-10 shrink-0 items-center border-b border-line bg-surface-2/60">{header}</div>
      <div className={cn('min-h-0 flex-1 overflow-auto p-4', bodyClassName)}>{children}</div>
    </section>
  )
}

function PanelTabs<T extends string>({ tabs, value, onChange }: { tabs: { value: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="flex h-full items-stretch px-1">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          role="tab"
          aria-selected={t.value === value}
          onClick={() => onChange(t.value)}
          className={cn(
            'flex items-center gap-1 border-b-2 px-3 text-sm whitespace-nowrap transition-colors',
            t.value === value ? 'border-primary font-medium text-fg' : 'border-transparent text-muted hover:text-fg',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function Description({ problem, earningHint }: { problem: Problem; earningHint: boolean }) {
  return (
    <article className="space-y-5">
      <header className="space-y-2">
        <h2 className="text-xl font-semibold">{problem.title}</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={difficultyTone(problem.difficulty)}>{titleCase(problem.difficulty)}</Badge>
          {problem.solved && <Badge tone="success">✓ Solved</Badge>}
          {problem.tags.map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
        {earningHint && !problem.solved && (
          <p className="rounded-md bg-primary-soft px-3 py-2 text-xs text-primary">
            💡 Solve this to earn a chess hint. You'll be taken back to your game automatically.
          </p>
        )}
      </header>

      <Markdown className="text-[0.92rem] leading-relaxed">{problem.statement}</Markdown>

      {problem.samples.map((s, i) => (
        <section key={i}>
          <h3 className="mb-1.5 text-sm font-semibold">Example {i + 1}:</h3>
          <div className="space-y-1.5 border-l-2 border-line pl-3 font-mono text-[0.8rem]">
            <p>
              <span className="font-sans font-semibold">Input: </span>
              <span className="whitespace-pre-wrap text-muted">{s.input}</span>
            </p>
            <p>
              <span className="font-sans font-semibold">Output: </span>
              <span className="whitespace-pre-wrap text-muted">{s.output}</span>
            </p>
          </div>
        </section>
      ))}

      {(problem.inputFormat || problem.outputFormat) && (
        <section className="space-y-2 text-sm">
          {problem.inputFormat && (
            <div>
              <h3 className="font-semibold">Input format</h3>
              <Markdown className="text-muted">{problem.inputFormat}</Markdown>
            </div>
          )}
          {problem.outputFormat && (
            <div>
              <h3 className="font-semibold">Output format</h3>
              <Markdown className="text-muted">{problem.outputFormat}</Markdown>
            </div>
          )}
        </section>
      )}

      {problem.constraints && (
        <section className="text-sm">
          <h3 className="mb-1 font-semibold">Constraints:</h3>
          <Markdown className="text-muted">{problem.constraints}</Markdown>
        </section>
      )}

      <p className="border-t border-line pt-3 text-xs text-subtle">
        {problem.mode === 'function' ? 'Write a solve(n, arr) function.' : 'Read from standard input, write to standard output.'}
        {problem.timeLimitSec ? ` · Time limit ${problem.timeLimitSec}s` : ''}
        {problem.memoryLimitKb ? ` · Memory ${Math.round(problem.memoryLimitKb / 1024)} MB` : ''}
      </p>
    </article>
  )
}

function ProblemSubmissions({ problemId, onOpen }: { problemId: string; onOpen: (id: string) => void }) {
  const q = useQuery({ queryKey: ['coding', 'submissions', 'problem', problemId], queryFn: () => codingApi.submissions({ problemId, limit: 30 }) })
  if (q.isPending) return <Spinner label="Loading submissions" />
  if (q.isError) return <ErrorState compact title="Couldn't load submissions" error={q.error} onRetry={() => q.refetch()} />
  if (!q.data.items.length) return <p className="text-sm text-muted">No submissions yet. Your attempts at this problem will appear here.</p>
  return (
    <ul className="divide-y divide-line">
      {q.data.items.map((s) => (
        <li key={s._id}>
          <button type="button" onClick={() => onOpen(s._id)} className="flex w-full items-center gap-3 py-2.5 text-left text-sm hover:bg-surface-2/60">
            <SubmissionStatusBadge status={s.status} />
            <span className="text-muted">{s.kind === 'run' ? 'Run' : 'Submit'}</span>
            <span className="text-muted">{LANGUAGE_LABEL[s.language] ?? s.language}</span>
            {s.totalCount > 0 && <span className="tabular-nums text-muted">{s.passedCount}/{s.totalCount}</span>}
            <span className="ml-auto text-xs text-subtle">{formatRelative(s.createdAt)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function CasePills({ count, selected, onSelect, passed }: { count: number; selected: number; onSelect: (i: number) => void; passed?: (i: number) => boolean | undefined }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: count }, (_, i) => {
        const p = passed?.(i)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onSelect(i)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1 text-sm transition-colors',
              selected === i ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2/60',
            )}
          >
            {p != null && <span className={cn('size-1.5 rounded-full', p ? 'bg-success' : 'bg-danger')} />}
            Case {i + 1}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: 'danger' | 'success' }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <pre className={cn('max-h-40 overflow-auto rounded-md bg-surface-2 px-3 py-2 font-mono text-[0.8rem] whitespace-pre-wrap', tone === 'danger' && 'text-danger', tone === 'success' && 'text-success')}>
        {value || '∅'}
      </pre>
    </div>
  )
}

function Testcases({ problem, selected, onSelect }: { problem: Problem; selected: number; onSelect: (i: number) => void }) {
  if (!problem.samples.length) return <p className="text-sm text-muted">This problem has no visible test cases.</p>
  const s = problem.samples[Math.min(selected, problem.samples.length - 1)]
  return (
    <div className="space-y-3">
      <CasePills count={problem.samples.length} selected={selected} onSelect={onSelect} />
      <Field label="Input" value={s.input} />
      <Field label="Expected output" value={s.output} />
      <p className="text-xs text-subtle">▶ Run checks these sample cases. Submit also runs hidden tests.</p>
    </div>
  )
}

function ResultView({
  submission,
  pending,
  error,
  loadError,
  onRetry,
}: {
  submission: Submission | undefined
  pending: boolean
  error: string | null
  loadError: unknown
  onRetry: () => void
}) {
  const [selected, setSelected] = useState(0)
  if (error) return <p role="alert" className="text-sm text-warning">{error}</p>
  if (loadError) return <ErrorState compact title="Couldn't load the result" error={loadError} onRetry={onRetry} />
  if (!submission) {
    return pending ? <Waiting /> : <p className="text-sm text-muted">You must run or submit your code first.</p>
  }
  if (!isFinalStatus(submission.status)) return <Waiting status={submission.status} />

  const meta = statusMeta(submission.status)
  const visible = submission.testResults.filter((t) => !t.hidden)
  const hidden = submission.testResults.filter((t) => t.hidden)
  const current: TestResult | undefined = visible[Math.min(selected, visible.length - 1)]
  const accepted = submission.status === 'accepted'

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className={cn('text-xl font-semibold', accepted ? 'text-success' : meta.tone === 'warning' ? 'text-warning' : 'text-danger')}>{meta.label}</h3>
        {submission.totalCount > 0 && (
          <span className="text-sm text-muted tabular-nums">
            {submission.passedCount} / {submission.totalCount} testcases passed
          </span>
        )}
        {submission.executionTime != null && submission.executionTime > 0 && <span className="text-xs text-muted tabular-nums">Runtime {Math.round(submission.executionTime * 1000)} ms</span>}
        {submission.memory != null && submission.memory > 0 && <span className="text-xs text-muted tabular-nums">Memory {(submission.memory / 1024).toFixed(1)} MB</span>}
      </div>

      {submission.compileOutput && <Field label={submission.status === 'compilation_error' ? 'Compile error' : 'Details'} value={submission.compileOutput} tone="danger" />}

      {visible.length > 0 && (
        <>
          <CasePills count={visible.length} selected={selected} onSelect={setSelected} passed={(i) => visible[i]?.passed} />
          {current && (
            <div className="space-y-3">
              <Field label="Input" value={current.input ?? ''} />
              <Field label="Output" value={current.output ?? ''} tone={current.passed ? undefined : 'danger'} />
              <Field label="Expected" value={current.expected ?? ''} tone="success" />
              {current.error && <Field label="Stderr" value={current.error} tone="danger" />}
            </div>
          )}
        </>
      )}

      {hidden.length > 0 && (
        <p className="text-sm text-muted">
          Hidden tests: <span className="font-medium text-fg tabular-nums">{hidden.filter((t) => t.passed).length} / {hidden.length}</span> passed
          {hidden.some((t) => !t.passed) && <> (first failure: {statusMeta(hidden.find((t) => !t.passed)!.status).label.toLowerCase()})</>}
        </p>
      )}
    </div>
  )
}

function Waiting({ status }: { status?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Spinner label="Judging" /> {status === 'running' ? 'Running your code…' : 'Waiting for the judge…'}
    </div>
  )
}
