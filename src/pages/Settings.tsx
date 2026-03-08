import { useUser } from '@/contexts/UserContext'
import { useStrava } from '@/hooks/useStrava'
import { motion } from 'framer-motion'
import { LogOut, Watch, Activity, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export default function Settings() {
  const { user, userProfile, signOut } = useUser()
  const strava = useStrava(user?.uid || '')

  const handleStravaConnect = () => {
    strava.connectStrava()
  }

  const handleStravaDisconnect = async () => {
    if (!confirm('Czy na pewno chcesz rozłączyć Stravę? Dane aktywności zostaną usunięte.')) return
    await strava.disconnectStrava()
    toast.success('Strava rozłączona')
  }

  const handleStravaSync = async () => {
    const result = await strava.syncActivities()
    if (result && 'ok' in result && result.ok) {
      toast.success(`Zsynchronizowano ${(result as { synced: number }).synced} aktywności`)
    } else {
      toast.error('Błąd synchronizacji')
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Ustawienia
      </h1>

      {/* Profile */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-5 flex items-center gap-4"
      >
        {userProfile?.photoURL ? (
          <img src={userProfile.photoURL} alt="" className="w-12 h-12 rounded-full" />
        ) : (
          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'var(--green-surface)', color: 'var(--green-primary)' }}>
            {userProfile?.displayName?.[0] || '?'}
          </div>
        )}
        <div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{userProfile?.displayName}</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{userProfile?.email}</p>
        </div>
      </motion.div>

      {/* Integrations */}
      <div className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
          Integracje
        </h2>

        {/* Strava */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Activity size={20} style={{ color: '#FC4C02' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Strava</p>
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                  {strava.connection.connected
                    ? `Połączono jako ${strava.connection.athleteName || 'athlete'}`
                    : 'Niepołączono'
                  }
                </p>
              </div>
            </div>
            {strava.connection.connected ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleStravaSync}
                  disabled={strava.isSyncing}
                  className="btn-ghost text-xs py-2 px-3 flex items-center gap-1"
                >
                  {strava.isSyncing ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <RefreshCw size={14} />
                  )}
                  Sync
                </button>
                <button
                  onClick={handleStravaDisconnect}
                  className="btn-ghost text-xs py-2 px-3"
                  style={{ color: 'var(--pace-interval)' }}
                >
                  Rozłącz
                </button>
              </div>
            ) : (
              <button onClick={handleStravaConnect} className="btn-ghost text-xs py-2 px-4">
                Połącz
              </button>
            )}
          </div>

          {strava.connection.connected && strava.connection.lastSync && (
            <p className="text-[10px] mt-2 pl-8" style={{ color: 'var(--text-tertiary)' }}>
              Ostatnia synchronizacja: {new Date(strava.connection.lastSync).toLocaleString('pl-PL')}
            </p>
          )}

          {strava.error && (
            <div className="flex items-center gap-2 mt-2 pl-8">
              <AlertCircle size={12} style={{ color: 'var(--pace-interval)' }} />
              <p className="text-xs" style={{ color: 'var(--pace-interval)' }}>{strava.error}</p>
            </div>
          )}
        </motion.div>

        {/* Garmin */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Watch size={20} style={{ color: 'var(--green-primary)' }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Garmin</p>
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {userProfile?.garminConnected ? 'Połączono' : 'Niepołączono'}
              </p>
            </div>
          </div>
          <button className="btn-ghost text-xs py-2 px-4">
            {userProfile?.garminConnected ? 'Rozłącz' : 'Połącz'}
          </button>
        </motion.div>
      </div>

      {/* Strava activities count */}
      {strava.connection.connected && strava.activities.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card p-4"
        >
          <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Aktywności
          </p>
          <p className="font-mono text-2xl font-bold" style={{ color: 'var(--green-primary)' }}>
            {strava.activities.length}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            zsynchronizowanych biegów
          </p>
        </motion.div>
      )}

      {/* Sign out */}
      <motion.button
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors"
        style={{ color: 'var(--pace-interval)', background: 'rgba(248, 113, 113, 0.08)' }}
      >
        <LogOut size={16} /> Wyloguj się
      </motion.button>
    </div>
  )
}
