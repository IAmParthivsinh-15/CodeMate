import { cn } from '../../utils/cn'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={cn('inline-flex', className)}>
      <svg className="size-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </span>
  )
}

export function PageSpinner() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted">
      <Spinner className="scale-150" />
    </div>
  )
}
