import { WarningCircle } from '@phosphor-icons/react'
import Button from './Button'
import { cn } from '../../lib/cn'

export default function ErrorState({ title = 'Something went wrong', message, onRetry, className = '' }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-12 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-red-500">
        <WarningCircle size={24} weight="fill" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-sm text-slate-500">{message}</p> : null}
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  )
}
