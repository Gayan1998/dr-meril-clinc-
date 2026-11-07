import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, ClipboardText, Prohibit } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table'
import { Field, Input, Select } from '../../components/ui/Field'
import SearchInput from '../../components/ui/SearchInput'
import StatusBadge from '../../components/ui/StatusBadge'
import Button, { buttonClasses } from '../../components/ui/Button'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Pagination from '../../components/ui/Pagination'
import { TableSkeleton } from '../../components/ui/Skeleton'
import CancelVisitModal from '../../components/visits/CancelVisitModal'
import { api, qs } from '../../lib/api'
import { useApi, useDebounced } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatMoney, formatTime, todayISO } from '../../lib/format'

export default function DoctorVisits() {
  const { settings } = useAuth()
  const toast = useToast()
  const currency = settings?.currency || 'LKR'
  const [date, setDate] = useState(todayISO())
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [cancelling, setCancelling] = useState(null)
  const debounced = useDebounced(query, 350)

  const { data, loading, error, reload } = useApi(
    (signal) => api.get(`/visits${qs({ date, status, q: debounced, page, per_page: 25 })}`, { signal }),
    [date, status, debounced, page],
  )

  const update = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visits"
        description="Every charge you have created, and its payment status."
        actions={
          <Link to="/doctor/new-visit" className={buttonClasses({ variant: 'primary' })}>
            <PlusCircle size={18} weight="fill" />
            New Visit
          </Link>
        }
      />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Date" htmlFor="visit-date">
            <Input id="visit-date" type="date" value={date} onChange={update(setDate)} />
          </Field>
          <Field label="Status" htmlFor="visit-status">
            <Select id="visit-status" value={status} onChange={update(setStatus)}>
              <option value="">All statuses</option>
              <option value="pending_payment">Pending</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </Field>
          <Field label="Search" htmlFor="visit-search">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value)
                setPage(1)
              }}
              placeholder="Patient, visit or code"
            />
          </Field>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<ClipboardText size={22} />}
            title="No visits found"
            description="Try a different date, or create a new visit."
            action={
              <Link to="/doctor/new-visit" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                <PlusCircle size={16} weight="fill" />
                New Visit
              </Link>
            }
          />
        ) : (
          <>
            {/* Mobile cards */}
            <ul className="divide-y divide-slate-100 lg:hidden">
              {data.items.map((visit) => (
                <li key={visit.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{visit.patient.full_name}</p>
                      <p className="tnum text-xs text-slate-500">
                        {visit.visit_number} · {formatTime(visit.created_at)}
                      </p>
                    </div>
                    <span className="tnum text-sm font-semibold text-slate-900">
                      {formatMoney(visit.consultation_fee, currency)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <StatusBadge status={visit.status} />
                    <div className="flex items-center gap-3">
                      {visit.status === 'pending_payment' ? (
                        <button
                          type="button"
                          onClick={() => setCancelling(visit)}
                          className="text-xs font-medium text-red-600 hover:text-red-700"
                        >
                          Cancel
                        </button>
                      ) : null}
                      {visit.payment ? (
                        <Link
                          to={`/receipt/${visit.payment.id}`}
                          className="text-xs font-medium text-brand-700 hover:text-brand-800"
                        >
                          Receipt
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden lg:block">
              <Table>
                <THead>
                  <TR>
                    <TH>Time</TH>
                    <TH>Visit</TH>
                    <TH>Patient</TH>
                    <TH align="right">Amount</TH>
                    <TH>Status</TH>
                    <TH>Cashier</TH>
                    <TH align="right">Actions</TH>
                  </TR>
                </THead>
                <TBody>
                  {data.items.map((visit) => (
                    <TR key={visit.id}>
                      <TD className="tnum whitespace-nowrap">{formatTime(visit.created_at)}</TD>
                      <TD className="tnum whitespace-nowrap text-slate-500">{visit.visit_number}</TD>
                      <TD>
                        <span className="font-medium text-slate-900">{visit.patient.full_name}</span>
                        <span className="tnum block text-xs text-slate-500">{visit.patient.patient_code}</span>
                      </TD>
                      <TD align="right" className="tnum font-semibold text-slate-900">
                        {formatMoney(visit.consultation_fee, currency)}
                      </TD>
                      <TD>
                        <StatusBadge status={visit.status} />
                      </TD>
                      <TD className="text-slate-500">{visit.payment?.collected_by || '—'}</TD>
                      <TD align="right">
                        <div className="flex items-center justify-end gap-3">
                          {visit.payment ? (
                            <Link
                              to={`/receipt/${visit.payment.id}`}
                              className="text-sm font-medium text-brand-700 hover:text-brand-800"
                            >
                              Receipt
                            </Link>
                          ) : null}
                          {visit.status === 'pending_payment' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={<Prohibit size={15} />}
                              onClick={() => setCancelling(visit)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </div>

            <Pagination page={data.page} perPage={data.per_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {cancelling ? (
        <CancelVisitModal
          visit={cancelling}
          onClose={() => setCancelling(null)}
          onCancelled={() => {
            setCancelling(null)
            reload()
            toast.success('The visit was cancelled and will not be charged.', 'Visit cancelled')
          }}
        />
      ) : null}
    </div>
  )
}
