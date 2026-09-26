import { useCallback, useEffect, useMemo, useState } from 'react'
import { parseUci } from '../../utils/chess'

export interface ReplayMove {
  /** Position AFTER the move. */
  fen: string
  uci?: string
  san?: string
}

export interface Replay {
  /** 0 = initial position, n = after the n-th ply. */
  ply: number
  total: number
  fen: string
  lastMove: { from: string; to: string } | null
  isLatest: boolean
  goTo: (ply: number) => void
  next: () => void
  prev: () => void
  first: () => void
  last: () => void
}

/**
 * Move-by-move navigation over a list of positions. While the user is on the
 * latest ply it keeps following new moves (live games); once they step back it
 * stays put until they return to the end.
 */
export function useReplay(initialFen: string, moves: ReplayMove[], initialPly?: number | null): Replay {
  const total = moves.length
  // null = follow the latest position.
  const [selected, setSelected] = useState<number | null>(initialPly ?? null)

  const ply = selected == null ? total : Math.max(0, Math.min(total, selected))

  const goTo = useCallback(
    (p: number) => {
      const clamped = Math.max(0, Math.min(total, p))
      setSelected(clamped >= total ? null : clamped)
    },
    [total],
  )

  const next = useCallback(() => goTo(ply + 1), [goTo, ply])
  const prev = useCallback(() => goTo(ply - 1), [goTo, ply])
  const first = useCallback(() => goTo(0), [goTo])
  const last = useCallback(() => setSelected(null), [])

  const fen = ply === 0 ? initialFen : (moves[ply - 1]?.fen ?? initialFen)
  const lastMove = useMemo(() => {
    const m = ply > 0 ? parseUci(moves[ply - 1]?.uci) : null
    return m ? { from: m.from, to: m.to } : null
  }, [moves, ply])

  return { ply, total, fen, lastMove, isLatest: ply === total, goTo, next, prev, first, last }
}

const isTyping = (el: Element | null) =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || (el as HTMLElement).isContentEditable)

/** ←/→/Home/End keyboard navigation for a replay (ignored while typing). */
export function useReplayKeyboard(replay: Pick<Replay, 'next' | 'prev' | 'first' | 'last'>, enabled = true) {
  const { next, prev, first, last } = replay
  useEffect(() => {
    if (!enabled) return
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || isTyping(document.activeElement)) return
      if (document.querySelector('[aria-modal="true"]')) return
      const map: Record<string, () => void> = { ArrowRight: next, ArrowLeft: prev, Home: first, End: last }
      const fn = map[e.key]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [next, prev, first, last, enabled])
}
