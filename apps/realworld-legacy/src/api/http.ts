const TOKEN_KEY = 'acme.token'

class ApiError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const tokenStorage = {
  read: (): string | null => window.localStorage.getItem(TOKEN_KEY),
  write: (token: string): void => window.localStorage.setItem(TOKEN_KEY, token),
  clear: (): void => window.localStorage.removeItem(TOKEN_KEY),
}

export function authHeaders(): Record<string, string> {
  const token = tokenStorage.read()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...init.headers,
    },
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw new ApiError(response.status, body?.message ?? `Request failed with ${response.status}`)
  }
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export function toQueryString(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams()
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') search.set(name, value)
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}
