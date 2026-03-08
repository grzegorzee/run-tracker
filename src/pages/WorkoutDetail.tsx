import { useParams, useNavigate } from 'react-router-dom'
import { useUser } from '@/contexts/UserContext'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useRunningActivities } from '@/hooks/useRunningActivities'
import { useGarmin } from '@/hooks/useGarmin'
import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Loader2, Send, CheckCircle, Star } from 'lucide-react'
import { formatPace, formatDistance, formatElevation } from '@/lib/utils'
import { WORKOUT_TYPES } from '@/data/runningWorkoutTypes'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useState } from 'react'
import type { PlannedWorkout, WorkoutAISummary } from '@/types'

export default function WorkoutDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useUser()
  const { plan } = useTrainingPlan()
  const { getActivityForWorkout } = useRunningActivities(user?.uid || '')
  const garmin = useGarmin()
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  // Find workout in plan
  let workout: PlannedWorkout | null = null
  let weekNumber: number | null = null
  let weekPhase: string | null = null

  if (plan && id) {
    for (const week of plan.weeks) {
      const found = week.workouts.find(w => w.id === id)
      if (found) {
        workout = found
        weekNumber = week.weekNumber
        weekPhase = week.phase
        break
      }
    }
  }

  // Find matched Strava activity
  const activityMatch = id ? getActivityForWorkout(id) : { activity: null, isMatched: false }
  const activity = activityMatch.activity

  const workoutTypeInfo = workout ? WORKOUT_TYPES[workout.type] : null

  const handleGarminUpload = async () => {
    if (!workout) return
    const today = new Date().toISOString().split('T')[0]
    await garmin.uploadWorkout(workout, today)
  }

  const handleAnalyze = async () => {
    if (!activity || !user) return
    setIsAnalyzing(true)
    try {
      const analyze = httpsCallable(functions, 'analyzeWorkout')
      await analyze({ activityId: activity.id, userId: user.uid })
    } catch (err) {
      console.error('Analysis error:', err)
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (!workout) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl">
          <ArrowLeft size={18} />
        </button>
        <p className="text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
          Trening nie został znaleziony.
        </p>
      </div>
    )
  }

  const accentColor = workoutTypeInfo?.color || 'var(--green-primary)'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2 rounded-xl">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {workout.title}
          </h1>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {workoutTypeInfo?.label || workout.type}
            {weekNumber && ` · Tydzień ${weekNumber}`}
            {weekPhase && ` · ${weekPhase.toUpperCase()}`}
          </p>
        </div>
      </div>

      {/* Workout description */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-4"
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {workout.description}
        </p>
      </motion.div>

      {/* Plan vs Execution */}
      <div className="grid grid-cols-2 gap-4">
        {/* Plan */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-tertiary)' }}>
            Plan
          </p>
          <div className="space-y-3">
            <MetricRow label="Dystans" value={`${workout.distanceKm} km`} />
            {workout.targetPace && (
              <MetricRow
                label="Tempo"
                value={`${formatPace(workout.targetPace.min)}-${formatPace(workout.targetPace.max)}`}
              />
            )}
            {workout.targetHR && (
              <MetricRow label="HR" value={`${workout.targetHR.min}-${workout.targetHR.max}`} />
            )}
            {workout.elevationGain && (
              <MetricRow label="D+" value={formatElevation(workout.elevationGain)} />
            )}
            {workout.intervals && (
              <MetricRow
                label="Interwały"
                value={`${workout.intervals.repeats}x ${workout.intervals.workDistance ? `${workout.intervals.workDistance}m` : `${workout.intervals.workDuration}s`}`}
              />
            )}
          </div>
        </motion.div>

        {/* Execution */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          className="glass-card p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: activity ? 'var(--green-primary)' : 'var(--text-tertiary)' }}>
            {activity ? 'Wykonanie' : 'Brak danych'}
          </p>
          {activity ? (
            <div className="space-y-3">
              <MetricRow
                label="Dystans"
                value={formatDistance(activity.distance)}
                check={isDistanceOk(workout.distanceKm, activity.distance)}
              />
              <MetricRow
                label="Tempo"
                value={`${formatPace(activity.avgPace)}/km`}
                check={workout.targetPace ? isPaceOk(workout.targetPace, activity.avgPace) : undefined}
              />
              {activity.gradeAdjustedPace && (
                <MetricRow label="GAP" value={`${formatPace(activity.gradeAdjustedPace)}/km`} />
              )}
              {activity.avgHR && (
                <MetricRow
                  label="HR"
                  value={`${activity.avgHR} bpm`}
                  check={workout.targetHR ? isHROk(workout.targetHR, activity.avgHR) : undefined}
                />
              )}
              {activity.totalElevationGain && (
                <MetricRow
                  label="D+"
                  value={formatElevation(activity.totalElevationGain)}
                  check={workout.elevationGain ? isElevOk(workout.elevationGain, activity.totalElevationGain) : undefined}
                />
              )}
              {activity.avgCadence && (
                <MetricRow label="Kadencja" value={`${activity.avgCadence} SPM`} />
              )}
            </div>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Połącz Stravę lub zsynchronizuj aktywności
            </p>
          )}
        </motion.div>
      </div>

      {/* AI Analysis */}
      {activity?.aiSummary && (
        <AIAnalysisCard summary={activity.aiSummary} />
      )}

      {/* Trigger AI Analysis */}
      {activity && !activity.aiSummary && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={handleAnalyze}
          disabled={isAnalyzing}
          className="w-full btn-ghost flex items-center justify-center gap-2 text-sm py-3"
          style={{ borderColor: 'var(--gold-accent)', color: 'var(--gold-accent)' }}
        >
          {isAnalyzing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Star size={16} />
          )}
          {isAnalyzing ? 'Analizuję...' : 'Uruchom AI analizę'}
        </motion.button>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleGarminUpload}
          disabled={garmin.status === 'uploading'}
          className="btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
        >
          {garmin.status === 'uploading' ? (
            <Loader2 size={16} className="animate-spin" />
          ) : garmin.status === 'scheduled' ? (
            <CheckCircle size={16} />
          ) : (
            <Send size={16} />
          )}
          {garmin.status === 'uploading' ? 'Wysyłam...' : garmin.status === 'scheduled' ? 'Wysłano!' : 'Wyślij na Garmin'}
        </button>
        {activity?.stravaUrl && (
          <a
            href={activity.stravaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost flex items-center gap-2 text-sm"
          >
            <ExternalLink size={14} /> Strava
          </a>
        )}
      </div>

      <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
        ID: {id || 'preview'}
      </p>
    </div>
  )
}

