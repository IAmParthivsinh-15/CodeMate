import { Badge, type BadgeTone } from '../../components/ui/Badge'
import type { AnalysisStatus, Outcome } from '../../types/api'

export function OutcomeBadge({ outcome, status }: { outcome: Outcome; status: string }) {
  if (status === 'in_progress') return <Badge tone="primary">In progress</Badge>
  if (status === 'waiting') return <Badge tone="info">Waiting</Badge>
  if (status === 'abandoned' && !outcome) return <Badge>Aborted</Badge>
  const map: Record<string, { tone: BadgeTone; label: string }> = {
    win: { tone: 'success', label: 'Win' },
    loss: { tone: 'danger', label: 'Loss' },
    draw: { tone: 'neutral', label: 'Draw' },
  }
  const m = outcome ? map[outcome] : { tone: 'neutral' as BadgeTone, label: 'Finished' }
  return <Badge tone={m.tone}>{m.label}</Badge>
}

export function AnalysisBadge({ status }: { status: AnalysisStatus }) {
  switch (status) {
    case 'completed':
      return <Badge tone="success">✓ Analyzed</Badge>
    case 'pending':
    case 'running':
      return <Badge tone="warning">⏳ Analyzing</Badge>
    case 'failed':
      return <Badge tone="danger">Analysis failed</Badge>
    default:
      return <Badge>Not analyzed</Badge>
  }
}
