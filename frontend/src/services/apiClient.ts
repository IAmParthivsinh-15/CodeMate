import type { ApiErrorDetail, RefreshResponse } from '../types/api'

/**
 * HTTP client for the CodeMate API.
 *
 * - Same-origin by default (the Vite dev server proxies /api to the backend),
 *   so the httpOnly `jwt` / `refreshToken` cookies are sent automatically.
 * - The access token returned by login/refresh is also kept in memory and sent
 *   as a Bearer header ("belt and braces"; the socket needs it too).
 * - A 401 triggers exactly one POST /api/auth/refresh (shared by concurrent
 *   callers) and the original request is retried once.
 * - Every failure is normalised into an ApiError built from the error envelope.
 */

export const API_BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: ApiErrorDetail[]
  readonly requestId?: string

  constructor(opts: { status: number; code: string; message: string; details?: ApiErrorDetail[]; requestId?: string }) {
    super(opts.message)
    this.name = 'ApiError'
    this.status = opts.status
    this.code = opts.code
    this.details = opts.details
    this.requestId = opts.requestId
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError

/** Human-readable message for any thrown value. */
export function errorMessage(e: unknown, fallback = 'Something went wrong'): string {
  if (e instanceof Error && e.message) return e.message
  if (typeof e === 'string' && e) return e
  return fallback
}

// ---------------------------------------------------------- token store --

type Listener = (token: string | null) => void
let accessToken: string | null = null
const listeners = new Set<Listener>()

export const tokenStore = {
  get: () => accessToken,
  set(token: string | null) {
    if (token === accessToken) return
    accessToken = token
    listeners.forEach((l) => l(token))
  },
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  },
}

let unauthorizedHandler: (() => void) | null = null
/** Called when a request is still unauthorised after a refresh attempt (session ended). */
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn
}

// ------------------------------------------------------------ envelope --

interface ErrorEnvelope {
  success?: false
  error?: { code?: string; message?: string; details?: ApiErrorDetail[] }
  message?: string
  requestId?: string
}

export async function toApiError(res: Response): Promise<ApiError> {
  let body: ErrorEnvelope | null = null
  try {
    const text = await res.text()
    body = text ? (JSON.parse(text) as ErrorEnvelope) : null
  } catch {
    body = null
  }
  const code = body?.error?.code ?? (res.status === 429 ? 'RATE_LIMITED' : `HTTP_${res.status}`)
  const message =
    body?.error?.message ??
    body?.message ??
    (res.status === 429 ? 'Too many requests. Please slow down.' : res.statusText || `Request failed (${res.status})`)
  return new ApiError({
    status: res.status,
    code,
    message,
    details: body?.error?.details,
    requestId: body?.requestId ?? res.headers.get('x-request-id') ?? undefined,
  })
}

// ------------------------------------------------------------- refresh --

const NO_REFRESH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout']

let refreshInFlight: Promise<string | null> | null = null

/** Single-flight refresh: concurrent 401s share one POST /api/auth/refresh. */
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        if (!res.ok) {
          tokenStore.set(null)
          return null
        }
        const data = (await res.json()) as RefreshResponse
        const token = data.accessToken ?? data.token ?? null
        tokenStore.set(token)
        return token
      } catch {
        return null
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

// ------------------------------------------------------------- request --

export type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  query?: Query
  signal?: AbortSignal
  /** Set false to skip the refresh-and-retry dance (auth endpoints do this automatically). */
  retryOn401?: boolean
}

export function buildUrl(path: string, query?: Query): string {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') qs.set(k, String(v))
  }
  const s = qs.toString()
  return `${API_BASE}${path}${s ? `?${s}` : ''}`
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json'
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  try {
    return await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: opts.signal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError({
      status: 0,
      code: 'NETWORK_ERROR',
      message: 'Could not reach the server. Check your connection and try again.',
    })
  }
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(path, opts)

  const canRetry = opts.retryOn401 !== false && !NO_REFRESH_PATHS.includes(path)
  if (res.status === 401 && canRetry) {
    const token = await refreshAccessToken()
    if (token) {
      res = await send(path, opts)
    }
    if (res.status === 401) {
      const err = await toApiError(res)
      unauthorizedHandler?.()
      throw err
    }
  }

  if (!res.ok) throw await toApiError(res)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  if (!text) return undefined as T
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new ApiError({ status: res.status, code: 'INVALID_RESPONSE', message: 'The server sent an unexpected response.' })
  }
  if (data && typeof data === 'object' && (data as { success?: unknown }).success === false) {
    const env = data as ErrorEnvelope
    throw new ApiError({
      status: res.status,
      code: env.error?.code ?? 'UNKNOWN_ERROR',
      message: env.error?.message ?? env.message ?? 'Request failed',
      details: env.error?.details,
      requestId: env.requestId,
    })
  }
  return data as T
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body: body ?? {} }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}

/** Test helper: reset module state between tests. */
export function __resetApiClientForTests() {
  accessToken = null
  listeners.clear()
  unauthorizedHandler = null
  refreshInFlight = null
}
