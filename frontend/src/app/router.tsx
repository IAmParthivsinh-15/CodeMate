import { lazy, Suspense, type ComponentType, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import { ErrorBoundary } from '../components/layout/ErrorBoundary'
import { ProtectedRoute, PublicOnlyRoute } from '../components/layout/ProtectedRoute'
import { PageSpinner } from '../components/ui/Spinner'
import { LoginPage } from '../features/auth/LoginPage'
import { RegisterPage } from '../features/auth/RegisterPage'
import { LandingPage } from './LandingPage'
import { NotFoundPage } from './NotFoundPage'

/** React.lazy for named exports, so the chess board / editor / charts split into their own chunks. */
function lazyNamed<M extends Record<string, unknown>, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType }))
}

const DashboardPage = lazyNamed(() => import('../features/dashboard/DashboardPage'), 'DashboardPage')
const PlayHubPage = lazyNamed(() => import('../features/games/PlayHubPage'), 'PlayHubPage')
const PlayAiPage = lazyNamed(() => import('../features/games/PlayAiPage'), 'PlayAiPage')
const PlayLocalPage = lazyNamed(() => import('../features/games/PlayLocalPage'), 'PlayLocalPage')
const PlayOnlinePage = lazyNamed(() => import('../features/games/PlayOnlinePage'), 'PlayOnlinePage')
const OnlineGamePage = lazyNamed(() => import('../features/games/OnlineGamePage'), 'OnlineGamePage')
const GamesListPage = lazyNamed(() => import('../features/games/GamesListPage'), 'GamesListPage')
const GameDetailPage = lazyNamed(() => import('../features/games/GameDetailPage'), 'GameDetailPage')
const GameAnalysisPage = lazyNamed(() => import('../features/games/GameAnalysisPage'), 'GameAnalysisPage')
const CoachPage = lazyNamed(() => import('../features/ai/CoachPage'), 'CoachPage')
const ChessKnowledgePage = lazyNamed(() => import('../features/ai/ChessKnowledgePage'), 'ChessKnowledgePage')
const PuzzlesPage = lazyNamed(() => import('../features/learning/PuzzlesPage'), 'PuzzlesPage')
const ProblemListPage = lazyNamed(() => import('../features/coding/ProblemListPage'), 'ProblemListPage')
const ProblemPage = lazyNamed(() => import('../features/coding/ProblemPage'), 'ProblemPage')
const SubmissionsPage = lazyNamed(() => import('../features/coding/SubmissionsPage'), 'SubmissionsPage')
const ProfilePage = lazyNamed(() => import('../features/profile/ProfilePage'), 'ProfilePage')
const SettingsPage = lazyNamed(() => import('../features/profile/SettingsPage'), 'SettingsPage')

function Page({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageSpinner />}>{children}</Suspense>
    </ErrorBoundary>
  )
}

const PROTECTED: { path: string; element: ReactNode }[] = [
  { path: '/dashboard', element: <DashboardPage /> },
  { path: '/play', element: <PlayHubPage /> },
  { path: '/play/ai', element: <PlayAiPage /> },
  { path: '/play/local', element: <PlayLocalPage /> },
  { path: '/play/online', element: <PlayOnlinePage /> },
  { path: '/play/online/:gameId', element: <OnlineGamePage /> },
  { path: '/games', element: <GamesListPage /> },
  { path: '/games/:gameId', element: <GameDetailPage /> },
  { path: '/games/:gameId/analysis', element: <GameAnalysisPage /> },
  { path: '/ai-coach', element: <CoachPage /> },
  { path: '/chess-knowledge', element: <ChessKnowledgePage /> },
  { path: '/puzzles', element: <PuzzlesPage /> },
  { path: '/coding', element: <ProblemListPage /> },
  { path: '/coding/submissions', element: <SubmissionsPage /> },
  { path: '/coding/:problemId', element: <ProblemPage /> },
  { path: '/profile', element: <ProfilePage /> },
  { path: '/settings', element: <SettingsPage /> },
]

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route
        path="/login"
        element={
          <PublicOnlyRoute>
            <LoginPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicOnlyRoute>
            <RegisterPage />
          </PublicOnlyRoute>
        }
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        {PROTECTED.map((r) => (
          <Route key={r.path} path={r.path} element={<Page>{r.element}</Page>} />
        ))}
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
