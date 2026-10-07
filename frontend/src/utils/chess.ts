import type { BoardTheme, Classification, Promotion } from '../types/api'

export const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

export interface ClassificationMeta {
  label: string
  icon: string
  /** CSS variable holding the colour, so light/dark themes can tune it. */
  color: string
}

export const CLASSIFICATION: Record<Classification, ClassificationMeta> = {
  best: { label: 'Best', icon: '★', color: 'var(--color-cls-best)' },
  excellent: { label: 'Excellent', icon: '!', color: 'var(--color-cls-excellent)' },
  good: { label: 'Good', icon: '✓', color: 'var(--color-cls-good)' },
  book: { label: 'Book', icon: '📖', color: 'var(--color-cls-book)' },
  inaccuracy: { label: 'Inaccuracy', icon: '?!', color: 'var(--color-cls-inaccuracy)' },
  mistake: { label: 'Mistake', icon: '?', color: 'var(--color-cls-mistake)' },
  blunder: { label: 'Blunder', icon: '??', color: 'var(--color-cls-blunder)' },
}

export const CLASSIFICATION_ORDER: Classification[] = ['best', 'excellent', 'good', 'book', 'inaccuracy', 'mistake', 'blunder']

export const isSignificant = (c: Classification) => c === 'inaccuracy' || c === 'mistake' || c === 'blunder'

export const THEME_LABELS: Record<string, string> = {
  hanging_piece: 'Hanging piece',
  missed_tactic: 'Missed tactic',
  fork: 'Allowed a fork',
  missed_fork: 'Missed a fork',
  allowed_mate: 'Allowed mate',
  missed_mate: 'Missed mate',
  king_safety: 'King safety',
  endgame_technique: 'Endgame technique',
  opening_principles: 'Opening principles',
  time_management: 'Time management',
  opening: 'Opening',
  middlegame: 'Middlegame',
  endgame: 'Endgame',
}

export const themeLabel = (t: string) =>
  THEME_LABELS[t] ?? t.replace(/[_-]+/g, ' ').replace(/^\w/, (c) => c.toUpperCase())

export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; label: string }> = {
  classic: { light: '#f0d9b5', dark: '#b58863', label: 'Classic' },
  green: { light: '#eeeed2', dark: '#769656', label: 'Green' },
  blue: { light: '#dee3e6', dark: '#8ca2ad', label: 'Blue' },
  wood: { light: '#e9c89b', dark: '#9c6b3c', label: 'Wood' },
}

export interface UciMove {
  from: string
  to: string
  promotion?: Promotion
}

export function parseUci(uci: string | null | undefined): UciMove | null {
  if (!uci || uci.length < 4) return null
  const from = uci.slice(0, 2)
  const to = uci.slice(2, 4)
  const p = uci[4]
  return { from, to, promotion: p === 'q' || p === 'r' || p === 'b' || p === 'n' ? p : undefined }
}

/** Side to move from a FEN string. */
export const fenTurn = (fen: string): 'w' | 'b' => (fen.split(' ')[1] === 'b' ? 'b' : 'w')
