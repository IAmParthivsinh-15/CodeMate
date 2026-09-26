import { Logo } from '../components/layout/Logo'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { ButtonLink } from '../components/ui/Button'
import { useAuth } from '../features/auth/authContext'
import { useDocumentTitle } from '../hooks/useDocumentTitle'

const LOOP = [
  { step: 'Play', text: 'Against Stockfish at six levels, a friend on the same device, or live online with clocks.' },
  { step: 'Analyze', text: 'Every finished game gets engine analysis: accuracy, centipawn loss and move-by-move classifications.' },
  { step: 'Learn', text: 'Ask the AI about any move. Answers are grounded in Stockfish facts and a curated chess knowledge base.' },
  { step: 'Practice', text: 'Your own mistakes become puzzles, so you train the positions you actually get wrong.' },
  { step: 'Improve', text: 'A personal coach tracks recurring weaknesses across games and builds you a training plan.' },
]

const PILLARS = [
  { title: 'Chess', icon: '♞', text: 'Authoritative server-side games, replays, PGN export, ratings and matchmaking.' },
  { title: 'Code', icon: '</>', text: 'Solve programming problems in JavaScript, Python, Java or C++. Each new solve earns an engine hint.' },
  { title: 'AI', icon: '◎', text: 'Explanations, a game chat that knows the position you are looking at, and coaching summaries.' },
]

export function LandingPage() {
  useDocumentTitle(null)
  const { status } = useAuth()
  const signedIn = status === 'authenticated'

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <Logo />
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Account">
          <ThemeToggle />
          {signedIn ? (
            <ButtonLink to="/dashboard" size="sm">
              Open dashboard
            </ButtonLink>
          ) : (
            <>
              <ButtonLink to="/login" variant="ghost" size="sm">
                Log in
              </ButtonLink>
              <ButtonLink to="/register" size="sm">
                Sign up
              </ButtonLink>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-6xl px-4 pt-12 pb-16 text-center sm:px-6 sm:pt-20">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted">
            Chess <span aria-hidden="true">×</span> Code <span aria-hidden="true">×</span> AI
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-tight font-semibold tracking-tight sm:text-5xl">
            Get better at chess and code, <span className="text-primary">one mistake at a time.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted sm:text-lg">
            CodeMate turns every game you play into a lesson: Stockfish finds what went wrong, an AI coach explains why, and your
            mistakes come back as puzzles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {signedIn ? (
              <ButtonLink to="/play/ai" size="lg">
                Play vs AI
              </ButtonLink>
            ) : (
              <>
                <ButtonLink to="/register" size="lg">
                  Create a free account
                </ButtonLink>
                <ButtonLink to="/login" size="lg" variant="secondary">
                  I have an account
                </ButtonLink>
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="loop-title" className="border-y border-line bg-surface py-14">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 id="loop-title" className="text-center text-2xl font-semibold tracking-tight">
              Play → Analyze → Learn → Practice → Improve
            </h2>
            <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              {LOOP.map((s, i) => (
                <li key={s.step} className="rounded-xl border border-line bg-surface-2 p-4">
                  <div className="flex items-center gap-2">
                    <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-fg">{i + 1}</span>
                    <span className="font-semibold">{s.step}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-4 py-14 sm:grid-cols-3 sm:px-6">
          {PILLARS.map((p) => (
            <div key={p.title} className="rounded-card border border-line bg-surface p-6 shadow-card">
              <div className="grid size-10 place-items-center rounded-lg bg-primary-soft font-mono text-lg text-primary" aria-hidden="true">
                {p.icon}
              </div>
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-1 text-sm text-muted">{p.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-line py-6 text-center text-xs text-subtle">CodeMate · Built for players who like to understand why.</footer>
    </div>
  )
}
