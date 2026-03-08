import { NavLink, useLocation } from 'react-router-dom'
import { LayoutDashboard, Calendar, BarChart3, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/plan', icon: Calendar, label: 'Plan' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/settings', icon: Settings, label: 'Ustawienia' },
] as const

export default function AppNavigation() {
  const location = useLocation()

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex fixed left-0 top-0 h-screen w-16 hover:w-48 transition-all duration-300 flex-col gap-1 py-6 px-2 z-50 group"
        style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--glass-border)' }}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-2 mb-8">
          <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center"
            style={{ background: 'var(--green-surface)' }}>
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <path d="M4 24L10 8L14 16L18 10L22 18L28 6" stroke="var(--green-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="font-display font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
            style={{ color: 'var(--text-primary)' }}>
            RunTracker
          </span>
        </div>

        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200',
                isActive
                  ? 'bg-[var(--green-surface)]'
                  : 'hover:bg-[var(--glass-bg)]'
              )}
            >
              <Icon
                size={20}
                className="flex-shrink-0"
                style={{ color: isActive ? 'var(--green-primary)' : 'var(--text-secondary)' }}
              />
              <span
                className="text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap"
                style={{ color: isActive ? 'var(--green-primary)' : 'var(--text-secondary)' }}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around h-14 px-2"
        style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--glass-border)' }}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to
          return (
            <NavLink
              key={to}
              to={to}
              className="flex flex-col items-center gap-0.5 py-1 px-3"
            >
              <Icon
                size={20}
                style={{ color: isActive ? 'var(--green-primary)' : 'var(--text-tertiary)' }}
              />
              <span
                className="text-[10px] font-medium"
                style={{ color: isActive ? 'var(--green-primary)' : 'var(--text-tertiary)' }}
              >
                {label}
              </span>
            </NavLink>
          )
        })}
      </nav>
    </>
  )
}
