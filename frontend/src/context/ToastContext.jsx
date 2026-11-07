import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import ToastViewport from '../components/ui/Toast'

const ToastContext = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
  }, [])

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      setToasts((current) => [...current, { id, ...toast }])
      const duration = toast.duration ?? 4500
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration)
      }
      return id
    },
    [dismiss],
  )

  const value = useMemo(
    () => ({
      toast: push,
      success: (message, title = 'Done') => push({ type: 'success', title, message }),
      error: (message, title = 'Something went wrong') => push({ type: 'error', title, message, duration: 7000 }),
      info: (message, title = null) => push({ type: 'info', title, message }),
      warning: (message, title = 'Heads up') => push({ type: 'warning', title, message }),
    }),
    [push],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used within ToastProvider')
  return context
}
