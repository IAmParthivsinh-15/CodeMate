import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../features/auth/authContext'
import { cn } from '../../utils/cn'
import { ConnectionIndicator } from './ConnectionIndicator'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

interface NavItem {
  to: string
  label: string
  icon: ReactNode
  end?: boolean
}

const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: 'Overview',
    items: [{ to: '/dashboard', label: 'Dashboard', icon: '▦' }],
  },
  {
    section: 'Chess',
    items: [
      { to: '/play', label: 'Play', icon: '♟' },
      { to: '/games', label: 'My games', icon: '☰', end: false },
      { to: '/puzzles', label: 'Puzzles', icon: '✦' },
    ],
  },
  {
    section: 'AI',
    items: [
      { to: '/ai-coach', label: 'AI coach', icon: '◎' },
      { to: '/chess-knowledge', label: 'Chess knowledge', icon: '❖' },
    ],
  },
  {
    section: 'Code',
    items: [
      { to: '/coding', label: 'Problems', icon: '</>', end: true },
      { to: '/coding/submissions', label: 'Submissions', icon: '⇪' },
    ],
  },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="space-y-5">
      {NAV.map((group) => (
        <div key={group.section}>
          <p className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-subtle uppercase">{group.section}</p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive ? 'bg-primary-soft text-primary' : 'text-muted hover:bg-surface-2 hover:text-fg',
                    )
                  }
                >
                  <span className="w-5 text-center font-mono text-xs" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!user) return null
  const initial = user.username.slice(0, 1).toUpperCase()
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2"
      >
        <span className="grid size-8 place-items-center rounded-full bg-primary-soft text-sm font-semibold text-primary" aria-hidden="true">
          {initial}
        </span>
        <span className="hidden max-w-32 truncate text-sm font-medium sm:inline">{user.username}</span>
        <span className="hidden text-xs text-muted tabular-nums sm:inline" title="Rating">
          {user.chessStats?.rating ?? 800}
        </span>
      </button>
      {open && (
        <div role="menu" className="animate-fade-in absolute right-0 z-40 mt-2 w-56 rounded-xl border border-line bg-surface p-1 shadow-xl">
          <div className="border-b border-line px-3 py-2">
            <p className="truncate text-sm font-medium">{user.username}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
            <p className="mt-1 text-xs text-muted">
              Hint credits: <span className="font-medium text-fg">{user.hintCredits}</span>
            </p>
          </div>
          {[
            { to: '/profile', label: 'Profile' },
            { to: '/settings', label: 'Settings' },
          ].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface-2"
            >
              {l.label}
            </Link>
          ))}
          <button
            type="button"
            role="menuitem"
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
            onClick={async () => {
              setOpen(false)
              await logout()
              navigate('/login', { replace: true })
            }}
          >
            Log out
          </button>
        </div>
      )}
    </div>
  )
}

/** Signed-in layout: sidebar on desktop, top bar + drawer on mobile. */
export function AppShell() {
  const [drawer, setDrawer] = useState(false)
  const location = useLocation()
  // The coding workspace (/coding/:problemId) uses the full window width, like an IDE.
  const workspace = /^\/coding\/(?!submissions$)[^/]+$/.test(location.pathname)

  // Close the drawer on navigation.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    if (drawer) setDrawer(false)
  }

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [drawer])

  return (
    <div className="min-h-screen lg:pl-60">
      <a href="#main" className="sr-only z-50 rounded bg-primary px-3 py-2 text-primary-fg focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center px-5">
          <Logo to="/dashboard" />
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <NavLinks />
        </div>
        <div className="border-t border-line px-5 py-3">
          <ConnectionIndicator showLabel />
        </div>
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade-in absolute inset-0 bg-black/40" aria-hidden="true" onClick={() => setDrawer(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="animate-slide-up absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-2xl"
          >
            <div className="flex h-14 items-center justify-between px-4">
              <Logo to="/dashboard" />
              <button type="button" aria-label="Close menu" className="rounded-md p-2 text-muted hover:bg-surface-2" onClick={() => setDrawer(false)}>
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              <NavLinks onNavigate={() => setDrawer(false)} />
            </div>
            <div className="border-t border-line px-4 py-3">
              <ConnectionIndicator showLabel />
            </div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 backdrop-blur sm:px-4 lg:h-16 lg:px-6">
        <button
          type="button"
          aria-label="Open menu"
          aria-expanded={drawer}
          className="grid size-9 place-items-center rounded-lg text-muted hover:bg-surface-2 lg:hidden"
          onClick={() => setDrawer(true)}
        >
          ☰
        </button>
        <div className="lg:hidden">
          <Logo to="/dashboard" />
        </div>
        <div className="flex-1" />
        <ConnectionIndicator className="lg:hidden" />
        <ThemeToggle />
        <UserMenu />
      </header>

      <main id="main" className={workspace ? 'w-full px-2 py-2 lg:px-3' : 'mx-auto w-full max-w-7xl px-3 py-5 sm:px-5 lg:px-8 lg:py-8'}>
        <Outlet />
      </main>
    </div>
  )
}
