import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '../../components/layout/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { ButtonLink } from '../../components/ui/Button'
import { Card, CardBody, CardHeader } from '../../components/ui/Card'
import { EmptyState } from '../../components/ui/EmptyState'
import { ErrorState } from '../../components/ui/ErrorState'
import { Skeleton, SkeletonCard } from '../../components/ui/Skeleton'
import { StatTile } from '../../components/ui/StatTile'
import { api } from '../../services/apiClient'
import type { Dashboard } from '../../types/api'
import { CLASSIFICATION, CLASSIFICATION_ORDER, themeLabel } from '../../utils/chess'
import { formatNumber, formatPercent, formatRelative, titleCase } from '../../utils/format'
import { useUser } from '../auth/authContext'
import { LANGUAGE_LABEL } from '../coding/api'
import { SubmissionStatusBadge } from '../coding/SubmissionStatusBadge'
import { AnalysisBadge, OutcomeBadge } from '../games/GameBadges'
import { resumeHref } from '../games/links'
import { RatingChart } from './RatingChart'

function QuickAction({ to, icon, title, text }: { to: string; icon: string; title: string; text: string }) {
  return (
    <Link to={to} className="group flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:border-primary">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft font-mono text-lg text-primary" aria-hidden="true">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-medium group-hover:text-primary">{title}</span>
        <span className="block truncate text-xs text-muted">{text}</span>
      </span>
    </Link>
  )
}

function Section({ title, action, children, className }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader title={title} action={action} />
      <CardBody>{children}</CardBody>
    </Card>
  )
}

