import type { ReactNode } from 'react'
import type { Color } from '../../types/api'
import { cn } from '../../utils/cn'
import { endReasonLabel, outcomeFor, resultLabel } from '../../utils/format'

interface GameStatusBannerProps {
  status: string
  result: string
  endReason: string | null
  /** The viewer's colour; null for local games (no personal outcome). */
  yourColor: Color | null
  ratingChange?: { white?: number; black?: number } | null
  actions?: ReactNode
  className?: string
}

/** Game-over summary: result, reason, rating change and follow-up actions. */
export function GameStatusBanner({ status, result, endReason, yourColor, ratingChange, actions, className }: GameStatusBannerProps) {
  if (status !== 'completed' && status !== 'abandoned') return null
  const outcome = outcomeFor(result, yourColor)
  const delta = yourColor && ratingChange ? (yourColor === 'w' ? ratingChange.white : ratingChange.black) : undefined

  let headline: string
  if (endReason === 'aborted' || (status === 'abandoned' && result === '*')) headline = 'Game aborted'
  else if (outcome === 'win') headline = 'You won'
  else if (outcome === 'loss') headline = 'You lost'
  else if (outcome === 'draw') headline = 'Draw'
  else headline = resultLabel(result)

  const tone =
    outcome === 'win' ? 'border-success/40 bg-success-soft' : outcome === 'loss' ? 'border-danger/40 bg-danger-soft' : 'border-line bg-surface-2'

  return (
    <div role="status" className={cn('animate-slide-up rounded-xl border p-4', tone, className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-lg font-semibold">
            {headline}
            {result !== '*' && <span className="ml-2 font-mono text-sm text-muted">{result}</span>}
          </p>
          <p className="text-sm text-muted">
            {endReason && endReason !== 'aborted' ? endReasonLabel(endReason) : status === 'abandoned' ? 'No result' : ''}
            {delta != null && (
              <span className={cn('ml-2 font-medium', delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : '')}>
                Rating {delta > 0 ? `+${delta}` : delta}
              </span>
            )}
          </p>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  )
}
