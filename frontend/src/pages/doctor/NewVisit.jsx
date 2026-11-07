import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  MagnifyingGlass,
  UserPlus,
  CheckCircle,
  ArrowLeft,
  X,
  User,
  Phone,
} from '@phosphor-icons/react'
import PageHeader from '../../components/ui/PageHeader'
import Button, { buttonClasses } from '../../components/ui/Button'
import { Card, CardHeader, CardBody } from '../../components/ui/Card'
import { Field, Input } from '../../components/ui/Field'
import Alert from '../../components/ui/Alert'
import Avatar from '../../components/ui/Avatar'
import Spinner from '../../components/ui/Spinner'
import NewPatientModal from '../../components/patients/NewPatientModal'
import { api, qs } from '../../lib/api'
import { useDebounced } from '../../hooks'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { currencySymbol, formatMoney, formatTime } from '../../lib/format'

export default function NewVisit() {
  const { settings } = useAuth()
  const toast = useToast()
  const currency = settings?.currency || 'LKR'
  const symbol = currencySymbol(currency)

  const [query, setQuery] = useState('')
  const debouncedQuery = useDebounced(query, 300)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [patient, setPatient] = useState(null)
  const [newName, setNewName] = useState(null)

  const [fee, setFee] = useState('')
  const [state, setState] = useState('idle') // idle | submitting | success | error
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)

  const [showNewPatient, setShowNewPatient] = useState(false)

  useEffect(() => {
    if (patient) return undefined
    let active = true
    const controller = new AbortController()
    setSearching(true)
    api
      .get(`/patients${qs({ q: debouncedQuery, per_page: 12 })}`, { signal: controller.signal })
      .then((data) => {
        if (active) setResults(data.items)
      })
      .catch((err) => {
        if (err.name !== 'AbortError' && active) setResults([])
      })
      .finally(() => {
        if (active) setSearching(false)
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [debouncedQuery, patient])

  const feeNumber = useMemo(() => Number.parseFloat(fee), [fee])
  const feeValid = Number.isFinite(feeNumber) && feeNumber > 0
  const canSubmit = Boolean(patient || newName) && feeValid && state !== 'submitting'

  const reset = () => {
    setPatient(null)
    setNewName(null)
    setFee('')
    setQuery('')
    setCreated(null)
    setError(null)
    setState('idle')
  }

  const submit = async (event) => {
    event.preventDefault()
    if (!canSubmit) return
    setState('submitting')
    setError(null)
    try {
      const visit = await api.post('/visits', {
        ...(patient ? { patient_id: patient.id } : { patient_name: newName }),
        consultation_fee: feeNumber,
      })
      setCreated(visit)
      setState('success')
      toast.success(`${visit.patient.full_name} · ${formatMoney(visit.consultation_fee, currency)}`, 'Visit created')
    } catch (err) {
      setState('error')
      setError(
        err.offline
          ? 'Unable to connect. The visit was not confirmed. Please check your connection and try again.'
          : err.message,
      )
    }
  }

  if (state === 'success' && created) {
    return <SuccessPanel visit={created} currency={currency} onNew={reset} />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New patient visit"
        description="Create the charge. The cashier collects it."
      />

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Patient */}
          <Card>
            <CardHeader
              title="Patient"
              description="Search for an existing patient or add a new one"
              action={
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<UserPlus size={16} />}
                  onClick={() => setShowNewPatient(true)}
                >
                  New Patient
                </Button>
              }
            />
            <CardBody>
              {patient ? (
                <SelectedPatient
                  name={patient.full_name}
                  meta={`${patient.patient_code}${patient.phone ? ` · ${patient.phone}` : ''}`}
                  onClear={() => setPatient(null)}
                />
              ) : newName ? (
                <SelectedPatient
                  name={newName}
                  meta="New patient · registration details not saved"
                  badge="New"
                  onClear={() => {
                    setNewName(null)
                    setQuery('')
                  }}
                />
              ) : (
                <div className="space-y-3">
                  <div className="relative">
                    <MagnifyingGlass
                      size={17}
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <Input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Type a patient name to search or add"
                      className="pl-9"
                      autoFocus
                    />
                  </div>

                  {query.trim().length >= 2 ? (
                    <div className="max-h-72 overflow-y-auto rounded-lg border border-slate-200">
                      {searching ? (
                        <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                          <Spinner size={16} /> Searching…
                        </div>
                      ) : results.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-slate-500">
                          No matching patient.
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {results.map((item) => (
                            <li key={item.id}>
                              <button
                                type="button"
                                onClick={() => setPatient(item)}
                                className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                              >
                                <Avatar name={item.full_name} size="sm" />
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-slate-900">{item.full_name}</p>
                                  <p className="tnum text-xs text-slate-500">
                                    {item.patient_code}
                                    {item.phone ? ` · ${item.phone}` : ''}
                                  </p>
                                </div>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}

                  {query.trim().length >= 2 ? (
                    <button
                      type="button"
                      onClick={() => setNewName(query.trim())}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-brand-300 bg-brand-50/50 px-4 py-3 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-50"
                    >
                      <UserPlus size={17} /> Use “{query.trim()}” as a new patient
                    </button>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Type at least 2 characters, or use “New Patient” for full registration.
                    </p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>

          {/* Fee */}
          <Card>
            <CardHeader title="Consultation fee" description="This amount is locked once the visit is created" />
            <CardBody>
              <Field
                label="Fee"
                htmlFor="fee"
                required
                hint="The cashier will collect exactly this amount. It cannot be changed later."
                error={fee && !feeValid ? 'Enter an amount greater than zero.' : undefined}
              >
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-500">
                    {symbol}
                  </span>
                  <Input
                    id="fee"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={fee}
                    onChange={(event) => setFee(event.target.value)}
                    placeholder="0.00"
                    className="tnum pl-12 text-lg font-semibold"
                    invalid={Boolean(fee) && !feeValid}
                  />
                </div>
              </Field>
            </CardBody>
          </Card>
        </div>

        {/* Summary / action */}
        <div className="lg:col-span-1">
          <div className="lg:sticky lg:top-20">
            <Card>
              <CardHeader title="Summary" />
              <CardBody className="space-y-3">
                <SummaryLine label="Patient" value={patient?.full_name || newName || 'Not selected'} muted={!patient && !newName} />
                <SummaryLine
                  label="Consultation fee"
                  value={feeValid ? formatMoney(feeNumber, currency) : '—'}
                  strong
                  muted={!feeValid}
                />
                <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
                  On creating the visit, the amount is sent to the cashier's pending queue. Payment status starts
                  as Pending.
                </div>

                {error ? <Alert variant="error">{error}</Alert> : null}

                <Button
                  type="submit"
                  size="lg"
                  block
                  disabled={!canSubmit}
                  loading={state === 'submitting'}
                >
                  {state === 'submitting' ? 'Creating visit…' : 'Create Visit'}
                </Button>
              </CardBody>
            </Card>
          </div>
        </div>
      </form>

      <NewPatientModal
        open={showNewPatient}
        onClose={() => setShowNewPatient(false)}
        onCreated={(createdPatient) => {
          setShowNewPatient(false)
          setPatient(createdPatient)
          toast.success(createdPatient.full_name, 'Patient created')
        }}
      />
    </div>
  )
}

function SelectedPatient({ name, meta, badge, onClear }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3">
      <Avatar name={name} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-slate-900">
          {name}
          {badge ? (
            <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              {badge}
            </span>
          ) : null}
        </p>
        <p className="tnum truncate text-xs text-slate-500">{meta}</p>
      </div>
      <button
        type="button"
        onClick={onClear}
        className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-slate-700"
        aria-label="Change patient"
      >
        <X size={17} />
      </button>
    </div>
  )
}

function SummaryLine({ label, value, strong = false, muted = false }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-right text-sm ${strong ? 'tnum font-semibold text-slate-900' : 'font-medium'} ${
          muted ? 'text-slate-400' : 'text-slate-800'
        }`}
      >
        {value}
      </span>
    </div>
  )
}

function SuccessPanel({ visit, currency, onNew }) {
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <Card className="overflow-hidden">
        <div className="flex flex-col items-center gap-3 bg-emerald-50 px-6 py-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <CheckCircle size={32} weight="fill" />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Visit created</h1>
            <p className="mt-1 text-sm text-slate-600">Waiting for cashier payment.</p>
          </div>
        </div>
        <CardBody className="space-y-3">
          <SummaryLine label="Patient" value={visit.patient.full_name} />
          <SummaryLine label="Visit ID" value={visit.visit_number} />
          <SummaryLine label="Amount" value={formatMoney(visit.consultation_fee, currency)} strong />
          <SummaryLine label="Created" value={formatTime(visit.created_at)} />
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="text-sm text-slate-500">Payment status</span>
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">
              Pending
            </span>
          </div>
        </CardBody>
        <div className="flex flex-col gap-2 border-t border-slate-200 p-5 sm:flex-row">
          <Button variant="primary" block onClick={onNew} icon={<UserPlus size={17} />}>
            New Visit
          </Button>
          <Link to="/doctor/visits" className={buttonClasses({ variant: 'secondary', block: true })}>
            Today's Visits
          </Link>
        </div>
      </Card>
      <Link
        to="/doctor/dashboard"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={15} /> Back to dashboard
      </Link>
    </div>
  )
}
