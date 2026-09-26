import { ButtonLink } from '../components/ui/Button'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

export function NotFoundPage() {
  useDocumentTitle('Page not found')
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-mono text-5xl font-semibold text-subtle">404</p>
      <h1 className="text-xl font-semibold">This square is empty</h1>
      <p className="max-w-sm text-sm text-muted">The page you're looking for doesn't exist or was moved.</p>
      <ButtonLink to="/" variant="secondary" className="mt-2">
        Back to home
      </ButtonLink>
    </div>
  )
}
