import type { ReactNode } from 'react'
import { cn } from '../../utils/cn'

interface StatTileProps {
  label: ReactNode
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'success' | 'danger' | 'warning' | 'primary'
  className?: string
}

const toneClass = {
  default: 'text-fg',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  primary: 'text-primary',
}

export function StatTile({ label, value, hint, tone = 'default', className }: StatTileProps) {
  return (
    <div className={cn('min-w-0 rounded-xl border border-line bg-surface-2 px-4 py-3', className)}>
      <div className="truncate text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={cn('mt-1 truncate text-2xl font-semibold tabular-nums', toneClass[tone])}>{value}</div>
      {hint && <div className="mt-0.5 truncate text-xs text-muted">{hint}</div>}
    </div>
  )
}
