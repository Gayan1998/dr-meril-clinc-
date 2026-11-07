import { cn } from '../../lib/cn'

export function Card({ className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag
      className={cn(
        'rounded-xl border border-slate-200 bg-white shadow-sm shadow-slate-900/[0.03]',
        className,
      )}
      {...rest}
    />
  )
}

export function CardHeader({ title, description, action, className = '' }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardBody({ className = '', ...rest }) {
  return <div className={cn('px-5 py-4', className)} {...rest} />
}
