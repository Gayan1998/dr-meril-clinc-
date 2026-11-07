import { Receipt as ReceiptIcon } from '@phosphor-icons/react'
import BrandMark from '../ui/BrandMark'
import { formatDateTime, formatMethod, formatMoney } from '../../lib/format'

/**
 * Printable invoice / receipt body. Shared by the standalone receipt page and
 * the cashier's collect modal so both always look the same.
 */
export default function ReceiptSheet({ payment, clinic = {}, paper = 'thermal' }) {
  const currency = clinic.currency || 'LKR'

  return (
    <div
      className={`receipt-sheet mx-auto bg-white shadow-sm ${
        paper === 'thermal'
          ? 'receipt-sheet--thermal w-[80mm] px-4 py-5 font-mono text-[12px] leading-relaxed'
          : 'w-full max-w-xl px-10 py-10 text-sm'
      }`}
    >
      {/* Header */}
      <div className="text-center">
        <div className="mb-2 flex justify-center">
          {clinic.logo_url ? (
            <img
              src={clinic.logo_url}
              alt=""
              className={paper === 'thermal' ? 'h-9 object-contain' : 'h-12 object-contain'}
            />
          ) : (
            <BrandMark size={paper === 'thermal' ? 34 : 44} />
          )}
        </div>
        <h1 className={`font-semibold uppercase tracking-wide text-slate-900 ${paper === 'thermal' ? 'text-sm' : 'text-lg'}`}>
          {clinic.clinic_name}
        </h1>
        {clinic.address ? <p className="mt-0.5 text-slate-600">{clinic.address}</p> : null}
        {clinic.phone ? <p className="text-slate-600">{clinic.phone}</p> : null}
        {clinic.email ? <p className="text-slate-600">{clinic.email}</p> : null}
      </div>

      <Dashed />

      {/* Meta */}
      <div className="space-y-1">
        <Line label="Receipt No" value={payment.payment_number} mono />
        <Line label="Date" value={formatDateTime(payment.paid_at)} />
        <Line label="Patient" value={payment.patient.full_name} />
        <Line label="Patient Code" value={payment.patient.patient_code} mono />
        <Line label="Doctor" value={payment.doctor_name} />
      </div>

      <Dashed />

      {/* Charge */}
      <div className="space-y-1">
        <Line label="Consultation Fee" value={formatMoney(payment.amount, currency)} strong mono />
        <Line label="Payment Method" value={formatMethod(payment.payment_method)} />
        <Line
          label="Status"
          value={
            <span className={`font-semibold ${payment.status === 'paid' ? 'text-emerald-700' : 'text-red-700'}`}>
              {payment.status === 'paid' ? 'PAID' : 'VOIDED'}
            </span>
          }
        />
        <Line label="Collected By" value={payment.collected_by} />
      </div>

      {payment.status === 'voided' && payment.void_reason ? (
        <>
          <Dashed />
          <p className="text-red-700">Void reason: {payment.void_reason}</p>
        </>
      ) : null}

      <Dashed />

      <div className="text-center">
        <p className="font-semibold text-slate-900">Total Paid: {formatMoney(payment.amount, currency)}</p>
        {clinic.receipt_footer ? <p className="mt-2 text-slate-600">{clinic.receipt_footer}</p> : null}
        <p className="mt-3 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-widest text-slate-400">
          <ReceiptIcon size={12} /> {payment.payment_number}
        </p>
      </div>
    </div>
  )
}

function Dashed() {
  return <div className="my-3 border-t border-dashed border-slate-300" />
}

function Line({ label, value, strong = false, mono = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'} ${mono ? 'tnum' : ''}`}>
        {value}
      </span>
    </div>
  )
}
