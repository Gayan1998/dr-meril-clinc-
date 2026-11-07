import {
  House,
  PlusCircle,
  Users,
  ClipboardText,
  ChartBar,
  ShieldCheck,
  Gear,
  UserList,
  Wallet,
  Receipt,
  UserCircle,
} from '@phosphor-icons/react'

export const doctorNav = [
  { to: '/doctor/dashboard', label: 'Dashboard', icon: House },
  { to: '/doctor/new-visit', label: 'New Visit', icon: PlusCircle, primary: true },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/visits', label: 'Visits', icon: ClipboardText },
  { to: '/doctor/reports', label: 'Reports', icon: ChartBar },
  { to: '/doctor/audit', label: 'Audit Log', icon: ShieldCheck },
  { to: '/doctor/users', label: 'Staff', icon: UserList },
  { to: '/doctor/settings', label: 'Settings', icon: Gear },
]

export const doctorMobileNav = [
  { to: '/doctor/dashboard', label: 'Home', icon: House },
  { to: '/doctor/patients', label: 'Patients', icon: Users },
  { to: '/doctor/new-visit', label: 'New Visit', icon: PlusCircle, primary: true },
  { to: '/doctor/reports', label: 'Reports', icon: ChartBar },
  { to: '/profile', label: 'Profile', icon: UserCircle },
]

export const cashierNav = [
  { to: '/cashier/dashboard', label: 'Dashboard', icon: House },
  { to: '/cashier/pending', label: 'Pending Payments', icon: Wallet },
  { to: '/cashier/payments', label: 'Payments', icon: Receipt },
  { to: '/cashier/patients', label: 'Patients', icon: Users },
  { to: '/profile', label: 'Profile', icon: UserCircle },
]

export const cashierMobileNav = cashierNav
