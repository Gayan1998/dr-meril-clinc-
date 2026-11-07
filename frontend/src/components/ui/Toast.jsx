import { CheckCircle, Info, WarningCircle, XCircle, X } from '@phosphor-icons/react'

const STYLES = {
  success: { icon: CheckCircle, color: 'text-emerald-600', ring: 'ring-emerald-200' },
  error: { icon: XCircle, color: 'text-red-600', ring: 'ring-red-200' },
  warning: { icon: WarningCircle, color: 'text-amber-600', ring: 'ring-amber-200' },
  info: { icon: Info, color: 'text-brand-600', ring: 'ring-brand-200' },
}

function Toast({ toast, onDismiss }) {
  const style = STYLES[toast.type] || STYLES.info
  const Icon = style.icon
  return (
    <div
      className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10 ring-1 ring-inset ${style.ring}`}
    >
      <Icon size={20} weight="fill" className={`mt-0.5 shrink-0 ${style.color}`} />
      <div className="min-w-0 flex-1">
        {toast.title ? <p className="text-sm font-semibold text-slate-900">{toast.title}</p> : null}
        {toast.message ? <p className="text-sm text-slate-600">{toast.message}</p> : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
    </div>
  )
}

export default function ToastViewport({ toasts, onDismiss }) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:top-0 sm:items-end"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
