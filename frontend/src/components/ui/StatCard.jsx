import { cn } from '../../lib/cn'

const TONES = {
  default: 'text-slate-900',
  brand: 'text-brand-700',
  success: 'text-emerald-600',
  warning: 'text-amber-600',
  danger: 'text-red-600',
}

export default function StatCard({ label, value, hint, icon = null, tone = 'default', className = '' }) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/[0.03]', className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {icon ? <span className="text-slate-400">{icon}</span> : null}
      </div>
      <p className={cn('tnum mt-2 text-2xl font-semibold tracking-tight', TONES[tone] || TONES.default)}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  )
}
