import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'

export default function MobileNav({ items }) {
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2">
        {items.map((item) => {
          const Icon = item.icon
          if (item.primary) {
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className="relative -top-3 flex flex-1 flex-col items-center gap-1"
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg shadow-brand-900/20">
                  <Icon size={24} weight="fill" />
                </span>
                <span className="text-[11px] font-medium text-slate-600">{item.label}</span>
              </NavLink>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors',
                  isActive ? 'text-brand-700' : 'text-slate-500',
                )
              }
            >
              <Icon size={22} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
