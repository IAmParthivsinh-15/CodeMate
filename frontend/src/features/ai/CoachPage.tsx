import { useQuery } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Markdown } from '../../components/ui/Markdown'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { StatTile } from '../../components/ui/StatTile'
import { useToast } from '../../components/ui/toastContext'
import { errorMessage } from '../../services/apiClient'
import type { CoachNarrative, CoachReportFull, Trend } from '../../types/api'
import { cn } from '../../utils/cn'
import { formatNumber, formatPercent, moveNumberLabel, titleCase } from '../../utils/format'
import { analysisHref } from '../games/links'
import { aiApi } from './api'
import { ChatView } from './ChatView'
import { useChat } from './useChat'

const TREND: Record<Trend, { icon: string; label: string; className: string }> = {
  improving: { icon: '↑', label: 'Improving', className: 'text-success' },
  stable: { icon: '→', label: 'Stable', className: 'text-muted' },
  needs_attention: { icon: '↓', label: 'Needs attention', className: 'text-danger' },
  not_enough_data: { icon: '·', label: 'Not enough data', className: 'text-subtle' },
}

function TrendLabel({ trend }: { trend: Trend }) {
  const t = TREND[trend] ?? TREND.not_enough_data
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', t.className)}>
      <span aria-hidden="true">{t.icon}</span> {t.label}
    </span>
  )
}

const PLAN_KEY = 'codemate.coach.plan'

function TrainingPlan({ plan }: { plan: CoachReportFull['trainingPlan'] }) {
  const signature = plan.map((p) => p.text).join('|')
  const [done, setDone] = useState<Record<string, boolean>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(PLAN_KEY) ?? '{}') as { signature?: string; done?: Record<string, boolean> }
      return stored.signature === signature ? (stored.done ?? {}) : {}
    } catch {
      return {}
    }
  })
  const toggle = (k: string) => {
    const next = { ...done, [k]: !done[k] }
    setDone(next)
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify({ signature, done: next }))
    } catch {
      // Checklist state is a convenience only.
    }
  }
  if (plan.length === 0) return <p className="text-sm text-muted">No plan yet.</p>
  return (
    <ul className="space-y-2">
      {plan.map((p) => {
        const k = String(p.step)
        return (
          <li key={k}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 hover:bg-surface-2">
              <input type="checkbox" checked={!!done[k]} onChange={() => toggle(k)} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span className={cn('text-sm', done[k] && 'text-muted line-through')}>
                <span className="mr-1 text-xs font-semibold text-primary uppercase">{p.type}</span> {p.text}
                {p.source && (
                  <Link to={`/chess-knowledge?q=${encodeURIComponent(p.source.split('/').pop()?.replace(/\.md$/, '').replace(/[-_]/g, ' ') ?? '')}`} className="ml-1 text-xs text-primary hover:underline">
                    Read →
                  </Link>
                )}
              </span>
            </label>
          </li>
        )
      })}
    </ul>
  )
}

function CoachChat() {
  const chat = useChat({
    key: ['chat', 'coach'],
    loadHistory: useCallback(() => aiApi.coachChatHistory(), []),
    send: useCallback((text: string) => aiApi.coachChat(text), []),
  })
  return (
    <ChatView
      messages={chat.messages}
      loading={chat.history.isPending}
      sending={chat.sending}
      onSend={(t) => chat.send(t)}
      suggestions={['What should I work on this week?', 'Why do I keep losing in the middlegame?', 'Which opening should I study?']}
      placeholder="Ask your coach…"
      heightClass="h-80"
    />
  )
}

