import { Badge } from '../../../components/ui/Badge'
import { Button } from '../../../components/ui/Button'
import { Card } from '../../../components/ui/Card'
import type { Color, MoveAnalysis } from '../../../types/api'
import { CLASSIFICATION, isSignificant, themeLabel } from '../../../utils/chess'
import { formatEval, moveNumberLabel, titleCase } from '../../../utils/format'

interface MoveDetailProps {
  move: MoveAnalysis | null
  yourColor: Color | null
  isLocal: boolean
  onExplain: (ply: number) => void
  onPractice: (ply: number) => void
  practicing: boolean
}

/** Stockfish facts for the selected move, plus Explain / Practice actions. */
export function MoveDetail({ move, yourColor, isLocal, onExplain, onPractice, practicing }: MoveDetailProps) {
  if (!move) {
    return (
      <Card className="p-4 text-sm text-muted">
        Starting position. Select a move (or use ← →) to see Stockfish's verdict.
      </Card>
    )
  }
  const meta = CLASSIFICATION[move.classification]
  const significant = isSignificant(move.classification)
  const mine = isLocal || move.color === yourColor
  const differs = !!move.bestMove && move.bestMoveUci !== move.playedMoveUci

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-base font-semibold">
          <span className="font-mono">
            {moveNumberLabel(move.ply)} {move.playedMove}
          </span>{' '}
          <span className="ml-1 text-sm" style={{ color: meta.color }}>
            {meta.icon !== '✓' && meta.icon !== '📖' ? `${meta.icon} ` : ''}
            {meta.label}
          </span>
        </p>
        <Badge>{titleCase(move.phase)}</Badge>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-muted">Played</dt>
          <dd className="font-mono font-medium">{move.playedMove}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Best</dt>
          <dd className="font-mono font-medium">{move.bestMove ?? '—'}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Eval before → after</dt>
          <dd className="font-mono">
            {formatEval(move.evaluationBefore, move.mateBefore)} → {formatEval(move.evaluationAfter, move.mateAfter)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Loss · accuracy</dt>
          <dd className="tabular-nums">
            {move.centipawnLoss} cp · {Math.round(move.accuracy)}%
          </dd>
        </div>
      </dl>

      {move.principalVariation.length > 0 && (
        <p className="mt-3 text-sm">
          <span className="text-xs text-muted">Best line: </span>
          <span className="font-mono">{move.principalVariation.slice(0, 8).join(' ')}</span>
        </p>
      )}

      {move.themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {move.themes.map((t) => (
            <Badge key={t} tone="warning">
              {themeLabel(t)}
            </Badge>
          ))}
        </div>
      )}

      {significant && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => onExplain(move.ply)}>
            ✦ Explain with AI
          </Button>
          {mine && differs && (
            <Button size="sm" variant="secondary" onClick={() => onPractice(move.ply)} loading={practicing}>
              Practice this position
            </Button>
          )}
        </div>
      )}
      {differs && !significant && <p className="mt-3 text-xs text-muted">Stockfish slightly preferred {move.bestMove}.</p>}
    </Card>
  )
}
