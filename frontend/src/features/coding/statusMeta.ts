import type { BadgeTone } from '../../components/ui/Badge'

export const STATUS_META: Record<string, { tone: BadgeTone; label: string }> = {
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

export const statusMeta = (status: string) => STATUS_META[status] ?? { tone: 'neutral' as BadgeTone, label: status }