function MistakeChart({ dist }: { dist: Dashboard['chess']['mistakeDistribution'] }) {
  const data = CLASSIFICATION_ORDER.map((c) => ({ key: c, label: CLASSIFICATION[c].label, value: dist[c] ?? 0, color: CLASSIFICATION[c].color }))
  if (data.every((d) => d.value === 0)) return <p className="text-sm text-muted">No analyzed moves yet.</p>
  return (
    <div className="h-48" role="img" aria-label={`Move classifications: ${data.map((d) => `${d.label} ${d.value}`).join(', ')}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="label" width={78} tick={{ fontSize: 11, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: 'var(--surface-2)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 8, fontSize: 12 }} />
          <Bar dataKey="value" name="Moves" radius={[0, 4, 4, 0]} isAnimationActive={false}>
            {data.map((d) => (
              <Cell key={d.key} fill={d.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function Meter({ label, value, max, right }: { label: ReactNode; value: number; max: number; right?: ReactNode }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex justify-between gap-2 text-sm">
        <span className="truncate">{label}</span>
        <span className="text-muted tabular-nums">{right ?? value}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden="true">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-20" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  )
}

export function DashboardPage() {
  const user = useUser()
  const dash = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<Dashboard>('/api/dashboard') })

  return (
    <>
      <PageHeader title={`Welcome back, ${user.username}`} docTitle="Dashboard" description="Play → Analyze → Learn → Practice → Improve." />
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <QuickAction to="/play/ai" icon="♜" title="Play vs AI" text="Stockfish, six levels" />
        <QuickAction to="/play/online" icon="⚡" title="Quick match" text="Live game with a clock" />
        <QuickAction to="/coding" icon="</>" title="Solve a problem" text="Earn hint credits" />
      </div>

      {dash.isPending ? (
        <DashboardSkeleton />
      ) : dash.isError ? (
        <Card>
          <ErrorState title="Couldn't load your dashboard" error={dash.error} onRetry={() => dash.refetch()} />
        </Card>
      ) : (
        <DashboardContent d={dash.data} />
      )}
    </>
  )
}

function DashboardContent({ d }: { d: Dashboard }) {
  const { chess, coding, ai, learning } = d
  const newPlayer = chess.games === 0 && d.recentGames.length === 0
  const maxLang = Math.max(1, ...coding.languages.map((l) => l.submissions))
  const difficulties = Object.entries(coding.difficulty ?? {})
  const maxDiff = Math.max(1, ...difficulties.map(([, n]) => n))

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatTile label="Rating" value={chess.rating} hint={`Peak ${chess.peakRating}`} tone="primary" />
        <StatTile label="Games" value={chess.games} hint={`${chess.wins}W · ${chess.draws}D · ${chess.losses}L`} />
        <StatTile label="Win rate" value={formatPercent(chess.winRate)} />
        <StatTile label="Accuracy" value={formatPercent(chess.accuracy)} hint={`${chess.gamesAnalyzed} analyzed`} />
        <StatTile label="Avg. CP loss" value={formatNumber(chess.averageCentipawnLoss)} />
        <StatTile label="Puzzles solved" value={`${learning.puzzlesSolved}/${learning.puzzles}`} />
      </div>

      {newPlayer && (
        <Card>
          <EmptyState
            icon="♞"
            title="Your first game starts the loop"
            description="Play a game and CodeMate analyzes it with Stockfish, turns your mistakes into puzzles, and starts building your coaching report."
            action={<ButtonLink to="/play/ai">Play your first game</ButtonLink>}
          />
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Rating history">
          {chess.ratingHistory.length < 1 ? (
            <EmptyState compact title="No rated games yet" description="Rated games against the engine or online players move your rating." />
          ) : (
            <RatingChart points={chess.ratingHistory} startRating={chess.ratingHistory[0].rating - (chess.ratingHistory[0].delta ?? 0)} />
          )}
        </Section>

        <Section title="Mistake distribution" action={<Link to="/ai-coach" className="text-sm text-primary hover:underline">Coach →</Link>}>
          <MistakeChart dist={chess.mistakeDistribution} />
          {chess.themes.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {chess.themes.slice(0, 5).map((t) => (
                <Badge key={t.theme} tone="warning">
                  {t.label || themeLabel(t.theme)} · {t.count}
                </Badge>
              ))}
            </div>
          )}
        </Section>

        <Section title="Top openings">
          {chess.openings.length === 0 ? (
            <p className="text-sm text-muted">Openings appear after a few games.</p>
          ) : (
            <ul className="divide-y divide-line">
              {chess.openings.slice(0, 5).map((o) => (
                <li key={o.name} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {o.eco && <span className="mr-1.5 font-mono text-xs text-subtle">{o.eco}</span>}
                    {o.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted tabular-nums">
                    {o.games} · {o.wins}W {o.draws}D {o.losses}L
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Recent games" action={<Link to="/games" className="text-sm text-primary hover:underline">All games →</Link>}>
          {d.recentGames.length === 0 ? (
            <p className="text-sm text-muted">No games yet.</p>
          ) : (
            <ul className="divide-y divide-line">
              {d.recentGames.map((g) => {
                const live = g.status === 'in_progress' || g.status === 'waiting'
                const to = live ? resumeHref(g) : g.analysisStatus === 'completed' ? `/games/${g._id}/analysis` : `/games/${g._id}`
                return (
                  <li key={g._id}>
                    <Link to={to} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">
                          {g.mode === 'ai' ? `vs Stockfish (${g.difficulty})` : g.mode === 'local' ? 'Local game' : 'Online game'}
                        </p>
                        <p className="truncate text-xs text-muted">
                          {g.opening ?? `${Math.ceil((g.plies ?? 0) / 2)} moves`} · {formatRelative(g.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {!live && <AnalysisBadge status={g.analysisStatus} />}
                        <OutcomeBadge outcome={g.outcome} status={g.status} />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </Section>

        <Section title="Coding" action={<Link to="/coding/submissions" className="text-sm text-primary hover:underline">Submissions →</Link>}>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile label="Solved" value={coding.problemsSolved} />
            <StatTile label="Acceptance" value={formatPercent(coding.acceptanceRate)} />
            <StatTile label="Hints" value={coding.hintCredits} />
          </div>
          {coding.submissions === 0 ? (
            <EmptyState compact title="No submissions yet" description="Solve a problem to earn your first hint credit." action={<ButtonLink to="/coding" size="sm">Browse problems</ButtonLink>} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Languages</p>
                {coding.languages.map((l) => (
                  <Meter key={l.language} label={LANGUAGE_LABEL[l.language] ?? l.language} value={l.submissions} max={maxLang} right={`${l.accepted}/${l.submissions}`} />
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium tracking-wide text-muted uppercase">Solved by difficulty</p>
                {difficulties.length === 0 ? (
                  <p className="text-sm text-muted">Nothing solved yet.</p>
                ) : (
                  difficulties.map(([k, n]) => <Meter key={k} label={titleCase(k)} value={n} max={maxDiff} />)
                )}
              </div>
            </div>
          )}
          {coding.recentSubmissions.length > 0 && (
            <ul className="mt-4 divide-y divide-line border-t border-line pt-2">
              {coding.recentSubmissions.map((s) => (
                <li key={s._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <Link to={s.problem ? `/coding/${s.problem.slug}` : '/coding'} className="min-w-0 truncate hover:text-primary">
                    {s.problem?.title ?? 'Problem'}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-muted">{formatRelative(s.createdAt)}</span>
                    <SubmissionStatusBadge status={s.status} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="AI insights" action={<Link to="/chess-knowledge" className="text-sm text-primary hover:underline">Ask →</Link>}>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile label="Analyzed" value={ai.gamesAnalyzed} hint={ai.analysisPending ? `${ai.analysisPending} pending` : undefined} />
            <StatTile label="Questions" value={ai.questions} />
            <StatTile label="Puzzles" value={learning.puzzles} hint={`${learning.puzzlesSolved} solved`} />
          </div>
          {ai.topConcepts.length > 0 && (
            <div className="mb-3">
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Most discussed concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {ai.topConcepts.map((c) => (
                  <Link key={c.concept} to={`/chess-knowledge?q=${encodeURIComponent(c.concept)}`} className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs text-primary hover:underline">
                    {c.concept} · {c.count}
                  </Link>
                ))}
              </div>
            </div>
          )}
          {ai.recommendations.length > 0 ? (
            <div>
              <p className="mb-1.5 text-xs font-medium tracking-wide text-muted uppercase">Training recommendations</p>
              <ul className="space-y-1.5 text-sm">
                {ai.recommendations.map((r) => (
                  <li key={r.theme} className="flex gap-2">
                    <span className="text-primary" aria-hidden="true">
                      →
                    </span>
                    <Link to={`/puzzles?theme=${r.theme}`} className="hover:text-primary">
                      {r.text}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">Recommendations appear once a few games are analyzed.</p>
          )}
        </Section>
      </div>
    </div>
  )
}
