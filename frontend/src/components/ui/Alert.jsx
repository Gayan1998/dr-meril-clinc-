import { WarningCircle, Info, CheckCircle, XCircle } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

const VARIANTS = {
  error: { wrap: 'border-red-200 bg-red-50 text-red-800', icon: XCircle, iconColor: 'text-red-600' },
  warning: { wrap: 'border-amber-200 bg-amber-50 text-amber-900', icon: WarningCircle, iconColor: 'text-amber-600' },
  info: { wrap: 'border-brand-200 bg-brand-50 text-brand-900', icon: Info, iconColor: 'text-brand-600' },
  success: { wrap: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: CheckCircle, iconColor: 'text-emerald-600' },
}

export default function Alert({ variant = 'error', title, children, className = '' }) {
  const style = VARIANTS[variant] || VARIANTS.error
  const Icon = style.icon
  return (
    <div className={cn('flex items-start gap-2.5 rounded-lg border px-4 py-3 text-sm', style.wrap, className)} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={18} weight="fill" className={cn('mt-0.5 shrink-0', style.iconColor)} />
      <div className="min-w-0">
        {title ? <p className="font-medium">{title}</p> : null}
        {children ? <div className={title ? 'mt-0.5' : ''}>{children}</div> : null}
      </div>
    </div>
  )
}
