import { Badge } from '../../components/ui/Badge'
import { Spinner } from '../../components/ui/Spinner'
import { statusMeta } from './statusMeta'

export function SubmissionStatusBadge({ status }: { status: string }) {
  const m = statusMeta(status)
  return (
    <Badge tone={m.tone}>
      {(status === 'queued' || status === 'running') && <Spinner className="scale-75" label={m.label} />}
      {m.label}
    </Badge>
  )
}
