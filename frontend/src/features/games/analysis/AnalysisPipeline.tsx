import { Button } from '../../../components/ui/Button'
import { Card, CardBody } from '../../../components/ui/Card'
import { Spinner } from '../../../components/ui/Spinner'
import type { AiStatusValue, AnalysisStatus } from '../../../types/api'

type StepState = 'done' | 'running' | 'waiting' | 'failed' | 'skipped'

function Step({ state, label, detail }: { state: StepState; label: string; detail?: string }) {
  const icon =
    state === 'done' ? (
      <span className="text-success">✓</span>
    ) : state === 'running' ? (
      <Spinner className="text-warning" label="In progress" />
    ) : state === 'failed' ? (
      <span className="text-danger">✕</span>
    ) : state === 'skipped' ? (
      <span className="text-subtle">–</span>
    ) : (
      <span className="text-subtle">⏳</span>
    )
  return (
    <li className="flex items-center gap-3">
      <span className="grid w-5 place-items-center" aria-hidden="true">
        {icon}
      </span>
      <span className={state === 'done' ? 'text-fg' : 'text-muted'}>{label}</span>
      {detail && <span className="text-xs text-subtle">{detail}</span>}
    </li>
  )
}

interface AnalysisPipelineProps {
  status: AnalysisStatus
  aiStatus: AiStatusValue
  gameFinished: boolean
  onAnalyze?: () => void
  analyzing?: boolean
  compact?: boolean
}

/** Spec §28: ✓ Game saved / ⏳ Engine analysis / ⏳ AI coach report. */
export function AnalysisPipeline({ status, aiStatus, gameFinished, onAnalyze, analyzing, compact }: AnalysisPipelineProps) {
  const engine: StepState =
    status === 'completed' ? 'done' : status === 'pending' || status === 'running' ? 'running' : status === 'failed' ? 'failed' : 'waiting'
  const ai: StepState =
    aiStatus === 'completed'
      ? 'done'
      : aiStatus === 'pending'
        ? 'running'
        : aiStatus === 'failed'
          ? 'failed'
          : aiStatus === 'skipped'
            ? 'skipped'
            : 'waiting'

  const list = (
    <ul className="space-y-2 text-sm" aria-label="Analysis status">
      <Step state={gameFinished ? 'done' : 'waiting'} label="Game saved" detail={gameFinished ? undefined : 'finish the game first'} />
      <Step
        state={engine}
        label={engine === 'done' ? 'Engine analysis completed' : engine === 'running' ? 'Engine analysis running…' : engine === 'failed' ? 'Engine analysis failed' : 'Engine analysis'}
      />
      <Step
        state={ai}
        label={ai === 'done' ? 'AI coach report ready' : ai === 'running' ? 'AI coach report being written…' : 'AI coach report'}
        detail={ai === 'skipped' ? 'not available (no LLM configured)' : undefined}
      />
    </ul>
  )
  if (compact) return list

  const canAnalyze = gameFinished && (status === 'none' || status === 'failed')
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-semibold">Analysis status</h2>
          <p className="text-sm text-muted">
            {engine === 'running'
              ? 'Stockfish is going through every move. This usually takes a few seconds.'
              : canAnalyze
                ? 'This game has not been analyzed yet.'
                : !gameFinished
                  ? 'Analysis is available once the game is over.'
                  : ''}
          </p>
        </div>
        {list}
        {canAnalyze && onAnalyze && (
          <Button onClick={onAnalyze} loading={analyzing}>
            {status === 'failed' ? 'Retry analysis' : 'Analyze'}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}
