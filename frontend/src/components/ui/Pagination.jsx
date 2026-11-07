import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import Button from './Button'

export default function Pagination({ page, perPage, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / perPage))
  if (total === 0) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, total)

  return (
    <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-5 py-3">
      <p className="text-sm text-slate-500">
        <span className="tnum">{from}</span>–<span className="tnum">{to}</span> of{' '}
        <span className="tnum">{total}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          icon={<CaretLeft size={15} />}
        >
          Prev
        </Button>
        <span className="tnum hidden text-sm text-slate-500 sm:inline">
          Page {page} / {pages}
        </span>
        <Button
          size="sm"
          variant="secondary"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
          <CaretRight size={15} />
        </Button>
      </div>
    </div>
  )
}
