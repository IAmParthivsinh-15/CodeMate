import { cn } from '../../utils/cn'
import { useLanguages } from './hooks'

/** Shown when the backend has no code-execution service (Judge0) configured. */
export function ExecutionBanner({ className }: { className?: string }) {
  const langs = useLanguages()
  if (!langs.data || langs.data.executionAvailable) return null
  return (
    <div role="status" className={cn('rounded-lg border border-warning/40 bg-warning-soft px-4 py-3 text-sm text-warning', className)}>
      <p className="font-medium">Code execution is not available right now</p>
      <p className="mt-0.5">
        The judging service isn't configured on this server, so Run and Submit are disabled. You can still read problems and write code in the editor.
      </p>
    </div>
  )
}
