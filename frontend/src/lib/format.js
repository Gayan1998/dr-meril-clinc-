/**
 * Display formatting helpers. Money is only ever formatted for display;
 * the authoritative value always comes from the backend.
 */

const SYMBOLS = {
  LKR: 'Rs.',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  AUD: 'A$',
}

export function currencySymbol(currency = 'LKR') {
  return SYMBOLS[currency] || currency
}

export function formatMoney(amount, currency = 'LKR') {
  const value = Number(amount || 0)
  const formatted = value.toLocaleString('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${currencySymbol(currency)} ${formatted}`
}

export function formatMoneyShort(amount, currency = 'LKR') {
  const value = Number(amount || 0)
  return `${currencySymbol(currency)} ${value.toLocaleString('en-LK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`
}

const DATE_OPTS = { day: '2-digit', month: 'short', year: 'numeric' }
const TIME_OPTS = { hour: '2-digit', minute: '2-digit', hour12: true }

/** Parse a MySQL "YYYY-MM-DD HH:MM:SS" as local time (not UTC). */
function parse(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const normalised = String(value).replace(' ', 'T')
  const d = new Date(normalised)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatDate(value) {
  const d = parse(value)
  return d ? d.toLocaleDateString('en-GB', DATE_OPTS) : '—'
}

export function formatTime(value) {
  const d = parse(value)
  return d ? d.toLocaleTimeString('en-US', TIME_OPTS) : '—'
}

export function formatDateTime(value) {
  const d = parse(value)
  if (!d) return '—'
  return `${d.toLocaleDateString('en-GB', DATE_OPTS)} ${d.toLocaleTimeString('en-US', TIME_OPTS)}`
}

export function todayISO() {
  const d = new Date()
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function formatMethod(method) {
  return (
    {
      cash: 'Cash',
      card: 'Card',
      bank_transfer: 'Bank Transfer',
    }[method] || method || '—'
  )
}

export function formatStatus(status) {
  return (
    {
      pending_payment: 'Pending',
      paid: 'Paid',
      cancelled: 'Cancelled',
      voided: 'Voided',
    }[status] || status
  )
}

/** "1 visit" / "2 visits" */
export function plural(count, singular, pluralForm) {
  return Number(count) === 1 ? singular : pluralForm || `${singular}s`
}

export function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function greeting(name = '') {
  const hour = new Date().getHours()
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  return `${part}, ${name}`
}
