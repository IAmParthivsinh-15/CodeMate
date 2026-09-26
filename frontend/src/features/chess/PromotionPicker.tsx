import { useEffect, useRef } from 'react'
import type { Color, Promotion } from '../../types/api'

const PIECES: { key: Promotion; name: string; white: string; black: string }[] = [
  { key: 'q', name: 'Queen', white: '♕', black: '♛' },
  { key: 'r', name: 'Rook', white: '♖', black: '♜' },
  { key: 'b', name: 'Bishop', white: '♗', black: '♝' },
  { key: 'n', name: 'Knight', white: '♘', black: '♞' },
]

/** Overlay on the board asking which piece to promote to. */
export function PromotionPicker({ color, onPick, onCancel }: { color: Color; onPick: (p: Promotion) => void; onCancel: () => void }) {
  const firstRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    firstRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onCancel])

  return (
    <div className="absolute inset-0 z-20 grid place-items-center rounded-lg bg-black/45" role="dialog" aria-label="Choose promotion piece">
      <div className="rounded-xl bg-surface p-3 shadow-2xl">
        <p className="mb-2 text-center text-sm font-medium">Promote to</p>
        <div className="flex gap-2">
          {PIECES.map((p, i) => (
            <button
              key={p.key}
              ref={i === 0 ? firstRef : undefined}
              type="button"
              aria-label={p.name}
              title={p.name}
              onClick={() => onPick(p.key)}
              className="grid size-14 place-items-center rounded-lg border border-line bg-surface-2 text-4xl leading-none hover:border-primary hover:bg-primary-soft"
            >
              {color === 'w' ? p.white : p.black}
            </button>
          ))}
        </div>
        <button type="button" onClick={onCancel} className="mt-2 w-full rounded-md py-1 text-xs text-muted hover:text-fg">
          Cancel
        </button>
      </div>
    </div>
  )
}
