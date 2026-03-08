import { motion } from 'framer-motion'
import { useUser } from '@/contexts/UserContext'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useRunningActivities } from '@/hooks/useRunningActivities'
import AnimatedNumber from '@/components/AnimatedNumber'
import { useNavigate } from 'react-router-dom'
import { formatPace, formatDistance, formatElevation } from '@/lib/utils'
import { WORKOUT_TYPES } from '@/data/runningWorkoutTypes'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { toast } from 'sonner'

export default function Dashboard() {
  const { user, userProfile } = useUser()
  const navigate = useNavigate()
  const { plan, currentWeek, todayWorkout } = useTrainingPlan()
  const { recentActivities, getWeekStats, getActivityForWorkout } = useRunningActivities(user?.uid || '')
  const [isGenerating, setIsGenerating] = useState(false)

  const firstName = userProfile?.displayName?.split(' ')[0] || 'Biegaczu'

  // Current week stats from Strava
  const weekStats = currentWeek ? getWeekStats(currentWeek.weekNumber) : null

  // Hero metrics
  const weeklyKm = weekStats ? weekStats.totalDistance / 1000 : 0
  const avgPace = weekStats?.avgPace || 0
  const elevation = weekStats?.totalElevation || 0
  const runsCompleted = weekStats?.completedWorkouts || 0
  const runsPlanned = currentWeek?.workouts?.length || 0

  const handleGenerateNext = async () => {
    if (!user) return
    setIsGenerating(true)
    try {
      const trigger = httpsCallable(functions, 'triggerAdaptivePlanner')
      const result = await trigger({ userId: user.uid })
      const data = result.data as { generated: number; alerts: string[] }
      toast.success(`Wygenerowano ${data.generated} treningów`)
      if (data.alerts?.length > 0) {
        data.alerts.forEach(a => toast.info(a))
      }
    } catch (err) {
      console.error('Adaptive planner error:', err)
      toast.error('Błąd generowania treningów')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="font-display text-2xl md:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Dzień dobry, {firstName}
        </h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          {plan ? (
            <>
              Tydzień {currentWeek?.weekNumber || '?'} z {plan.totalWeeks} &middot;{' '}
              <span className={`phase-${plan.currentPhase} font-semibold`}>
                {plan.currentPhase.toUpperCase()}
              </span>
            </>
          ) : (
            'Brak aktywnego planu'
          )}
        </p>
      </motion.div>

      {/* Hero metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {[
          { value: weeklyKm, label: 'km', decimals: 1 },
          { value: avgPace, label: '/km', decimals: 0, displayText: avgPace > 0 ? formatPace(avgPace) : '—' },
          { value: elevation, label: 'D+ m', decimals: 0 },
          { value: runsCompleted, label: `/ ${runsPlanned} runs`, decimals: 0 },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08, duration: 0.5 }}
            className="glass-card p-4 md:p-5 glow-accent"
          >
            <div className="font-mono text-3xl md:text-4xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              {stat.displayText ? (
                <motion.span
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: i * 0.08 + 0.2 }}
                >
                  {stat.displayText}
                </motion.span>
              ) : (
                <AnimatedNumber value={stat.value} decimals={stat.decimals} />
              )}
            </div>
            <p className="mt-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>
              {stat.label}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Today's workout */}
      {todayWorkout ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 md:p-6"
          style={{ borderLeft: `3px solid ${WORKOUT_TYPES[todayWorkout.type]?.color || 'var(--green-primary)'}` }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green-primary)' }} />
            <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--green-primary)' }}>
              Dzisiaj
            </span>
          </div>
          <h3 className="font-display text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {todayWorkout.title} &middot; {todayWorkout.distanceKm} km
            {todayWorkout.elevationGain ? ` · ${formatElevation(todayWorkout.elevationGain)}` : ''}
          </h3>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {todayWorkout.description}
          </p>

          <div className="flex gap-3 mt-4">
            <button
              onClick={() => navigate(`/workout/${todayWorkout.id}`)}
              className="btn-primary text-sm flex items-center gap-2"
            >
              Szczegóły
            </button>
          </div>
        </motion.div>
      ) : plan ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-5 text-center"
        >
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Brak zaplanowanego treningu na dziś. Dzień odpoczynku!
          </p>
        </motion.div>
      ) : null}

      {/* This week */}
      {currentWeek && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <h2 className="font-display text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Ten tydzień
          </h2>
          <div className="space-y-2">
            {currentWeek.workouts.map((workout, i) => {
              const activityData = getActivityForWorkout(workout.id)
              const isDone = activityData.isMatched
              const dayNames = ['', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']
              const today = new Date().getDay()
              const todayDow = today === 0 ? 7 : today
              const isToday = workout.dayOfWeek === todayDow
              const typeInfo = WORKOUT_TYPES[workout.type]

              return (
                <motion.div
                  key={workout.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.08 }}
                  className="flex items-center gap-3 py-2 px-3 rounded-xl transition-colors cursor-pointer"
                  style={{ background: isToday ? 'var(--green-surface)' : 'transparent' }}
                  onClick={() => navigate(`/workout/${workout.id}`)}
                >
                  <span className="text-sm w-8" style={{ color: isDone ? 'var(--green-primary)' : isToday ? 'var(--green-primary)' : 'var(--text-tertiary)' }}>
                    {isDone ? '✓' : isToday ? '→' : '○'}
                  </span>
                  <span className="text-sm font-medium w-10" style={{ color: 'var(--text-secondary)' }}>
                    {dayNames[workout.dayOfWeek]}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: typeInfo?.color || 'var(--text-tertiary)' }}
                  />
                  <span className="text-sm flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {workout.title}
                  </span>
                  <span className="text-sm font-mono" style={{ color: isToday ? 'var(--green-primary)' : 'var(--text-tertiary)' }}>
                    {isDone && activityData.activity
                      ? `${formatPace(activityData.activity.avgPace)}/km`
                      : isToday
                        ? 'DZIŚ'
                        : `${workout.distanceKm}km`
                    }
                  </span>
                </motion.div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Generate next workouts button */}
      {plan && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <button
            onClick={handleGenerateNext}
            disabled={isGenerating}
            className="w-full btn-ghost flex items-center justify-center gap-2 text-sm py-3"
          >
            {isGenerating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Sparkles size={16} style={{ color: 'var(--gold-accent)' }} />
            )}
            {isGenerating ? 'Generuję treningi...' : 'Wygeneruj kolejne 7 dni treningów'}
          </button>
        </motion.div>
      )}

      {/* Recent activities from Strava */}
      {recentActivities.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <h2 className="font-display text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
            Ostatnie biegi
          </h2>
          <div className="space-y-2">
            {recentActivities.slice(0, 5).map((act, i) => (
              <motion.div
                key={act.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + i * 0.06 }}
                className="glass-card p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{act.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{act.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>
                    {formatDistance(act.distance)}
                  </p>
                  <p className="font-mono text-xs" style={{ color: 'var(--text-tertiary)' }}>
                    {formatPace(act.avgPace)}/km
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
