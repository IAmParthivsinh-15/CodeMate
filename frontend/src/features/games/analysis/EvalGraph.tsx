import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { MoveAnalysis } from '../../../types/api'
import { clampPawns, formatEval, moveNumberLabel } from '../../../utils/format'

interface EvalGraphProps {
  moves: MoveAnalysis[]
  selectedPly: number
  onSelect: (ply: number) => void
  height?: number
}

interface Point {
  ply: number
  eval: number
  label: string
  san: string
}

function evalSeries(moves: MoveAnalysis[]): Point[] {
  if (moves.length === 0) return []
  const first = moves[0]
  return [
    { ply: 0, eval: clampPawns(first.evaluationBefore, first.mateBefore), label: formatEval(first.evaluationBefore, first.mateBefore), san: 'Start' },
    ...moves.map((m) => ({
      ply: m.ply,
      eval: clampPawns(m.evaluationAfter, m.mateAfter),
      label: formatEval(m.evaluationAfter, m.mateAfter),
      san: `${moveNumberLabel(m.ply)} ${m.playedMove}`,
    })),
  ]
}

/** Evaluation over plies, White's point of view, clamped to ±10 pawns. Click to jump to a move. */
export function EvalGraph({ moves, selectedPly, onSelect, height = 150 }: EvalGraphProps) {
  const data = evalSeries(moves)
  if (data.length < 2) return null
  return (
    <div style={{ height }} className="w-full" role="img" aria-label="Evaluation graph. Positive values favour White.">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 6, right: 6, bottom: 0, left: -24 }}
          onClick={(s) => {
            const i = Number(s?.activeIndex)
            if (Number.isFinite(i)) onSelect(data[i]?.ply ?? 0)
          }}
          style={{ cursor: 'pointer' }}
        >
          <defs>
            <linearGradient id="evalFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="50%" stopColor="var(--fg)" stopOpacity={0.14} />
              <stop offset="50%" stopColor="var(--fg)" stopOpacity={0.04} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="ply" hide />
          <YAxis domain={[-10, 10]} ticks={[-10, -5, 0, 5, 10]} tick={{ fontSize: 10, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="var(--line-strong)" />
          <ReferenceLine x={selectedPly} stroke="var(--primary)" strokeWidth={2} />
          <Tooltip
            cursor={{ stroke: 'var(--subtle)', strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload ? (payload[0].payload as Point) : null
              if (!p) return null
              return (
                <div className="rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-lg">
                  <span className="font-mono">{p.san}</span> <span className="font-semibold">{p.label}</span>
                </div>
              )
            }}
          />
          <Area
            type="monotone"
            dataKey="eval"
            baseValue={0}
            stroke="var(--primary)"
            strokeWidth={1.75}
            fill="url(#evalFill)"
            isAnimationActive={false}
            activeDot={{ r: 3.5 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
