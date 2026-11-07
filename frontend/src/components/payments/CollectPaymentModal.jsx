import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Printer, Lock, ArrowRight } from '@phosphor-icons/react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import Alert from '../ui/Alert'
import StatusBadge from '../ui/StatusBadge'
import ReceiptSheet from './ReceiptSheet'
import { api } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { useToast } from '../../context/ToastContext'
import { formatMoney, formatMethod, formatTime } from '../../lib/format'

/**
 * Collect payment, then show the invoice in the same modal.
 *
 * The amount is displayed read-only. The request body contains only the
 * visit id and the payment method; the server decides the amount.
 */
export default function CollectPaymentModal({ visit, onClose, onCollected }) {
  const { settings } = useAuth()
  const toast = useToast()
  const currency = settings?.currency || 'LKR'

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [payment, setPayment] = useState(null)
  const [paper, setPaper] = useState('thermal')

  // Open the print preview as soon as the invoice is on screen, and keep
  // printing scoped to the invoice while this modal is open.
  useEffect(() => {
    if (!payment) return undefined
    document.body.classList.add('printing-receipt')
    const id = setTimeout(() => window.print(), 150)
    return () => {
      clearTimeout(id)
      document.body.classList.remove('printing-receipt')
    }
  }, [payment])

  const collect = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const result = await api.post(`/payments/${visit.id}/collect`, { payment_method: 'cash' })
      setPayment(result)
      toast.success(`${formatMoney(result.amount, currency)} · ${formatMethod(result.payment_method)}`, 'Payment collected')
      onCollected?.(result)
    } catch (err) {
      setError(
        err.offline
          ? 'Unable to connect. The payment was not recorded. Please check your connection and try again.'
          : err.message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (payment) {
    const clinic = payment.clinic || settings || {}
    return (
      <>
        <Modal
          open
          onClose={onClose}
          title="Payment receipt"
          description={`${payment.patient.full_name} · ${payment.payment_number}`}
          size="lg"
          footer={
            <>
              <Button variant="secondary" onClick={onClose}>
                Done
              </Button>
              <Button icon={<Printer size={17} />} onClick={() => window.print()}>
                Print Invoice
              </Button>
            </>
          }
        >
          <div className="mb-4 flex justify-end">
            <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
              {[
                { value: 'thermal', label: '80mm' },
                { value: 'a4', label: 'A4' },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPaper(option.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    paper === option.value ? 'bg-brand-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <ReceiptSheet payment={payment} clinic={clinic} paper={paper} />
        </Modal>

        {/* Print-only copy, a direct child of body so print CSS can isolate it. */}
        {createPortal(
          <div className="receipt-print-only hidden">
            <ReceiptSheet payment={payment} clinic={clinic} paper={paper} />
          </div>,
          document.body,
        )}
      </>
    )
  }

  return (
    <Modal
      open
      onClose={submitting ? undefined : onClose}
      title="Confirm payment"
      description="Check the amount, then confirm the payment."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={collect} loading={submitting} icon={!submitting ? <ArrowRight size={17} /> : null}>
            {submitting ? 'Collecting…' : 'Confirm Payment'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error ? <Alert variant="error">{error}</Alert> : null}

        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          <Row label="Patient" value={visit.patient.full_name} />
          <Row label="Visit ID" value={visit.visit_number} mono />
          <Row label="Created by" value={visit.doctor_name} />
          <Row label="Created at" value={formatTime(visit.created_at)} />
          <Row label="Status" value={<StatusBadge status={visit.status} />} />
        </dl>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-600">Amount to collect</span>
            <span className="tnum text-xl font-semibold text-slate-900">
              {formatMoney(visit.consultation_fee, currency)}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <Lock size={13} /> Set by the doctor. This amount cannot be changed.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
          <span className="text-sm font-medium text-slate-700">Payment method</span>
          <span className="text-sm font-medium text-slate-900">Cash</span>
        </div>
      </div>
    </Modal>
  )
}

function Row({ label, value, strong = false, mono = false }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className={`text-right text-sm ${strong ? 'tnum font-semibold text-slate-900' : 'text-slate-800'} ${mono ? 'tnum' : ''}`}>
        {value}
      </dd>
    </div>
  )
}
