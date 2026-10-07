import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../../utils/cn'

export type BadgeTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-surface-3 text-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
}

interface BadgeProps {
  tone?: BadgeTone
  children: ReactNode
  className?: string
  style?: CSSProperties
  title?: string
}

export function Badge({ tone = 'neutral', children, className, style, title }: BadgeProps) {
  return (
    <span
      title={title}
      style={style}
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap', tones[tone], className)}
    >
      {children}
    </span>
  )
}
