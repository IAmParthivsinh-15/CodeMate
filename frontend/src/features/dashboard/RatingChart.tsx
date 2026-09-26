import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatDate } from '../../utils/format'

export interface RatingPoint {
  at: string
  rating: number
  delta?: number
}

/** Rating over time. Needs at least two points to draw a line. */
export function RatingChart({ points, height = 200, startRating }: { points: RatingPoint[]; height?: number; startRating?: number }) {
  const data = startRating != null && points.length ? [{ at: points[0].at, rating: startRating, delta: 0 }, ...points] : points
  if (data.length < 2) return null
  const ratings = data.map((d) => d.rating)
  const min = Math.floor((Math.min(...ratings) - 20) / 50) * 50
  const max = Math.ceil((Math.max(...ratings) + 20) / 50) * 50
  return (
    <div style={{ height }} className="w-full" role="img" aria-label={`Rating history from ${ratings[0]} to ${ratings[ratings.length - 1]}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="3 3" />
          <XAxis dataKey="at" tickFormatter={(v: string) => formatDate(v)} tick={{ fontSize: 10, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} minTickGap={40} />
          <YAxis domain={[min, max]} tick={{ fontSize: 10, fill: 'var(--subtle)' }} axisLine={false} tickLine={false} width={48} />
          <Tooltip
            content={({ active, payload }) => {
              const p = active && payload?.[0]?.payload ? (payload[0].payload as RatingPoint) : null
              if (!p) return null
              return (
                <div className="rounded-md border border-line bg-surface px-2 py-1 text-xs shadow-lg">
                  <p className="font-semibold tabular-nums">
                    {p.rating}
                    {p.delta ? <span className={p.delta > 0 ? 'text-success' : 'text-danger'}> ({p.delta > 0 ? '+' : ''}{p.delta})</span> : null}
                  </p>
                  <p className="text-muted">{formatDate(p.at)}</p>
                </div>
              )
            }}
          />
          <Line type="monotone" dataKey="rating" stroke="var(--primary)" strokeWidth={2} dot={data.length < 25 ? { r: 2.5 } : false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
