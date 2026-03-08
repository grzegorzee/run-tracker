import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { UserProvider, useUser } from '@/contexts/UserContext'
import ErrorBoundary from '@/components/ErrorBoundary'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import TrainingPlan from '@/pages/TrainingPlan'
import WorkoutDetail from '@/pages/WorkoutDetail'
import Analytics from '@/pages/Analytics'
import Settings from '@/pages/Settings'
import WeeklySummary from '@/pages/WeeklySummary'
import NewPlan from '@/pages/NewPlan'
import StravaCallback from '@/pages/StravaCallback'
import NotFound from '@/pages/NotFound'
import { lazy, Suspense, type ReactNode } from 'react'

const Onboarding = lazy(() => import('@/pages/Onboarding'))

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center animate-pulse"
          style={{ background: 'var(--green-surface)' }}>
          <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
            <path d="M4 24L10 8L14 16L18 10L22 18L28 6" stroke="var(--green-primary)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Ładowanie...</p>
      </div>
    </div>
  )
}

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading, isNewUser } = useUser()

  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/" replace />
  if (isNewUser) return <Navigate to="/onboarding" replace />

  return <>{children}</>
}

function AppRoutes() {
  const { user, loading, isNewUser } = useUser()

  if (loading) return <LoadingScreen />

  return (
    <Routes>
      <Route path="/" element={
        user ? (isNewUser ? <Navigate to="/onboarding" replace /> : <Navigate to="/dashboard" replace />) : <Login />
      } />

      <Route path="/onboarding" element={
        <Suspense fallback={<LoadingScreen />}>
          <Onboarding />
        </Suspense>
      } />

      <Route element={
        <RequireAuth>
          <Layout />
        </RequireAuth>
      }>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/plan" element={<TrainingPlan />} />
        <Route path="/workout/:id" element={<WorkoutDetail />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/weekly" element={<WeeklySummary />} />
        <Route path="/new-plan" element={<NewPlan />} />
        <Route path="/settings" element={<Settings />} />
      </Route>

      <Route path="/strava/callback" element={<StravaCallback />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <UserProvider>
          <AppRoutes />
          <Toaster
            theme="dark"
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--bg-elevated)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              },
            }}
          />
        </UserProvider>
      </HashRouter>
    </ErrorBoundary>
  )
}
