import Spinner from './ui/Spinner'

export default function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-slate-500">
      <Spinner size={26} className="text-brand-600" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
