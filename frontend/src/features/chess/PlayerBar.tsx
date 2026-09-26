import type { ReactNode } from 'react'
import type { Side } from '../../types/api'
import { cn } from '../../utils/cn'

interface PlayerBarProps {
  side: Side
  color: 'w' | 'b'
  active?: boolean
  right?: ReactNode
  status?: ReactNode
  className?: string
}

/** Name, rating and colour of one player, with an optional clock on the right. */
export function PlayerBar({ side, color, active, right, status, className }: PlayerBarProps) {
  const name = side.type === 'open' ? 'Waiting for opponent…' : (side.username ?? (color === 'w' ? 'White' : 'Black'))
  return (
    <div className={cn('flex min-h-11 items-center justify-between gap-2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            'size-3.5 shrink-0 rounded-sm border border-line-strong',
            color === 'w' ? 'bg-white' : 'bg-neutral-900',
            active && 'ring-2 ring-primary ring-offset-1 ring-offset-bg',
          )}
        />
        <span className="truncate text-sm font-medium">{name}</span>
        {side.type === 'engine' && <span className="text-xs text-muted">engine</span>}
        {side.rating != null && side.type === 'human' && <span className="text-xs text-muted tabular-nums">({side.rating})</span>}
        {status}
      </div>
      {right}
    </div>
  )
}
