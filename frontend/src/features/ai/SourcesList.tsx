import { Link } from 'react-router'
import type { Source } from '../../types/api'
import { cn } from '../../utils/cn'

/** Knowledge-base citations as compact chips linking to the knowledge browser. */
export function SourcesList({ sources, className }: { sources: Source[] | undefined; className?: string }) {
  if (!sources?.length) return null
  // The same document can be cited for several sections; show each once.
  const unique = sources.filter((s, i, xs) => xs.findIndex((x) => x.source === s.source && x.section === s.section) === i)
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      <span className="text-xs text-muted">Sources:</span>
      {unique.slice(0, 6).map((s) => (
        <Link
          key={`${s.source}#${s.section}`}
          to={`/chess-knowledge?q=${encodeURIComponent(s.title)}`}
          title={`${s.title} — ${s.section} (${s.source})`}
          className="inline-flex max-w-56 items-center gap-1 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-muted hover:border-primary hover:text-primary"
        >
          <span aria-hidden="true">📄</span>
          <span className="truncate">
            {s.title}
            {s.section && s.section !== s.title ? ` · ${s.section}` : ''}
          </span>
        </Link>
      ))}
    </div>
  )
}
