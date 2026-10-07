import { Chess, type Square } from 'chess.js'
import { useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type Arrow, type ChessboardOptions } from 'react-chessboard'
import { useAuth } from '../auth/authContext'
import type { BoardTheme, Color, Promotion } from '../../types/api'
import { BOARD_THEMES } from '../../utils/chess'
import { PromotionPicker } from './PromotionPicker'

export interface BoardMove {
  from: string
  to: string
  promotion?: Promotion
}

export interface BoardArrow {
  from: string
  to: string
  color?: string
}

interface BoardProps {
  fen: string
  orientation?: 'white' | 'black'
  /** Which side the user may move: a colour, both (local games), or none (read-only). */
  movable?: Color | 'both' | 'none'
  onMove?: (move: BoardMove) => void
  lastMove?: { from: string; to: string } | null
  arrows?: BoardArrow[]
  /** Board square colours; defaults to the user's preference. */
  theme?: BoardTheme
  id?: string
  className?: string
}

const LAST_MOVE: CSSProperties = { backgroundColor: 'rgba(250, 204, 21, 0.38)' }
const SELECTED: CSSProperties = { backgroundColor: 'rgba(99, 102, 241, 0.45)' }
const TARGET: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(20, 20, 40, 0.28) 22%, transparent 24%)',
}
const CAPTURE: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, transparent 58%, rgba(20, 20, 40, 0.3) 60%)',
}
const CHECK: CSSProperties = {
  backgroundImage: 'radial-gradient(circle, rgba(239, 68, 68, 0.9) 0%, rgba(239, 68, 68, 0.45) 45%, transparent 75%)',
}

function safeChess(fen: string): Chess {
  try {
    return new Chess(fen)
  } catch {
    return new Chess()
  }
}

function kingSquare(chess: Chess, color: Color): string | null {
  for (const row of chess.board()) {
    for (const sq of row) {
      if (sq && sq.type === 'k' && sq.color === color) return sq.square
    }
  }
  return null
}

/**
 * Chessboard wrapper. chess.js is used only to show legal targets and detect
 * promotions; the move is handed to `onMove` and the parent decides (usually by
 * asking the server) what the next `fen` is.
 */
export function Board({ fen, orientation = 'white', movable = 'none', onMove, lastMove, arrows, theme, id = 'board', className }: BoardProps) {
  const { user } = useAuth()
  const colors = BOARD_THEMES[theme ?? user?.preferences?.boardTheme ?? 'classic'] ?? BOARD_THEMES.classic
  const chess = useMemo(() => safeChess(fen), [fen])
  const turn = chess.turn()
  const canMove = movable === 'both' || movable === turn

  const [selected, setSelected] = useState<{ fen: string; square: string } | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<{ from: string; to: string; color: Color } | null>(null)
  // Selection belongs to one position; a new FEN clears it without an effect.
  const selectedSquare = selected && selected.fen === fen ? selected.square : null

  const targets = useMemo(() => {
    if (!selectedSquare) return []
    return chess.moves({ square: selectedSquare as Square, verbose: true })
  }, [chess, selectedSquare])

  const isOwnPiece = (square: string) => {
    const p = chess.get(square as Square)
    return !!p && p.color === turn && canMove
  }

  /** 'moved' = handed to onMove; 'promotion' = picker opened; 'illegal' = nothing happened. */
  const tryMove = (from: string, to: string): 'moved' | 'promotion' | 'illegal' => {
    const legal = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to)
    if (legal.length === 0) return 'illegal'
    setSelected(null)
    if (legal.some((m) => m.promotion)) {
      setPendingPromotion({ from, to, color: turn })
      return 'promotion'
    }
    onMove?.({ from, to })
    return 'moved'
  }

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { ...LAST_MOVE }
    squareStyles[lastMove.to] = { ...LAST_MOVE }
  }
  if (chess.inCheck()) {
    const k = kingSquare(chess, turn)
    if (k) squareStyles[k] = { ...squareStyles[k], ...CHECK }
  }
  if (selectedSquare) {
    squareStyles[selectedSquare] = { ...squareStyles[selectedSquare], ...SELECTED }
    for (const m of targets) {
      squareStyles[m.to] = { ...squareStyles[m.to], ...(m.captured ? CAPTURE : TARGET) }
    }
  }

  const boardArrows: Arrow[] = (arrows ?? []).map((a) => ({
    startSquare: a.from,
    endSquare: a.to,
    color: a.color ?? 'rgba(34, 160, 90, 0.85)',
  }))

  const options: ChessboardOptions = {
    id,
    position: fen,
    boardOrientation: orientation,
    lightSquareStyle: { backgroundColor: colors.light },
    darkSquareStyle: { backgroundColor: colors.dark },
    squareStyles,
    arrows: boardArrows,
    allowDragging: canMove,
    allowDrawingArrows: true,
    clearArrowsOnPositionChange: true,
    animationDurationInMs: 180,
    boardStyle: { borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 14px rgb(0 0 0 / 0.15)' },
    canDragPiece: ({ square }) => !!square && isOwnPiece(square),
    onPieceDrop: ({ sourceSquare, targetSquare }) => {
      if (!targetSquare || sourceSquare === targetSquare) return false
      // Returning false snaps the piece back; the parent re-renders with the new FEN.
      return tryMove(sourceSquare, targetSquare) === 'moved'
    },
    onSquareClick: ({ square }) => {
      if (!canMove) return
      if (selectedSquare && selectedSquare !== square && tryMove(selectedSquare, square) !== 'illegal') return
      if (selectedSquare === square) {
        setSelected(null)
        return
      }
      setSelected(isOwnPiece(square) ? { fen, square } : null)
    },
  }

  return (
    <div className={className}>
      <div className="relative w-full select-none" style={{ touchAction: 'none' }}>
        <Chessboard options={options} />
        {pendingPromotion && (
          <PromotionPicker
            color={pendingPromotion.color}
            onPick={(piece) => {
              const m = pendingPromotion
              setPendingPromotion(null)
              onMove?.({ from: m.from, to: m.to, promotion: piece })
            }}
            onCancel={() => setPendingPromotion(null)}
          />
        )}
      </div>
    </div>
  )
}
