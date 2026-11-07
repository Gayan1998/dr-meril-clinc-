import { cn } from '../../lib/cn'

export function Table({ children, className = '' }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-collapse text-left text-sm', className)}>{children}</table>
    </div>
  )
}

export function THead({ children }) {
  return <thead className="bg-slate-50/80 text-xs font-medium uppercase tracking-wide text-slate-500">{children}</thead>
}

export function TBody({ children }) {
  return <tbody className="divide-y divide-slate-100">{children}</tbody>
}

export function TR({ children, className = '', ...rest }) {
  return (
    <tr className={cn('transition-colors hover:bg-slate-50/70', className)} {...rest}>
      {children}
    </tr>
  )
}

export function TH({ children, className = '', align = 'left' }) {
  return (
    <th scope="col" className={cn('whitespace-nowrap px-4 py-3 font-medium', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </th>
  )
}

export function TD({ children, className = '', align = 'left' }) {
  return (
    <td className={cn('px-4 py-3 text-slate-700', align === 'right' && 'text-right', align === 'center' && 'text-center', className)}>
      {children}
    </td>
  )
}
