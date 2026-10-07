import type { Classification, EngineFact } from '../../types/api'
import { CLASSIFICATION, themeLabel } from '../../utils/chess'
import { cn } from '../../utils/cn'

/** "Stockfish facts": the verified numbers an AI answer is grounded in. */
export function EngineFactsCard({ facts, className, onJump }: { facts: EngineFact[] | undefined; className?: string; onJump?: (ply: number) => void }) {
  if (!facts?.length) return null
  return (
    <div className={cn('rounded-lg border border-line bg-surface-2 p-2.5 text-xs', className)}>
      <p className="mb-1.5 font-semibold tracking-wide text-muted uppercase">Stockfish facts</p>
      <ul className="space-y-1.5">
        {facts.slice(0, 5).map((f) => {
          const meta = CLASSIFICATION[f.classification as Classification]
          return (
            <li key={f.ply} className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <button
                type="button"
                disabled={!onJump}
                onClick={() => onJump?.(f.ply)}
                className="font-mono font-medium enabled:hover:text-primary enabled:hover:underline"
              >
                {f.moveNumber}
                {f.color === 'White' ? '.' : '…'} {f.played}
              </button>
              {meta && (
                <span className="font-medium" style={{ color: meta.color }}>
                  {meta.label}
                </span>
              )}
              <span className="font-mono text-muted">
                {f.evalBefore} → {f.evalAfter}
              </span>
              {f.centipawnLoss > 0 && <span className="text-muted">−{f.centipawnLoss} cp</span>}
              {f.bestMove && f.bestMove !== f.played && (
                <span className="text-muted">
                  best <span className="font-mono text-fg">{f.bestMove}</span>
                </span>
              )}
              {f.themes.length > 0 && <span className="text-muted">· {f.themes.map(themeLabel).join(', ')}</span>}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
