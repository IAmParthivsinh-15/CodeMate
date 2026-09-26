import { useEffect, useState } from 'react'
import type { Clocks, Color } from '../../types/api'
import { cn } from '../../utils/cn'
import { clockUrgency } from '../../utils/display'
import { formatClock, remainingMs } from '../../utils/format'

interface GameClockProps {
  clocks: Clocks | null
  color: Color
  /** serverTime - Date.now() estimate, from the socket heartbeat. */
  offsetMs?: number
  /** Freeze display (paused / finished game). */
  frozen?: boolean
  className?: string
}

/**
 * Displays one side's clock. Values come from the server snapshot and tick
 * locally for the side to move; the server alone decides flag fall.
 */
export function GameClock({ clocks, color, offsetMs = 0, frozen, className }: GameClockProps) {
  const ticking = !!clocks && clocks.running && clocks.turn === color && !frozen
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!ticking) return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      // ~10 fps is plenty for a tenths display and cheap on battery.
      if (t - last > 100) {
        last = t
        setNow(Date.now())
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [ticking])

  if (!clocks) return null
  const ms = ticking ? remainingMs(clocks, color, now, offsetMs) : color === 'w' ? clocks.whiteMs : clocks.blackMs
  const urgency = clockUrgency(ms)
  const active = clocks.running && clocks.turn === color && !frozen

  return (
    <div
      role="timer"
      aria-label={`${color === 'w' ? 'White' : 'Black'} clock`}
      aria-live="off"
      className={cn(
        'rounded-lg px-3 py-1.5 font-mono text-xl font-semibold tabular-nums transition-colors',
        active ? 'bg-fg text-bg' : 'bg-surface-2 text-muted',
        active && urgency === 'low' && 'bg-warning text-white dark:text-bg',
        active && urgency === 'critical' && 'animate-pulse bg-danger text-white dark:text-bg',
        className,
      )}
    >
      {formatClock(ms)}
    </div>
  )
}
