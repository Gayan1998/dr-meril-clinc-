import { Link } from 'react-router-dom'
import { buttonClasses } from '../components/ui/Button'
import { useAuth } from '../context/AuthContext'

export default function NotFound() {
  const { user } = useAuth()
  const home = user?.role === 'doctor' ? '/doctor/dashboard' : user?.role === 'cashier' ? '/cashier/dashboard' : '/login'

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center text-center">
      <p className="text-sm font-semibold uppercase tracking-widest text-brand-600">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500">
        The page you are looking for does not exist or you may not have access to it.
      </p>
      <Link to={home} className={buttonClasses({ variant: 'primary', className: 'mt-6' })}>
        Back to dashboard
      </Link>
    </div>
  )
}
