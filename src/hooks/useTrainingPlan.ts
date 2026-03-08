import { useState, useEffect } from 'react'
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useUser } from '@/contexts/UserContext'
import type { TrainingPlan, TrainingWeek, PlannedWorkout } from '@/types'

interface TrainingPlanState {
  plan: TrainingPlan | null
  loading: boolean
  error: string | null
  currentWeek: TrainingWeek | null
  currentWeekNumber: number
  todayWorkout: PlannedWorkout | null
  isPlanExpired: boolean
}

export function useTrainingPlan(): TrainingPlanState {
  const { user } = useUser()
  const [plan, setPlan] = useState<TrainingPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      setPlan(null)
      setLoading(false)
      return
    }

    const q = query(
      collection(db, 'training_plans'),
      where('userId', '==', user.uid),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc'),
      limit(1)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.empty) {
        setPlan(null)
      } else {
        const doc = snapshot.docs[0]
        setPlan({ id: doc.id, ...doc.data() } as TrainingPlan)
      }
      setLoading(false)
    }, (err) => {
      console.error('Training plan error:', err)
      setError('Błąd ładowania planu')
      setLoading(false)
    })

    return () => unsubscribe()
  }, [user])

  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const todayDayOfWeek = today.getDay() === 0 ? 7 : today.getDay() // 1=Mon, 7=Sun

  let currentWeek: TrainingWeek | null = null
  let currentWeekNumber = 0
  let todayWorkout: PlannedWorkout | null = null
  let isPlanExpired = false

  if (plan) {
    // Calculate current week number
    const startDate = new Date(plan.startDate)
    const diffDays = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    currentWeekNumber = Math.floor(diffDays / 7) + 1

    // Find current week in generated weeks
    currentWeek = plan.weeks.find(w => w.weekNumber === currentWeekNumber) || null

    // Find today's workout
    if (currentWeek) {
      todayWorkout = currentWeek.workouts.find(w => w.dayOfWeek === todayDayOfWeek) || null
    }

    // Check expiration
    isPlanExpired = todayStr > plan.endDate
  }

  return {
    plan,
    loading,
    error,
    currentWeek,
    currentWeekNumber,
    todayWorkout,
    isPlanExpired,
  }
}