function MetricRow({ label, value, check }: { label: string; value: string; check?: boolean }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        {value}
        {check !== undefined && (
          <span className="ml-1" style={{ color: check ? 'var(--green-primary)' : 'var(--pace-interval)' }}>
            {check ? '✓' : '✗'}
          </span>
        )}
      </p>
    </div>
  )
}

function AIAnalysisCard({ summary }: { summary: WorkoutAISummary }) {
  const ratingStars = '⭐'.repeat(Math.min(summary.rating, 5))
  const ratingColor = summary.rating >= 4 ? 'var(--green-primary)' : summary.rating >= 3 ? 'var(--gold-accent)' : 'var(--pace-interval)'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass-card p-5"
      style={{ borderLeft: '3px solid var(--gold-accent)' }}
    >
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--gold-accent)' }}>
          AI Analiza
        </span>
        <span className="ml-auto text-sm">{ratingStars}</span>
        <span className="text-xs font-bold" style={{ color: ratingColor }}>
          {summary.ratingLabel}
        </span>
      </div>
      <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
        {summary.summary}
      </p>

      {summary.highlights.length > 0 && (
        <ul className="space-y-1 mb-3">
          {summary.highlights.map((item, i) => (
            <li key={i} className="text-xs flex gap-2" style={{ color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--green-primary)' }}>•</span>
              {item}
            </li>
          ))}
        </ul>
      )}

      {summary.suggestions.length > 0 && (
        <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {summary.suggestions.map((s, i) => (
            <p key={i} className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              Sugestia: {s}
            </p>
          ))}
        </div>
      )}

      {summary.elevationAnalysis && (
        <p className="mt-2 text-xs" style={{ color: 'var(--pace-trail)' }}>
          {summary.elevationAnalysis}
        </p>
      )}
    </motion.div>
  )
}

// Check helpers
function isDistanceOk(plannedKm: number, actualMeters: number): boolean {
  const diff = Math.abs(actualMeters / 1000 - plannedKm) / plannedKm
  return diff <= 0.15
}

function isPaceOk(target: { min: number; max: number }, actual: number): boolean {
  return actual >= target.min * 0.95 && actual <= target.max * 1.05
}

function isHROk(target: { min: number; max: number }, actual: number): boolean {
  return actual >= target.min - 5 && actual <= target.max + 5
}

function isElevOk(planned: number, actual: number): boolean {
  const diff = Math.abs(actual - planned) / planned
  return diff <= 0.25
}
