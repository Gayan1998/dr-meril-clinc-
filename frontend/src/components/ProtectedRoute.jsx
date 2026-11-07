import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import FullPageLoader from './FullPageLoader'

/**
 * Client-side route guard. This is a UX convenience only; the backend
 * independently enforces authentication and role on every request.
 */
export default function ProtectedRoute({ role, children }) {
  const { status, user } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <FullPageLoader label="Checking your session…" />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }

  if (role && user.role !== role) {
    const home = user.role === 'doctor' ? '/doctor/dashboard' : '/cashier/dashboard'
    return <Navigate to={home} replace />
  }

  return children
}
