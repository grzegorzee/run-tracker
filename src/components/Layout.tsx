import { Outlet } from 'react-router-dom'
import AppNavigation from './AppNavigation'

export default function Layout() {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <AppNavigation />
      <main className="md:ml-16 pb-16 md:pb-0">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
