import { errorMessage } from '../../services/apiClient'
import { cn } from '../../utils/cn'
import { Button } from './Button'

interface ErrorStateProps {
  error?: unknown
  title?: string
  onRetry?: () => void
  className?: string
  compact?: boolean
}

export function ErrorState({ error, title = 'Something went wrong', onRetry, className, compact }: ErrorStateProps) {
  return (
    <div role="alert" className={cn('flex flex-col items-center justify-center gap-2 text-center', compact ? 'py-6' : 'py-12', className)}>
      <div className="text-2xl text-danger" aria-hidden="true">
        ⚠
      </div>
      <p className="font-medium">{title}</p>
      {error != null && <p className="max-w-md text-sm text-muted">{errorMessage(error)}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          Try again
        </Button>
      )}
    </div>
  )
}
