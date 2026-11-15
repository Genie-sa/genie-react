import type { ApiErrorBody } from './types'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type UnauthorizedListener = () => void

let authToken: string | null = null
const unauthorizedListeners = new Set<UnauthorizedListener>()

export function setAuthToken(token: string | null): void {
  authToken = token
}

export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener)
  return () => unauthorizedListeners.delete(listener)
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error?.message === 'string'
  )
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  query?: Record<string, string | number | boolean | undefined | null>
  signal?: AbortSignal
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(path, window.location.origin)
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value))
  }
  const headers: Record<string, string> = { accept: 'application/json' }
  if (options.body !== undefined) headers['content-type'] = 'application/json'
  if (authToken) headers.authorization = `Bearer ${authToken}`

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  })
  const payload: unknown =
    response.status === 204 ? undefined : await response.json().catch(() => undefined)
  if (!response.ok) {
    if (response.status === 401) for (const listener of unauthorizedListeners) listener()
    if (isErrorBody(payload))
      throw new ApiError(response.status, payload.error.code, payload.error.message)
    throw new ApiError(
      response.status,
      'http_error',
      `Request failed with status ${response.status}`,
    )
  }
  return payload as T
}
