import { useCallback, useEffect, useRef, useState } from 'react'

/** Debounce a rapidly changing value (e.g. a search box). */
export function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/**
 * Small data-loading hook: loading / error / data + reload.
 * `loader` receives an AbortSignal.
 */
export function useApi(loader, deps = []) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [nonce, setNonce] = useState(0)
  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setLoading(true)
    setError(null)

    Promise.resolve(loaderRef.current(controller.signal))
      .then((result) => {
        if (active) setData(result)
      })
      .catch((err) => {
        if (!active || err.name === 'AbortError') return
        setError(err)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])

  // Background refetch: updates the data without flashing the loading state.
  const refresh = useCallback(async () => {
    try {
      const result = await loaderRef.current(undefined)
      setData(result)
      setError(null)
    } catch {
      // Keep showing the last good data; a background failure is not fatal.
    }
  }, [])

  return { data, loading, error, reload, refresh, setData }
}

/**
 * Poll `callback` on an interval while the tab is visible and the browser is
 * online. Also fires when the tab regains focus or the connection returns, so
 * a cashier sees new charges as soon as they look at the screen.
 */
export function usePolling(callback, intervalMs = 5000) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!intervalMs) return undefined
    const run = () => {
      if (document.hidden || !navigator.onLine) return
      cbRef.current()
    }
    const id = setInterval(run, intervalMs)
    window.addEventListener('focus', run)
    window.addEventListener('online', run)
    document.addEventListener('visibilitychange', run)
    return () => {
      clearInterval(id)
      window.removeEventListener('focus', run)
      window.removeEventListener('online', run)
      document.removeEventListener('visibilitychange', run)
    }
  }, [intervalMs])
}

/** Track browser online/offline state. */
export function useOnlineStatus() {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine))
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
