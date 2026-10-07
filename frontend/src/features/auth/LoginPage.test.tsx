import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PublicOnlyRoute } from '../../components/layout/ProtectedRoute'
import { __resetApiClientForTests, tokenStore } from '../../services/apiClient'
import { errorResponse, jsonResponse, mockFetch, renderWithProviders, testUser } from '../../test/utils'
import { LoginPage } from './LoginPage'

const app = (
  <Routes>
    <Route
      path="/login"
      element={
        <PublicOnlyRoute>
          <LoginPage />
        </PublicOnlyRoute>
      }
    />
    <Route path="/dashboard" element={<p>dashboard home</p>} />
    <Route path="/puzzles" element={<p>puzzles page</p>} />
  </Routes>
)

const anonymous = {
  'GET /api/auth/me': () => errorResponse(401, 'NO_TOKEN', 'Not authorized, no token'),
  'POST /api/auth/refresh': () => errorResponse(401, 'NO_REFRESH_TOKEN', 'Refresh token required'),
}

beforeEach(() => __resetApiClientForTests())
afterEach(() => vi.unstubAllGlobals())

describe('LoginPage', () => {
  it('logs in, stores the access token and goes to the dashboard', async () => {
    const fetchMock = mockFetch({
      ...anonymous,
      'POST /api/auth/login': () => jsonResponse({ success: true, user: testUser, token: 'access-1', refreshToken: 'refresh-1' }),
    })
    const user = userEvent.setup()
    renderWithProviders(app, { router: { initialEntries: ['/login'] } })

    await user.type(await screen.findByLabelText('Email'), 'magnus@example.com')
    await user.type(screen.getByLabelText('Password'), 'correct-horse')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('dashboard home')).toBeInTheDocument()
    expect(tokenStore.get()).toBe('access-1')
    const loginCall = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/auth/login') && init?.method === 'POST')
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({ email: 'magnus@example.com', password: 'correct-horse' })
  })

  it('returns to the page the user came from', async () => {
    mockFetch({
      ...anonymous,
      'POST /api/auth/login': () => jsonResponse({ success: true, user: testUser, token: 't', refreshToken: 'r' }),
    })
    const user = userEvent.setup()
    renderWithProviders(app, { router: { initialEntries: [{ pathname: '/login', state: { from: { pathname: '/puzzles', search: '' } } }] } })
    await user.type(await screen.findByLabelText('Email'), 'magnus@example.com')
    await user.type(screen.getByLabelText('Password'), 'pw123456')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByText('puzzles page')).toBeInTheDocument()
  })

  it('shows a friendly message for wrong credentials', async () => {
    mockFetch({ ...anonymous, 'POST /api/auth/login': () => errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid credentials') })
    const user = userEvent.setup()
    renderWithProviders(app, { router: { initialEntries: ['/login'] } })
    await user.type(await screen.findByLabelText('Email'), 'magnus@example.com')
    await user.type(screen.getByLabelText('Password'), 'wrong-pass')
    await user.click(screen.getByRole('button', { name: 'Log in' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.queryByText('dashboard home')).not.toBeInTheDocument()
  })

  it('validates empty fields without calling the API', async () => {
    const fetchMock = mockFetch(anonymous)
    const user = userEvent.setup()
    renderWithProviders(app, { router: { initialEntries: ['/login'] } })
    await user.click(await screen.findByRole('button', { name: 'Log in' }))
    expect(screen.getByText('Enter your email')).toBeInTheDocument()
    expect(screen.getByText('Enter your password')).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/api/auth/login'))).toBe(false)
  })
})
