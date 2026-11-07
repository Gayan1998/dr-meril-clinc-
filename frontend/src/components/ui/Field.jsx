import { forwardRef } from 'react'
import { cn } from '../../lib/cn'

const controlBase =
  'w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 ' +
  'transition-colors focus:border-brand-500 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500'

export function Field({ label, htmlFor, hint, error, required = false, children, className = '' }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="text-sm text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef(function Input({ className = '', invalid = false, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cn(controlBase, invalid ? 'border-red-400 focus:border-red-500' : 'border-slate-300', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export const Textarea = forwardRef(function Textarea({ className = '', invalid = false, rows = 3, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlBase, 'resize-y', invalid ? 'border-red-400' : 'border-slate-300', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
})

export const Select = forwardRef(function Select({ className = '', invalid = false, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(controlBase, 'pr-8', invalid ? 'border-red-400' : 'border-slate-300', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {children}
    </select>
  )
})
