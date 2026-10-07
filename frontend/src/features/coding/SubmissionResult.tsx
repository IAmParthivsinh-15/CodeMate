import type { Submission } from '../../types/api'
import { cn } from '../../utils/cn'
import { SubmissionStatusBadge } from './SubmissionStatusBadge'

function Pre({ children, label }: { children: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-0.5 text-[11px] font-medium tracking-wide text-muted uppercase">{label}</p>
      <pre className="max-h-40 overflow-auto rounded-md bg-surface-2 p-2 font-mono text-xs whitespace-pre-wrap">{children || '∅'}</pre>
    </div>
  )
}

/** Verdict and per-test results. Hidden tests only show pass/fail. */
export function SubmissionResult({ submission }: { submission: Submission }) {
  const s = submission
  const done = s.status !== 'queued' && s.status !== 'running'
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SubmissionStatusBadge status={s.status} />
        <span className="text-sm text-muted">{s.kind === 'run' ? 'Run (sample tests)' : 'Submission'}</span>
        {done && s.totalCount > 0 && (
          <span className="text-sm font-medium tabular-nums">
            {s.passedCount}/{s.totalCount} tests passed
          </span>
        )}
        {done && s.executionTime != null && s.executionTime > 0 && <span className="text-xs text-muted tabular-nums">{s.executionTime}s</span>}
        {done && s.memory != null && s.memory > 0 && <span className="text-xs text-muted tabular-nums">{Math.round(s.memory / 1024)} MB</span>}
      </div>

      {s.compileOutput && <Pre label={s.status === 'compilation_error' ? 'Compiler output' : 'Details'}>{s.compileOutput}</Pre>}

      {s.testResults.length > 0 && (
        <ul className="space-y-2">
          {s.testResults.map((t) => (
            <li key={t.index} className={cn('rounded-lg border p-3', t.passed ? 'border-success/30' : 'border-danger/30')}>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium">
                  {t.hidden ? 'Hidden test' : 'Test'} {t.index + 1}
                </span>
                <span className={t.passed ? 'text-success' : 'text-danger'}>{t.passed ? '✓ Passed' : `✕ ${t.status.replace(/_/g, ' ')}`}</span>
              </div>
              {!t.hidden && (
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  <Pre label="Input">{t.input ?? ''}</Pre>
                  <Pre label="Expected">{t.expected ?? ''}</Pre>
                  <Pre label="Your output">{t.output ?? ''}</Pre>
                </div>
              )}
              {!t.hidden && t.error && (
                <div className="mt-2">
                  <Pre label="Error">{t.error}</Pre>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
