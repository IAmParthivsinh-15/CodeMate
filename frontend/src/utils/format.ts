import type { EndReason, GameResult, Outcome } from '../types/api'

export const MATE_CP = 10_000

/**
 * Evaluation display, White's point of view. Mirrors the backend's EngineFact
 * formatting: "+1.35", "-0.40", "0.00", "M3", "-M2", "#" (mate on the board).
 */
export function formatEval(cp: number | null | undefined, mate?: number | null): string {
  if (mate != null) {
    if (mate === 0) return '#'
    return mate > 0 ? `M${mate}` : `-M${Math.abs(mate)}`
  }
  if (cp == null || Number.isNaN(cp)) return '?'
  if (Math.abs(cp) >= MATE_CP) return '#'
  const p = (cp / 100).toFixed(2)
  return cp > 0 ? `+${p}` : p === '-0.00' ? '0.00' : p
}

/** Centipawns (White POV) → pawns, clamped to ±limit, for charts and the eval bar. */
export function clampPawns(cp: number, mate: number | null | undefined, limit = 10): number {
  if (mate != null) return mate === 0 ? (cp >= 0 ? limit : -limit) : mate > 0 ? limit : -limit
  const pawns = cp / 100
  return Math.max(-limit, Math.min(limit, pawns))
}

/**
 * Chess clock display. Under 10 s shows tenths ("0:09.4"); an hour or more
 * shows hours ("1:05:00"). Negative values clamp to zero.
 */
export function formatClock(ms: number): string {
  const safe = Math.max(0, ms)
  if (safe < 10_000) {
    const tenths = Math.floor(safe / 100)
    const s = Math.floor(tenths / 10)
    return `0:${String(s).padStart(2, '0')}.${tenths % 10}`
  }
  const totalSec = Math.floor(safe / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Remaining time for one side right now, given a server clock snapshot. */
export function remainingMs(
  clocks: { whiteMs: number; blackMs: number; turn: 'w' | 'b'; running: boolean; serverTime: number },
  color: 'w' | 'b',
  now: number,
  offsetMs = 0,
): number {
  const base = color === 'w' ? clocks.whiteMs : clocks.blackMs
  if (!clocks.running || clocks.turn !== color) return Math.max(0, base)
  const elapsed = Math.max(0, now + offsetMs - clocks.serverTime)
  return Math.max(0, base - elapsed)
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function formatRelative(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = Math.round((now - t) / 1000)
  if (diff < 45) return 'just now'
  if (diff < 3600) return `${Math.round(diff / 60)} min ago`
  if (diff < 86_400) return `${Math.round(diff / 3600)} h ago`
  if (diff < 7 * 86_400) return `${Math.round(diff / 86_400)} d ago`
  return formatDate(iso)
}

export function formatPercent(v: number | null | undefined, digits = 1): string {
  if (v == null || Number.isNaN(v)) return '—'
  return `${Number(v.toFixed(digits))}%`
}

export function formatNumber(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—'
  return Number(v.toFixed(digits)).toLocaleString()
}

export function formatDuration(ms: number): string {
  const s = Math.floor(Math.max(0, ms) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export const signed = (n: number | null | undefined) => (n == null ? '—' : n > 0 ? `+${n}` : `${n}`)

export function titleCase(s: string): string {
  return s.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

const END_REASON_LABEL: Record<Exclude<EndReason, null>, string> = {
  checkmate: 'Checkmate',
  stalemate: 'Stalemate',
  insufficient_material: 'Insufficient material',
  threefold_repetition: 'Threefold repetition',
  fifty_move_rule: 'Fifty-move rule',
  resignation: 'Resignation',
  timeout: 'Time out',
  agreement: 'Draw by agreement',
  abandonment: 'Abandonment',
  aborted: 'Aborted',
}

export function endReasonLabel(reason: string | null | undefined): string {
  if (!reason) return ''
  return END_REASON_LABEL[reason as Exclude<EndReason, null>] ?? titleCase(reason)
}

export function resultLabel(result: GameResult | string): string {
  if (result === '1-0') return 'White won'
  if (result === '0-1') return 'Black won'
  if (result === '1/2-1/2') return 'Draw'
  return 'No result'
}

/** Outcome for the player of `color` from a PGN result. */
export function outcomeFor(result: string, color: 'w' | 'b' | null): Outcome {
  if (result === '1/2-1/2') return 'draw'
  if (!color || (result !== '1-0' && result !== '0-1')) return null
  return (result === '1-0') === (color === 'w') ? 'win' : 'loss'
}

export const colorName = (c: 'w' | 'b') => (c === 'w' ? 'White' : 'Black')

/** "12." for white, "12…" for black. */
export const moveNumberLabel = (ply: number) => `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'}`
