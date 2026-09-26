import { MATE_CP } from './format'

/** White's share of the bar (0-100) for an evaluation in centipawns, White POV. */
export function whiteShare(cp: number | null | undefined, mate?: number | null): number {
  if (mate != null) return mate > 0 || (mate === 0 && (cp ?? 0) > 0) ? 100 : 0
  if (cp == null) return 50
  if (Math.abs(cp) >= MATE_CP) return cp > 0 ? 100 : 0
  // Logistic curve: ±4 pawns ≈ 83/17.
  const share = 100 / (1 + Math.exp(-0.004 * cp))
  return Math.max(3, Math.min(97, share))
}

export type ClockUrgency = 'normal' | 'low' | 'critical'

export function clockUrgency(ms: number): ClockUrgency {
  if (ms <= 10_000) return 'critical'
  if (ms <= 30_000) return 'low'
  return 'normal'
}
