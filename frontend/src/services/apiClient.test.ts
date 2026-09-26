import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { errorResponse, jsonResponse, mockFetch } from '../test/utils'
import { __resetApiClientForTests, api, ApiError, request, setUnauthorizedHandler, tokenStore } from './apiClient'

beforeEach(() => {
  __resetApiClientForTests()
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiClient error normalisation', () => {
  it('turns the error envelope into an ApiError with code, message, details and requestId', async () => {
    mockFetch({
      'POST /api/auth/register': () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: [{ path: 'body.email', message: 'Invalid email address' }] },
            message: 'Validation failed',
            requestId: 'abc',
          },
          400,
        ),
    })
    const err = await api.post('/api/auth/register', {}).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(ApiError)
    const e = err as ApiError
    expect(e.status).toBe(400)
    expect(e.code).toBe('VALIDATION_ERROR')
    expect(e.message).toBe('Validation failed')
    expect(e.details).toEqual([{ path: 'body.email', message: 'Invalid email address' }])
    expect(e.requestId).toBe('abc')
  })

  it('falls back to the legacy top-level message and an HTTP_<status> code', async () => {
    mockFetch({ 'GET /api/x': () => jsonResponse({ success: false, message: 'Old style error' }, 409) })
    const e = (await api.get('/api/x').catch((x: unknown) => x)) as ApiError
    expect(e.code).toBe('HTTP_409')
    expect(e.message).toBe('Old style error')
  })

  it('handles non-JSON error bodies', async () => {
    mockFetch({ 'GET /api/x': () => new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }) })
    const e = (await api.get('/api/x').catch((x: unknown) => x)) as ApiError
    expect(e.status).toBe(502)
    expect(e.code).toBe('HTTP_502')
    expect(e.message).toBe('Bad Gateway')
  })

  it('reports network failures as NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))))
    const e = (await api.get('/api/x').catch((x: unknown) => x)) as ApiError
    expect(e.code).toBe('NETWORK_ERROR')
    expect(e.status).toBe(0)
  })

  it('treats a 200 with success:false as an error', async () => {
    mockFetch({ 'GET /api/x': () => jsonResponse({ success: false, error: { code: 'NOPE', message: 'No' } }) })
    await expect(api.get('/api/x')).rejects.toMatchObject({ code: 'NOPE', message: 'No' })
  })

  it('sends credentials and the in-memory bearer token', async () => {
    const fetchMock = mockFetch({ 'GET /api/x': () => jsonResponse({ success: true, ok: 1 }) })
    tokenStore.set('tok-1')
    await api.get('/api/x', { a: 1, b: undefined })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/x?a=1')
    expect(init?.credentials).toBe('include')
    expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer tok-1')
  })
})

describe('apiClient refresh on 401', () => {
  it('refreshes once for concurrent 401s (single flight) and retries each request', async () => {
    let refreshCalls = 0
    let releaseRefresh: () => void = () => undefined
    const refreshGate = new Promise<void>((r) => (releaseRefresh = r))
    const fetchMock = mockFetch({
      'GET /api/a': (_u, init) =>
        (init?.headers as Record<string, string>).Authorization === 'Bearer fresh'
          ? jsonResponse({ success: true, which: 'a' })
          : errorResponse(401, 'TOKEN_EXPIRED', 'Token expired'),
      'GET /api/b': (_u, init) =>
        (init?.headers as Record<string, string>).Authorization === 'Bearer fresh'
          ? jsonResponse({ success: true, which: 'b' })
          : errorResponse(401, 'TOKEN_EXPIRED', 'Token expired'),
      'POST /api/auth/refresh': async () => {
        refreshCalls++
        await refreshGate
        return jsonResponse({ success: true, accessToken: 'fresh', token: 'fresh', refreshToken: 'r2' })
      },
    })
    tokenStore.set('stale')

    const pa = request<{ which: string }>('/api/a')
    const pb = request<{ which: string }>('/api/b')
    // Let both requests hit their 401 before the refresh resolves.
    await vi.waitFor(() => expect(refreshCalls).toBe(1))
    releaseRefresh()
    const [a, b] = await Promise.all([pa, pb])

    expect(a.which).toBe('a')
    expect(b.which).toBe('b')
    expect(refreshCalls).toBe(1)
    expect(tokenStore.get()).toBe('fresh')
    // 2 failed + 1 refresh + 2 retries
    expect(fetchMock).toHaveBeenCalledTimes(5)
  })

  it('calls the unauthorized handler when the refresh fails', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    mockFetch({
      'GET /api/a': () => errorResponse(401, 'NO_TOKEN', 'Not authorized, no token'),
      'POST /api/auth/refresh': () => errorResponse(401, 'NO_REFRESH_TOKEN', 'Refresh token required'),
    })
    tokenStore.set('stale')
    await expect(request('/api/a')).rejects.toMatchObject({ status: 401, code: 'NO_TOKEN' })
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
    expect(tokenStore.get()).toBeNull()
  })

  it('does not try to refresh for a failed login', async () => {
    const fetchMock = mockFetch({ 'POST /api/auth/login': () => errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid credentials') })
    await expect(api.post('/api/auth/login', { email: 'a', password: 'b' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
