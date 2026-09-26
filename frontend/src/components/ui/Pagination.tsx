import type { Pagination as PaginationInfo } from '../../types/api'
import { Button } from './Button'

export function Pagination({ info, onPage }: { info: PaginationInfo; onPage: (page: number) => void }) {
  if (info.pages <= 1) return null
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between gap-3 px-1 py-3 text-sm">
      <span className="text-muted">
        Page {info.page} of {info.pages} · {info.total} total
      </span>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={info.page <= 1} onClick={() => onPage(info.page - 1)}>
          ← Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={info.page >= info.pages} onClick={() => onPage(info.page + 1)}>
          Next →
        </Button>
      </div>
    </nav>
  )
}
