import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, tokenStore } from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [settings, setSettings] = useState(null)
  const [status, setStatus] = useState('loading') // loading | ready

  const clear = useCallback(() => {
    tokenStore.clear()
    setUser(null)
    setSettings(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) {
      setStatus('ready')
      return null
    }
    try {
      const data = await api.get('/auth/me')
      setUser(data.user)
      setSettings(data.settings)
      return data.user
    } catch (err) {
      if (err.status === 401) clear()
      return null
    } finally {
      setStatus('ready')
    }
  }, [clear])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    const onUnauthorized = () => clear()
    window.addEventListener('clinic:unauthorized', onUnauthorized)
    return () => window.removeEventListener('clinic:unauthorized', onUnauthorized)
  }, [clear])

  const login = useCallback(async (username, password) => {
    const data = await api.post('/auth/login', { username, password })
    tokenStore.set(data.token)
    setUser(data.user)
    // load settings in the background; not critical for login
    api
      .get('/auth/me')
      .then((me) => setSettings(me.settings))
      .catch(() => {})
    return data.user
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout')
    } catch {
      // ignore network errors on logout
    }
    clear()
  }, [clear])

  const value = useMemo(
    () => ({
      user,
      settings,
      status,
      isAuthenticated: Boolean(user),
      isDoctor: user?.role === 'doctor',
      isCashier: user?.role === 'cashier',
      login,
      logout,
      refresh,
      setSettings,
    }),
    [user, settings, status, login, logout, refresh],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

/** Currency from clinic settings, defaulting to LKR. */
export function useCurrency() {
  const { settings } = useAuth()
  return settings?.currency || 'LKR'
}
