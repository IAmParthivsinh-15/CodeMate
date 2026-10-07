import { cn } from '../../utils/cn'

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-surface-3', className)} />
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="space-y-2" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn('h-3.5', i === lines - 1 ? 'w-2/3' : 'w-full')} />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-card border border-line bg-surface p-5', className)} aria-busy="true" aria-label="Loading">
      <Skeleton className="mb-4 h-4 w-1/3" />
      <SkeletonText lines={3} />
    </div>
  )
}