function Report({ report }: { report: CoachReportFull }) {
  const toast = useToast()
  const [narrative, setNarrative] = useState<CoachNarrative | null>(null)
  const [generating, setGenerating] = useState(false)

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await aiApi.coachSummary()
      setNarrative(res.narrative)
    } catch (err) {
      toast.error(errorMessage(err), "Couldn't generate the summary")
    } finally {
      setGenerating(false)
    }
  }

  const blunders = report.classifications?.blunder ?? 0
  const mistakes = report.classifications?.mistake ?? 0

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Games analyzed" value={report.gamesAnalyzed} hint={`${formatNumber(report.movesAnalyzed)} moves`} />
        <StatTile label="Accuracy" value={formatPercent(report.accuracy)} tone="primary" />
        <StatTile label="Avg. centipawn loss" value={formatNumber(report.averageCentipawnLoss)} />
        <StatTile label="Mistakes + blunders" value={mistakes + blunders} hint={`${blunders} blunders`} tone={blunders ? 'danger' : 'default'} />
      </div>

      <Card>
        <CardHeader
          title="Coaching summary"
          subtitle="A written overview of your recent games."
          action={
            <Button size="sm" onClick={generate} loading={generating}>
              {narrative ? 'Regenerate' : 'Generate coaching summary'}
            </Button>
          }
        />
        <CardBody>
          {narrative ? (
            <div className="space-y-2">
              <Markdown>{narrative.answer}</Markdown>
              {narrative.degraded && <p className="text-[11px] text-subtle">Engine-facts mode (no LLM configured)</p>}
            </div>
          ) : (
            <p className="text-sm text-muted">Generate a summary to get a narrative review of your strengths, weaknesses and next steps.</p>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Skill categories" subtitle="Mistakes per 100 moves, with the recent trend." />
          <CardBody>
            <ul className="divide-y divide-line">
              {report.categories.map((c) => (
                <li key={c.key} className="flex items-center justify-between gap-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    <p className="text-xs text-muted">
                      {c.mistakes} mistakes · {formatNumber(c.per100Moves, 1)} / 100 moves
                    </p>
                  </div>
                  <TrendLabel trend={c.trend} />
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="By game phase" />
          <CardBody>
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Phase</th>
                  <th className="pb-2 text-right font-medium">Moves</th>
                  <th className="pb-2 text-right font-medium">ACPL</th>
                  <th className="pb-2 text-right font-medium">Mistakes / 100</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.phases.map((p) => (
                  <tr key={p.phase}>
                    <td className="py-2">{titleCase(p.phase)}</td>
                    <td className="py-2 text-right tabular-nums">{p.moves}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(p.averageCentipawnLoss)}</td>
                    <td className="py-2 text-right tabular-nums">{formatNumber(p.mistakesPer100, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Recurring mistakes" subtitle="Patterns that show up across several games." />
        <CardBody>
          {report.recurringMistakes.length === 0 ? (
            <p className="text-sm text-muted">No recurring pattern yet. Nice.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {report.recurringMistakes.map((r) => (
                <li key={r.theme} className="rounded-lg border border-line p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{r.label}</p>
                    <Badge tone="warning">
                      {r.games} game{r.games === 1 ? '' : 's'}
                    </Badge>
                  </div>
                  {r.example && (
                    <Link to={analysisHref(r.example.gameId, r.example.ply)} className="mt-1 inline-block text-sm text-primary hover:underline">
                      See example: {moveNumberLabel(r.example.ply)} {r.example.playedMove}
                      {r.example.bestMove ? ` (best ${r.example.bestMove})` : ''} →
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Strengths" />
          <CardBody>
            {report.strengths.length ? (
              <ul className="space-y-2 text-sm">
                {report.strengths.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-success" aria-hidden="true">
                      ✓
                    </span>
                    {s.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Play more analyzed games to find your strengths.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Weaknesses" />
          <CardBody>
            {report.weaknesses.length ? (
              <ul className="space-y-2 text-sm">
                {report.weaknesses.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-danger" aria-hidden="true">
                      !
                    </span>
                    {s.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No clear weaknesses yet.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Openings" />
        <CardBody className="overflow-x-auto">
          {report.openings.length === 0 ? (
            <p className="text-sm text-muted">No opening data yet.</p>
          ) : (
            <table className="w-full min-w-[28rem] text-sm">
              <thead className="text-left text-xs text-muted">
                <tr>
                  <th className="pb-2 font-medium">Opening</th>
                  <th className="pb-2 text-right font-medium">Games</th>
                  <th className="pb-2 text-right font-medium">W / D / L</th>
                  <th className="pb-2 text-right font-medium">Score</th>
                  <th className="pb-2 text-right font-medium">Accuracy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {report.openings.map((o) => (
                  <tr key={o.name}>
                    <td className="max-w-60 truncate py-2">{o.name}</td>
                    <td className="py-2 text-right tabular-nums">{o.games}</td>
                    <td className="py-2 text-right tabular-nums">
                      {o.wins} / {o.draws} / {o.losses}
                    </td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(o.score, 0)}</td>
                    <td className="py-2 text-right tabular-nums">{formatPercent(o.accuracy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recommended concepts" />
          <CardBody>
            {report.recommendedConcepts.length === 0 ? (
              <p className="text-sm text-muted">Nothing specific yet.</p>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {report.recommendedConcepts.map((c) => (
                  <li key={c.source}>
                    <Link
                      to={`/chess-knowledge?q=${encodeURIComponent(c.title)}`}
                      className="inline-flex rounded-full border border-line bg-surface-2 px-3 py-1 text-sm hover:border-primary hover:text-primary"
                    >
                      {c.title}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Recommended puzzles" subtitle="Built from your own mistakes." />
          <CardBody>
            {report.recommendedPuzzles.length === 0 ? (
              <p className="text-sm text-muted">No open puzzles right now.</p>
            ) : (
              <ul className="space-y-1.5">
                {report.recommendedPuzzles.map((p) => (
                  <li key={p._id}>
                    <Link to={`/puzzles?puzzle=${p._id}`} className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2">
                      <span>{titleCase(p.theme)}</span>
                      <Badge>{p.difficulty}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Training plan" subtitle="Tick items off as you go (saved on this device)." />
          <CardBody>
            <TrainingPlan plan={report.trainingPlan} />
          </CardBody>
        </Card>
        <Card className="flex flex-col">
          <CardHeader title="Ask your coach" />
          <CoachChat />
        </Card>
      </div>
    </div>
  )
}

export function CoachPage() {
  const report = useQuery({ queryKey: ['coach', 'report'], queryFn: aiApi.coachReport })
  return (
    <>
      <PageHeader title="AI coach" description="Your recurring patterns across every analyzed game, and what to train next." />
      {report.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard className="md:col-span-2" />
        </div>
      ) : report.isError ? (
        <ErrorState title="Couldn't build your coaching report" error={report.error} onRetry={() => report.refetch()} />
      ) : report.data.enoughData === false ? (
        <Card>
          <EmptyState
            icon="◎"
            title="Your coach needs a few more games"
            description={`${report.data.message} (${report.data.gamesAnalyzed} of ${report.data.minimumGames} analyzed games so far.)`}
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <ButtonLink to="/play/ai">Play vs AI</ButtonLink>
                <ButtonLink to="/games" variant="secondary">
                  Analyze a past game
                </ButtonLink>
              </div>
            }
          />
        </Card>
      ) : (
        <Report report={report.data} />
      )}
    </>
  )
}
