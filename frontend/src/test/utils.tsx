import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, type MemoryRouterProps } from 'react-router'
import { vi } from 'vitest'
import { ThemeProvider } from '../app/ThemeProvider'
import { ToastProvider } from '../components/ui/Toast'
import { AuthProvider } from '../features/auth/AuthProvider'

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

export function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse({ success: false, error: { code, message }, message, requestId: 'req-1' }, status)
}

type Handler = (url: string, init: RequestInit | undefined) => Response | Promise<Response>

/** Route-based fetch mock: the first matching "METHOD path" wins. */
export function mockFetch(routes: Record<string, Handler>) {
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? 'GET').toUpperCase()
    const path = url.replace(/^https?:\/\/[^/]+/, '').split('?')[0]
    const handler = routes[`${method} ${path}`]
    if (!handler) return errorResponse(404, 'ROUTE_NOT_FOUND', `No mock for ${method} ${path}`)
    return handler(url, init)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

export const testUser = {
  _id: 'u1',
  username: 'magnus',
  email: 'magnus@example.com',
  chessStats: { gamesPlayed: 0, rating: 800, peakRating: 800, wins: 0, losses: 0, draws: 0 },
  codingStats: { problemsSolved: 0, submissions: 0, accepted: 0, preferredLanguage: 'javascript' },
  hintCredits: 0,
  preferences: { boardTheme: 'classic', pieceSet: 'default', defaultDifficulty: 'intermediate', showEvaluation: true },
  createdAt: '2026-01-01T00:00:00.000Z',
}

export function renderWithProviders(ui: ReactElement, { router }: { router?: MemoryRouterProps } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter {...router}>
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>{children}</AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>
  )
  return { client, ...render(ui, { wrapper: Wrapper }) }
}
