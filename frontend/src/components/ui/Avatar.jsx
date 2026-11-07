import { cn } from '../../lib/cn'
import { initials } from '../../lib/format'

export default function Avatar({ name = '', size = 'md', className = '' }) {
  const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' }
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 ring-1 ring-inset ring-brand-100',
        sizes[size] || sizes.md,
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
