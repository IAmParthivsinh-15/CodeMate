import type { ReactNode } from 'react'
import { useDocumentTitle } from '../../hooks/useDocumentTitle'
import { cn } from '../../utils/cn'

interface PageHeaderProps {
  title: ReactNode
  /** Plain-text title for the browser tab (defaults to `title` when it's a string). */
  docTitle?: string
  description?: ReactNode
  actions?: ReactNode
  back?: ReactNode
  className?: string
}

export function PageHeader({ title, docTitle, description, actions, back, className }: PageHeaderProps) {
  useDocumentTitle(docTitle ?? (typeof title === 'string' ? title : undefined))
  return (
    <div className={cn('mb-5 flex flex-wrap items-end justify-between gap-3 lg:mb-6', className)}>
      <div className="min-w-0">
        {back && <div className="mb-1 text-sm">{back}</div>}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
