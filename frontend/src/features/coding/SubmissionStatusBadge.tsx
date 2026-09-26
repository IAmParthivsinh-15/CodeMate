import { Badge, type BadgeTone } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'

const MAP: Record<string, { tone: BadgeTone; label: string }> = {
  queued: { tone: 'neutral', label: 'Queued' },
  running: { tone: 'info', label: 'Running' },
  accepted: { tone: 'success', label: 'Accepted' },
  wrong_answer: { tone: 'danger', label: 'Wrong answer' },
  compilation_error: { tone: 'warning', label: 'Compilation error' },
  runtime_error: { tone: 'danger', label: 'Runtime error' },
  time_limit_exceeded: { tone: 'warning', label: 'Time limit exceeded' },
  memory_limit_exceeded: { tone: 'warning', label: 'Memory limit exceeded' },
  internal_error: { tone: 'danger', label: 'Internal error' },
  unavailable: { tone: 'neutral', label: 'Unavailable' },
}

export function SubmissionStatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { tone: 'neutral' as BadgeTone, label: status }
  return (
    <Badge tone={m.tone}>
      {(status === 'queued' || status === 'running') && <Spinner className="scale-75" label={m.label} />}
      {m.label}
    </Badge>
  )
}
