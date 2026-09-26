import { useQueryClient } from '@tanstack/react-query'
import { Chess } from 'chess.js'
import { useState } from 'react'
import { Link } from 'react-router'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Card } from '../../components/ui/Card'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import type { Puzzle } from '../../types/api'
import { parseUci, themeLabel } from '../../utils/chess'
import { cn } from '../../utils/cn'
import { colorName, formatEval, titleCase } from '../../utils/format'
import { Board, type BoardMove } from '../chess/Board'
import { analysisHref } from '../games/links'
import { puzzleSourcePly, puzzlesApi } from './api'

type Feedback =
  | { kind: 'correct'; san: string; expected?: string }
  | { kind: 'wrong'; san: string; attempts: number; expected?: string; evaluation: number | null }
  | { kind: 'revealed'; expected: string }
  | null

const MAX_TRIES_BEFORE_REVEAL = 3

/** Solve one puzzle: play the move you missed in your own game. */
export function PuzzleSolver({ puzzle, onNext }: { puzzle: Puzzle; onNext?: () => void }) {
  const qc = useQueryClient()
  const toast = useToast()
  const [current, setCurrent] = useState(puzzle)
  const [feedback, setFeedback] = useState<Feedback>(puzzle.solved && puzzle.expectedSan ? { kind: 'correct', san: puzzle.expectedSan } : null)
  const [boardFen, setBoardFen] = useState(puzzle.fen)
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [revealing, setRevealing] = useState(false)

  const solved = current.solved || feedback?.kind === 'correct'
  const expectedUci = current.expectedMove ? parseUci(current.expectedMove) : null
  const showAnswer = !!expectedUci && (solved || feedback?.kind === 'revealed' || (feedback?.kind === 'wrong' && !!feedback.expected))
  const sourcePly = puzzleSourcePly(current)

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ['puzzles'] })
    void qc.invalidateQueries({ queryKey: ['dashboard'] })
  }

  const onMove = async (m: BoardMove) => {
    if (solved || submitting) return
    const uci = `${m.from}${m.to}${m.promotion ?? ''}`
    // Show the attempted move while the server checks it.
    try {
      const c = new Chess(current.fen)
      c.move({ from: m.from, to: m.to, promotion: m.promotion })
      setBoardFen(c.fen())
      setLastMove({ from: m.from, to: m.to })
    } catch {
      return
    }
    setSubmitting(true)
    try {
      const res = await puzzlesApi.attempt(current._id, uci)
      setCurrent({ ...res.puzzle, expectedSan: res.expected?.san ?? res.puzzle.expectedSan, expectedMove: res.expected?.uci ?? res.puzzle.expectedMove })
      if (res.correct) {
        setFeedback({ kind: 'correct', san: res.played.san, expected: res.expected?.san })
        refresh()
      } else {
        setFeedback({ kind: 'wrong', san: res.played.san, attempts: res.attempts, expected: res.expected?.san, evaluation: res.evaluation })
        // Reset to the puzzle position after a short beat.
        window.setTimeout(() => {
          setBoardFen(current.fen)
          setLastMove(null)
        }, 900)
      }
    } catch (err) {
      toast.error(errorMessage(err))
      setBoardFen(current.fen)
      setLastMove(null)
    } finally {
      setSubmitting(false)
    }
  }

  const reveal = async () => {
    setRevealing(true)
    try {
      const p = await puzzlesApi.reveal(current._id)
      setCurrent(p)
      setFeedback({ kind: 'revealed', expected: p.expectedSan ?? p.expectedMove ?? '?' })
      setBoardFen(p.fen)
      setLastMove(null)
    } catch (err) {
      toast.error(errorMessage(err))
    } finally {
      setRevealing(false)
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="mx-auto w-full max-w-[min(100%,calc(100vh-12rem))] min-w-0">
        <Board
          fen={boardFen}
          orientation={current.sideToMove === 'b' ? 'black' : 'white'}
          movable={solved || submitting ? 'none' : current.sideToMove}
          onMove={onMove}
          lastMove={lastMove}
          arrows={showAnswer && expectedUci ? [{ from: expectedUci.from, to: expectedUci.to, color: 'rgba(34, 160, 90, 0.85)' }] : undefined}
          id="puzzle-board"
        />
      </div>
      <Card className="flex flex-col gap-4 p-4">
        <div>
          <p className="text-lg font-semibold">{colorName(current.sideToMove)} to move</p>
          <p className="text-sm text-muted">Find the best move{current.playedMove ? ` (in the game you played ${current.playedMove})` : ''}.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={current.difficulty === 'hard' ? 'danger' : current.difficulty === 'medium' ? 'warning' : 'success'}>{titleCase(current.difficulty)}</Badge>
          {(current.themes?.length ? current.themes : [current.theme]).filter(Boolean).map((t) => (
            <Badge key={t}>{themeLabel(t)}</Badge>
          ))}
        </div>

        <div aria-live="polite">
          {feedback?.kind === 'correct' && (
            <div className="rounded-lg bg-success-soft p-3 text-sm text-success">
              <p className="font-semibold">✓ Correct: {feedback.san}</p>
              {feedback.expected && feedback.expected !== feedback.san && <p className="mt-0.5">The engine's first choice was {feedback.expected}; yours is just as good.</p>}
            </div>
          )}
          {feedback?.kind === 'wrong' && (
            <div className={cn('rounded-lg p-3 text-sm', feedback.expected ? 'bg-warning-soft text-warning' : 'bg-danger-soft text-danger')}>
              <p className="font-semibold">✕ {feedback.san} isn't it.</p>
              {feedback.evaluation != null && <p className="mt-0.5">Stockfish: {formatEval(feedback.evaluation)} after that move.</p>}
              {feedback.expected ? <p className="mt-0.5">The answer was {feedback.expected} (green arrow).</p> : <p className="mt-0.5">Attempt {feedback.attempts}. Try again.</p>}
            </div>
          )}
          {feedback?.kind === 'revealed' && (
            <div className="rounded-lg bg-info-soft p-3 text-sm text-info">
              <p className="font-semibold">Answer: {feedback.expected}</p>
            </div>
          )}
          {submitting && <p className="text-sm text-muted">Checking with Stockfish…</p>}
        </div>

        <div className="mt-auto flex flex-wrap gap-2">
          {!solved && feedback?.kind !== 'revealed' && (
            <Button
              variant="secondary"
              size="sm"
              onClick={reveal}
              loading={revealing}
              disabled={submitting}
              title={current.attempts < MAX_TRIES_BEFORE_REVEAL ? 'Give up and show the answer' : undefined}
            >
              Reveal answer
            </Button>
          )}
          {onNext && (
            <Button size="sm" onClick={onNext}>
              Next puzzle →
            </Button>
          )}
        </div>
        {current.sourceGame && (
          <Link to={analysisHref(current.sourceGame, sourcePly)} className="text-sm text-primary hover:underline">
            See it in the original game →
          </Link>
        )}
        <p className="text-xs text-subtle">Attempts: {current.attempts}</p>
      </Card>
    </div>
  )
}
