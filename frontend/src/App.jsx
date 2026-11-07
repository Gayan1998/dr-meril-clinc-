import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import FullPageLoader from './components/FullPageLoader'
import { useAuth } from './context/AuthContext'

const Login = lazy(() => import('./pages/Login'))
const DoctorDashboard = lazy(() => import('./pages/doctor/Dashboard'))
const NewVisit = lazy(() => import('./pages/doctor/NewVisit'))
const DoctorVisits = lazy(() => import('./pages/doctor/Visits'))
const Reports = lazy(() => import('./pages/doctor/Reports'))
const AuditLogs = lazy(() => import('./pages/doctor/AuditLogs'))
const Staff = lazy(() => import('./pages/doctor/Staff'))
const Settings = lazy(() => import('./pages/doctor/Settings'))

const CashierDashboard = lazy(() => import('./pages/cashier/Dashboard'))
const PendingPayments = lazy(() => import('./pages/cashier/PendingPayments'))
const Payments = lazy(() => import('./pages/cashier/Payments'))

const Patients = lazy(() => import('./pages/Patients'))
const PatientDetail = lazy(() => import('./pages/PatientDetail'))
const Profile = lazy(() => import('./pages/Profile'))
const Receipt = lazy(() => import('./pages/Receipt'))
const NotFound = lazy(() => import('./pages/NotFound'))

function HomeRedirect() {
  const { status, user } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to={user.role === 'doctor' ? '/doctor/dashboard' : '/cashier/dashboard'} replace />
}

export default function App() {
  return (
    <Suspense fallback={<FullPageLoader />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<HomeRedirect />} />

        {/* Receipt is standalone so printing is clean */}
        <Route
          path="/receipt/:id"
          element={
            <ProtectedRoute>
              <Receipt />
            </ProtectedRoute>
          }
        />

        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/profile" element={<Profile />} />
          <Route path="/patients/:id" element={<PatientDetail />} />

          {/* Doctor */}
          <Route
            path="/doctor/dashboard"
            element={
              <ProtectedRoute role="doctor">
                <DoctorDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/new-visit"
            element={
              <ProtectedRoute role="doctor">
                <NewVisit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/patients"
            element={
              <ProtectedRoute role="doctor">
                <Patients />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/visits"
            element={
              <ProtectedRoute role="doctor">
                <DoctorVisits />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/reports"
            element={
              <ProtectedRoute role="doctor">
                <Reports />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/audit"
            element={
              <ProtectedRoute role="doctor">
                <AuditLogs />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/users"
            element={
              <ProtectedRoute role="doctor">
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/doctor/settings"
            element={
              <ProtectedRoute role="doctor">
                <Settings />
              </ProtectedRoute>
            }
          />

          {/* Cashier */}
          <Route
            path="/cashier/dashboard"
            element={
              <ProtectedRoute role="cashier">
                <CashierDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier/pending"
            element={
              <ProtectedRoute role="cashier">
                <PendingPayments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier/payments"
            element={
              <ProtectedRoute role="cashier">
                <Payments />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cashier/patients"
            element={
              <ProtectedRoute role="cashier">
                <Patients />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
