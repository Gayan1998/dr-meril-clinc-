import { useState } from 'react'
import { Wallet, CheckCircle } from '@phosphor-icons/react'
import SearchInput from '../ui/SearchInput'
import Button from '../ui/Button'
import Avatar from '../ui/Avatar'
import EmptyState from '../ui/EmptyState'
import ErrorState from '../ui/ErrorState'
import Skeleton from '../ui/Skeleton'
import CollectPaymentModal from './CollectPaymentModal'
import { api, qs } from '../../lib/api'
import { useApi, useDebounced, usePolling } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatTime } from '../../lib/format'

export default function PendingQueue({ onChanged, emptyHint = 'All patients are currently paid.' }) {
  const { settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const [query, setQuery] = useState('')
  const debounced = useDebounced(query, 300)
  const [selected, setSelected] = useState(null)

  const { data, loading, error, reload, refresh } = useApi(
    (signal) => api.get(`/payments/pending${qs({ q: debounced })}`, { signal }),
    [debounced],
  )

  // New doctor charges appear here without a manual refresh.
  usePolling(refresh, 5000)

  const handleCollected = () => {
    reload()
    onChanged?.()
  }

  return (
    <div>
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700">Pending payments</span>
          {!loading && data ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
              {data.count}
            </span>
          ) : null}
        </div>
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Search patient, visit or phone"
          className="sm:w-72"
        />
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-3 p-5">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-9 w-24" />
            </div>
          ))}
        </div>
      ) : data.items.length === 0 ? (
        <EmptyState
          icon={<CheckCircle size={22} weight="fill" />}
          title={query ? 'No matching payments' : 'No pending payments'}
          description={query ? 'Try a different search term.' : emptyHint}
        />
      ) : (
        <>
          <ul className="divide-y divide-slate-100">
            {data.items.map((visit) => (
              <li
                key={visit.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={visit.patient.full_name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{visit.patient.full_name}</p>
                    <p className="tnum truncate text-xs text-slate-500">
                      {visit.visit_number} · {formatTime(visit.created_at)}
                      {visit.patient.phone ? ` · ${visit.patient.phone}` : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 sm:justify-end">
                  <span className="tnum text-base font-semibold text-slate-900">
                    {formatMoney(visit.consultation_fee, currency)}
                  </span>
                  <Button size="sm" onClick={() => setSelected(visit)} icon={<Wallet size={16} />}>
                    Collect
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 text-sm">
            <span className="text-slate-500">Total pending</span>
            <span className="tnum font-semibold text-amber-700">{formatMoney(data.total, currency)}</span>
          </div>
        </>
      )}

      {selected ? (
        <CollectPaymentModal
          visit={selected}
          onClose={() => setSelected(null)}
          onCollected={handleCollected}
        />
      ) : null}
    </div>
  )
}
