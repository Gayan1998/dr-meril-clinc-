import { useState } from 'react'
import { WarningCircle } from '@phosphor-icons/react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import { Field, Textarea } from '../ui/Field'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { formatMoney } from '../../lib/format'

export default function CancelVisitModal({ visit, onClose, onCancelled }) {
  const { settings } = useAuth()
  const currency = settings?.currency || 'LKR'
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (event) => {
    event.preventDefault()
    setError(null)
    if (reason.trim().length < 3) {
      setError('Please give a reason for cancelling this visit.')
      return
    }
    setSubmitting(true)
    try {
      await api.post(`/visits/${visit.id}/cancel`, { reason: reason.trim() })
      onCancelled()
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open
      onClose={submitting ? undefined : onClose}
      title="Cancel visit"
      description="This removes the charge from the cashier's queue. The record is kept and logged."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Keep visit
          </Button>
          <Button form="cancel-visit-form" type="submit" variant="danger" loading={submitting}>
            {submitting ? 'Cancelling…' : 'Cancel Visit'}
          </Button>
        </>
      }
    >
      <form id="cancel-visit-form" onSubmit={submit} className="space-y-4" noValidate>
        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <WarningCircle size={18} weight="fill" className="mt-0.5 shrink-0 text-amber-600" />
          <p>A cancelled visit cannot be paid. This action is recorded in the audit log.</p>
        </div>

        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">Patient</dt>
            <dd className="font-medium text-slate-900">{visit.patient.full_name}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">Visit</dt>
            <dd className="tnum text-slate-800">{visit.visit_number}</dd>
          </div>
          <div className="flex items-center justify-between px-4 py-2.5">
            <dt className="text-slate-500">Amount</dt>
            <dd className="tnum font-semibold text-slate-900">
              {formatMoney(visit.consultation_fee, currency)}
            </dd>
          </div>
        </dl>

        <Field label="Reason" htmlFor="cancel-reason" required hint="Required and stored with the record.">
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="e.g. Duplicate entry, patient left before consultation"
            autoFocus
          />
        </Field>
      </form>
    </Modal>
  )
}
