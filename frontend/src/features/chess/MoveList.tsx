import { useEffect, useRef } from 'react'
import type { Classification } from '../../types/api'
import { CLASSIFICATION } from '../../utils/chess'
import { cn } from '../../utils/cn'

export interface MoveListItem {
  ply: number
  san: string
  classification?: Classification
}

interface MoveListProps {
  moves: MoveListItem[]
  currentPly: number
  onSelect: (ply: number) => void
  className?: string
  emptyText?: string
}

/** Two-column move list with clickable plies. The active ply scrolls into view. */
export function MoveList({ moves, currentPly, onSelect, className, emptyText = 'No moves yet.' }: MoveListProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLElement>(`[data-ply="${currentPly}"]`)
    const box = containerRef.current
    if (!el || !box) return
    const top = el.offsetTop - box.offsetTop
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - el.offsetHeight) {
      box.scrollTo({ top: Math.max(0, top - box.clientHeight / 2) })
    }
  }, [currentPly, moves.length])

  if (moves.length === 0) {
    return <p className={cn('px-3 py-4 text-sm text-muted', className)}>{emptyText}</p>
  }

  const rows: { n: number; white?: MoveListItem; black?: MoveListItem }[] = []
  for (const m of moves) {
    const n = Math.ceil(m.ply / 2)
    let row = rows[rows.length - 1]
    if (!row || row.n !== n) {
      row = { n }
      rows.push(row)
    }
    if (m.ply % 2 === 1) row.white = m
    else row.black = m
  }

  const cell = (m?: MoveListItem) => {
    if (!m) return <span />
    const meta = m.classification ? CLASSIFICATION[m.classification] : null
    const active = m.ply === currentPly
    return (
      <button
        type="button"
        data-ply={m.ply}
        onClick={() => onSelect(m.ply)}
        aria-current={active ? 'step' : undefined}
        aria-label={`Move ${Math.ceil(m.ply / 2)}${m.ply % 2 ? '' : '…'} ${m.san}${meta ? `, ${meta.label}` : ''}`}
        className={cn(
          'flex min-w-0 items-center justify-between gap-1 rounded-md px-2 py-1 text-left font-mono text-sm transition-colors',
          active ? 'bg-primary text-primary-fg' : 'hover:bg-surface-3',
        )}
      >
        <span className="truncate">{m.san}</span>
        {meta && meta.icon && m.classification !== 'good' && m.classification !== 'book' && (
          <span className="shrink-0 text-xs font-bold" style={{ color: active ? undefined : meta.color }} aria-hidden="true">
            {meta.icon}
          </span>
        )}
      </button>
    )
  }

  return (
    <div ref={containerRef} className={cn('relative overflow-y-auto', className)}>
      <ol className="grid grid-cols-[2.25rem_1fr_1fr] gap-x-1 gap-y-0.5 p-1">
        {rows.map((r) => (
          <li key={r.n} className="contents">
            <span className="py-1 pr-1 text-right font-mono text-xs leading-6 text-subtle">{r.n}.</span>
            {cell(r.white)}
            {cell(r.black)}
          </li>
        ))}
      </ol>
    </div>
  )
}

interface ReplayControlsProps {
  ply: number
  total: number
  onFirst: () => void
  onPrev: () => void
  onNext: () => void
  onLast: () => void
  className?: string
}

export function ReplayControls({ ply, total, onFirst, onPrev, onNext, onLast, className }: ReplayControlsProps) {
  const btn = 'grid h-9 flex-1 place-items-center rounded-lg border border-line bg-surface-2 text-sm hover:bg-surface-3 disabled:opacity-40'
  return (
    <div className={cn('flex gap-1.5', className)} role="group" aria-label="Move navigation">
      <button type="button" className={btn} onClick={onFirst} disabled={ply === 0} aria-label="First move (Home)" title="First (Home)">
        ⏮
      </button>
      <button type="button" className={btn} onClick={onPrev} disabled={ply === 0} aria-label="Previous move (Left arrow)" title="Previous (←)">
        ◀
      </button>
      <button type="button" className={btn} onClick={onNext} disabled={ply >= total} aria-label="Next move (Right arrow)" title="Next (→)">
        ▶
      </button>
      <button type="button" className={btn} onClick={onLast} disabled={ply >= total} aria-label="Last move (End)" title="Last (End)">
        ⏭
      </button>
    </div>
  )
}
