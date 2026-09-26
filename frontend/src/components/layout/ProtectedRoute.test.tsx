import { screen } from '@testing-library/react'
import { Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { __resetApiClientForTests } from '../../services/apiClient'
import { errorResponse, jsonResponse, mockFetch, renderWithProviders, testUser } from '../../test/utils'
import type { FromState } from './ProtectedRoute'
import { ProtectedRoute } from './ProtectedRoute'

function LoginProbe() {
  const location = useLocation()
  const from = (location.state as FromState | null)?.from
  return <p>login page, from={from ? `${from.pathname}${from.search}` : 'none'}</p>
}

const app = (
  <Routes>
    <Route path="/login" element={<LoginProbe />} />
    <Route
      path="/games/:id"
      element={
        <ProtectedRoute>
          <p>secret game page</p>
        </ProtectedRoute>
      }
    />
  </Routes>
)

beforeEach(() => __resetApiClientForTests())
afterEach(() => vi.unstubAllGlobals())

describe('ProtectedRoute', () => {
  it('redirects anonymous users to /login and remembers where they were going', async () => {
    mockFetch({
      'GET /api/auth/me': () => errorResponse(401, 'NO_TOKEN', 'Not authorized, no token'),
      'POST /api/auth/refresh': () => errorResponse(401, 'NO_REFRESH_TOKEN', 'Refresh token required'),
    })
    renderWithProviders(app, { router: { initialEntries: ['/games/42?ply=7'] } })
    expect(await screen.findByText('login page, from=/games/42?ply=7')).toBeInTheDocument()
    expect(screen.queryByText('secret game page')).not.toBeInTheDocument()
  })

  it('renders the page for signed-in users', async () => {
    mockFetch({ 'GET /api/auth/me': () => jsonResponse({ success: true, user: testUser }) })
    renderWithProviders(app, { router: { initialEntries: ['/games/42'] } })
    expect(await screen.findByText('secret game page')).toBeInTheDocument()
  })

  it('shows a retryable error when the session check fails for another reason', async () => {
    mockFetch({ 'GET /api/auth/me': () => errorResponse(500, 'INTERNAL_ERROR', 'Internal server error') })
    renderWithProviders(app, { router: { initialEntries: ['/games/42'] } })
    expect(await screen.findByText("Couldn't check your session")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })
})
