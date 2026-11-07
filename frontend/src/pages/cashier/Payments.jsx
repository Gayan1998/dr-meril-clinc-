import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt as ReceiptIcon, FunnelSimple } from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { Table, THead, TBody, TR, TH, TD } from '../../components/ui/Table'
import { Field, Input, Select } from '../../components/ui/Field'
import SearchInput from '../../components/ui/SearchInput'
import StatusBadge from '../../components/ui/StatusBadge'
import EmptyState from '../../components/ui/EmptyState'
import ErrorState from '../../components/ui/ErrorState'
import Pagination from '../../components/ui/Pagination'
import { TableSkeleton } from '../../components/ui/Skeleton'
import { api, qs } from '../../lib/api'
import { useApi, useDebounced } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { formatMoney, formatMethod, formatTime, todayISO } from '../../lib/format'

export default function Payments() {
  const { settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const [date, setDate] = useState(todayISO())
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const debounced = useDebounced(query, 350)

  const { data, loading, error, reload } = useApi(
    (signal) =>
      api.get(
        `/payments${qs({ date, method, status, q: debounced, page, per_page: 25 })}`,
        { signal },
      ),
    [date, method, status, debounced, page],
  )

  const update = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Payments" description="Completed collections and receipts." />

      <Card>
        <div className="grid gap-3 border-b border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Date" htmlFor="pay-date">
            <Input id="pay-date" type="date" value={date} onChange={update(setDate)} />
          </Field>
          <Field label="Method" htmlFor="pay-method">
            <Select id="pay-method" value={method} onChange={update(setMethod)}>
              <option value="">All methods</option>
              <option value="cash">Cash</option>
            </Select>
          </Field>
          <Field label="Status" htmlFor="pay-status">
            <Select id="pay-status" value={status} onChange={update(setStatus)}>
              <option value="">All statuses</option>
              <option value="paid">Paid</option>
              <option value="voided">Voided</option>
            </Select>
          </Field>
          <Field label="Search" htmlFor="pay-search">
            <SearchInput value={query} onChange={(value) => { setQuery(value); setPage(1) }} placeholder="Patient, receipt or visit" />
          </Field>
        </div>

        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : data.items.length === 0 ? (
          <EmptyState
            icon={<ReceiptIcon size={22} />}
            title="No payments found"
            description="Try a different date or clear the filters."
          />
        ) : (
          <>
            <Table>
              <THead>
                <TR>
                  <TH>Time</TH>
                  <TH>Receipt</TH>
                  <TH>Patient</TH>
                  <TH>Visit</TH>
                  <TH>Method</TH>
                  <TH align="right">Amount</TH>
                  <TH>Status</TH>
                  <TH align="right">Actions</TH>
                </TR>
              </THead>
              <TBody>
                {data.items.map((payment) => (
                  <TR key={payment.id}>
                    <TD className="tnum whitespace-nowrap">{formatTime(payment.paid_at)}</TD>
                    <TD className="tnum whitespace-nowrap text-slate-500">{payment.payment_number}</TD>
                    <TD>
                      <span className="font-medium text-slate-900">{payment.patient.full_name}</span>
                      <span className="tnum block text-xs text-slate-500">{payment.patient.patient_code}</span>
                    </TD>
                    <TD className="tnum whitespace-nowrap text-slate-500">{payment.visit.visit_number}</TD>
                    <TD>{formatMethod(payment.payment_method)}</TD>
                    <TD align="right" className="tnum font-semibold text-slate-900">
                      {formatMoney(payment.amount, currency)}
                    </TD>
                    <TD>
                      <StatusBadge status={payment.status} />
                    </TD>
                    <TD align="right">
                      <Link
                        to={`/receipt/${payment.id}`}
                        className="text-sm font-medium text-brand-700 hover:text-brand-800"
                      >
                        Receipt
                      </Link>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
            <Pagination page={data.page} perPage={data.per_page} total={data.total} onChange={setPage} />
          </>
        )}
      </Card>

      {!loading && data && data.total > 0 ? (
        <p className="flex items-center gap-1.5 text-sm text-slate-500">
          <FunnelSimple size={15} />
          Showing <span className="tnum font-medium text-slate-700">{data.total}</span> payment
          {data.total === 1 ? '' : 's'} for the selected filters.
        </p>
      ) : null}
    </div>
  )
}
