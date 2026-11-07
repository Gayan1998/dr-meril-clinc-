/**
 * Thin API client.
 *
 * - Bearer token auth (no cookies, so no CSRF surface).
 * - A 401 clears the token and notifies the auth context.
 * - Network failures throw an error with `offline = true` so the UI can
 *   show "financial transactions require a connection" instead of a
 *   misleading success state.
 */

const API_BASE = import.meta.env.VITE_API_BASE || '/api'
const TOKEN_KEY = 'clinic.token'

export class ApiError extends Error {
  constructor(message, status, { offline = false, errors = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.offline = offline
    this.errors = errors
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine)

async function request(method, path, body, { signal } = {}) {
  const headers = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  const options = { method, headers, signal }
  if (body !== undefined && body !== null) {
    headers['Content-Type'] = 'application/json'
    options.body = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(API_BASE + path, options)
  } catch (err) {
    if (err.name === 'AbortError') throw err
    throw new ApiError(
      'Unable to connect. Please check your connection and try again.',
      0,
      { offline: true },
    )
  }

  let payload = null
  const text = await response.text()
  if (text) {
    try {
      payload = JSON.parse(text)
    } catch {
      payload = null
    }
  }

  if (!response.ok || (payload && payload.success === false)) {
    if (response.status === 401) {
      tokenStore.clear()
      window.dispatchEvent(new CustomEvent('clinic:unauthorized'))
    }
    const message = payload?.message || `Request failed (${response.status}).`
    throw new ApiError(message, response.status, { errors: payload?.errors || null })
  }

  return payload?.data ?? null
}

export const api = {
  get: (path, opts) => request('GET', path, null, opts),
  post: (path, body, opts) => request('POST', path, body, opts),
  put: (path, body, opts) => request('PUT', path, body, opts),
  patch: (path, body, opts) => request('PATCH', path, body, opts),
  del: (path, opts) => request('DELETE', path, null, opts),
}

/** Build a query string, skipping empty values. */
export function qs(params = {}) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value)
    }
  })
  const str = search.toString()
  return str ? `?${str}` : ''
}
