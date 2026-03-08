import { useState, useEffect, useCallback } from 'react'
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { httpsCallable } from 'firebase/functions'
import { db, functions } from '@/lib/firebase'
import type { StravaActivity } from '@/types'

interface StravaConnection {
  connected: boolean
  athleteId?: string
  athleteName?: string
  lastSync?: string
}

export function useStrava(userId: string) {
  const [activities, setActivities] = useState<StravaActivity[]>([])
  const [connection, setConnection] = useState<StravaConnection>({ connected: false })
  const [isSyncing, setIsSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Real-time subscription to connection status
  useEffect(() => {
    if (!userId) return

    const unsubscribe = onSnapshot(doc(db, 'users', userId), (snap) => {
      const data = snap.data()
      if (data) {
        setConnection({
          connected: data.stravaConnected || false,
          athleteId: data.stravaAthleteId,
          athleteName: data.stravaAthleteName,
          lastSync: data.stravaLastSync,
        })
      }
    })

    return () => unsubscribe()
  }, [userId])

  // Real-time subscription to activities
  useEffect(() => {
    if (!userId) return

    const q = query(
      collection(db, 'strava_activities'),
      where('userId', '==', userId),
      orderBy('date', 'desc')
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const acts = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data(),
      })) as StravaActivity[]
      setActivities(acts)
    }, (err) => {
      console.error('Strava activities subscription error:', err)
    })

    return () => unsubscribe()
  }, [userId])

  // Connect to Strava (redirect to OAuth)
  const connectStrava = useCallback(async () => {
    setError(null)
    try {
      const getAuthUrl = httpsCallable(functions, 'stravaAuthUrl')
      const result = await getAuthUrl({ userId })
      const data = result.data as { url: string }
      window.location.href = data.url
    } catch (err) {
      console.error('Strava connect error:', err)
      setError('Nie udało się połączyć ze Stravą')
    }
  }, [userId])

  // Manual sync
  const syncActivities = useCallback(async () => {
    setIsSyncing(true)
    setError(null)
    try {
      const sync = httpsCallable(functions, 'stravaSync')
      const result = await sync({ userId })
      const data = result.data as { synced: number; totalFetched: number; lookbackDays: number }
      return { ok: true, ...data }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      setError(message)
      return { ok: false, message }
    } finally {
      setIsSyncing(false)
    }
  }, [userId])

  // Disconnect Strava
  const disconnectStrava = useCallback(async () => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        stravaConnected: false,
        stravaTokens: null,
        stravaAthleteId: null,
        stravaAthleteName: null,
        stravaLastSync: null,
      })
      setConnection({ connected: false })
      setActivities([])
    } catch (err) {
      console.error('Disconnect error:', err)
      setError('Nie udało się rozłączyć')
    }
  }, [userId])

  return {
    activities,
    connection,
    isSyncing,
    error,
    connectStrava,
    syncActivities,
    disconnectStrava,
  }
}
