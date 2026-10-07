import { useSocket } from '../../app/socketContext'
import { cn } from '../../utils/cn'

const LABEL = {
  idle: 'Not connected',
  connecting: 'Connecting…',
  connected: 'Connected',
  reconnecting: 'Reconnecting…',
  offline: 'Offline',
} as const

const DOT = {
  idle: 'bg-subtle',
  connecting: 'bg-warning animate-pulse',
  connected: 'bg-success',
  reconnecting: 'bg-warning animate-pulse',
  offline: 'bg-danger',
} as const

/** Real-time connection state (spec §54). */
export function ConnectionIndicator({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  const { status } = useSocket()
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs text-muted', className)} title={`Live connection: ${LABEL[status]}`}>
      <span className={cn('size-2 rounded-full', DOT[status])} aria-hidden="true" />
      <span className={showLabel ? '' : 'sr-only'}>{LABEL[status]}</span>
    </span>
  )
}
