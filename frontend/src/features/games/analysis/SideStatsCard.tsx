import { Card } from '../../../components/ui/Card'
import type { GameAnalysis, SideStats } from '../../../types/api'
import { CLASSIFICATION, CLASSIFICATION_ORDER } from '../../../utils/chess'
import { formatNumber, formatPercent } from '../../../utils/format'

function Column({ title, stats, you }: { title: string; stats: SideStats; you: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="mb-2 text-sm font-semibold">
        {title} {you && <span className="text-xs font-normal text-muted">(you)</span>}
      </p>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-[11px] tracking-wide text-muted uppercase">Accuracy</p>
          <p className="text-lg font-semibold tabular-nums">{formatPercent(stats.accuracy)}</p>
        </div>
        <div className="rounded-lg bg-surface-2 px-3 py-2">
          <p className="text-[11px] tracking-wide text-muted uppercase">ACPL</p>
          <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.averageCentipawnLoss)}</p>
        </div>
      </div>
      <ul className="space-y-1 text-sm">
        {CLASSIFICATION_ORDER.map((c) => {
          const n = stats.counts?.[c] ?? 0
          const meta = CLASSIFICATION[c]
          return (
            <li key={c} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden="true" />
                {meta.label}
              </span>
              <span className={n ? 'font-medium tabular-nums' : 'text-subtle tabular-nums'}>{n}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

export function SideStatsCard({ analysis, yourColor }: { analysis: GameAnalysis; yourColor: 'w' | 'b' | null }) {
  return (
    <Card className="p-4">
      <div className="flex gap-5">
        <Column title="White" stats={analysis.white} you={yourColor === 'w'} />
        <div className="w-px bg-line" aria-hidden="true" />
        <Column title="Black" stats={analysis.black} you={yourColor === 'b'} />
      </div>
      <p className="mt-3 text-xs text-subtle">
        {analysis.engineVersion} · depth {analysis.depth}
      </p>
    </Card>
  )
}
