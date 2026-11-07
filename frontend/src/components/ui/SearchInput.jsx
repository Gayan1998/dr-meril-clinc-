import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { cn } from '../../lib/cn'

export default function SearchInput({ value, onChange, placeholder = 'Search…', className = '', autoFocus = false }) {
  return (
    <div className={cn('relative', className)}>
      <MagnifyingGlass
        size={17}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-brand-500"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Clear search"
        >
          <X size={15} />
        </button>
      ) : null}
    </div>
  )
}
