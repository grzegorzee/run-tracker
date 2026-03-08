import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useUser } from '@/contexts/UserContext'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'

type CallbackStatus = 'loading' | 'success' | 'error'

export default function StravaCallback() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const [status, setStatus] = useState<CallbackStatus>('loading')
  const [errorMessage, setErrorMessage] = useState('')
  const [syncedCount, setSyncedCount] = useState(0)

  useEffect(() => {
    const code = searchParams.get('code')
    const callbackError = searchParams.get('error')

    if (callbackError) {
      setStatus('error')
      setErrorMessage('Autoryzacja została odrzucona.')
      return
    }

    if (!code) {
      setStatus('error')
      setErrorMessage('Brak kodu autoryzacji.')
      return
    }

    if (!user) {
      setStatus('error')
      setErrorMessage('Musisz być zalogowany.')
      return
    }

    const exchangeCode = async () => {
      try {
        const callback = httpsCallable(functions, 'stravaCallback')
        const result = await callback({ code, userId: user.uid })
        const data = result.data as { success: boolean; synced?: number; athleteName?: string }

        setSyncedCount(data.synced || 0)
        setStatus('success')

        // Auto-redirect to settings after 3 seconds
        setTimeout(() => navigate('/settings', { replace: true }), 3000)
      } catch (err) {
        console.error('Strava callback error:', err)
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Błąd połączenia ze Stravą')
      }
    }

    exchangeCode()
  }, [searchParams, user, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-8 max-w-sm mx-4 text-center"
      >
        {status === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto mb-4 animate-spin" style={{ color: '#FC4C02' }} />
            <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Łączenie ze Stravą...
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Wymiana tokenów i synchronizacja aktywności
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle size={40} className="mx-auto mb-4" style={{ color: 'var(--green-primary)' }} />
            <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Strava połączona!
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Zsynchronizowano {syncedCount} aktywności biegowych
            </p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Przekierowanie za 3 sekundy...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle size={40} className="mx-auto mb-4" style={{ color: 'var(--pace-interval)' }} />
            <h2 className="font-display text-lg font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              Błąd
            </h2>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              {errorMessage}
            </p>
            <button
              onClick={() => navigate('/settings', { replace: true })}
              className="btn-primary text-sm"
            >
              Wróć do ustawień
            </button>
          </>
        )}
      </motion.div>
    </div>
  )
}
