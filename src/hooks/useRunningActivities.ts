import { useMemo } from 'react'
import { useStrava } from './useStrava'
import type { StravaActivity, PlannedWorkout } from '@/types'

interface ActivityForWorkout {
  activity: StravaActivity | null
  isMatched: boolean
}

export function useRunningActivities(userId: string) {
  const strava = useStrava(userId)

  // Activities grouped by week
  const activitiesByWeek = useMemo(() => {
    const grouped: Record<number, StravaActivity[]> = {}
    for (const act of strava.activities) {
      const weekNum = act.matchedWeekNumber
      if (weekNum) {
        if (!grouped[weekNum]) grouped[weekNum] = []
        grouped[weekNum].push(act)
      }
    }
    return grouped
  }, [strava.activities])

  // Get activity for a specific planned workout
  const getActivityForWorkout = (workoutId: string): ActivityForWorkout => {
    const match = strava.activities.find(a => a.matchedWorkoutId === workoutId)
    return {
      activity: match || null,
      isMatched: !!match,
    }
  }

  // Recent activities (last 14 days)
  const recentActivities = useMemo(() => {
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const cutoff = twoWeeksAgo.toISOString().split('T')[0]

    return strava.activities.filter(a => a.date >= cutoff)
  }, [strava.activities])

  // Week stats
  const getWeekStats = (weekNumber: number) => {
    const weekActivities = activitiesByWeek[weekNumber] || []
    return {
      completedWorkouts: weekActivities.length,
      totalDistance: weekActivities.reduce((sum, a) => sum + a.distance, 0),
      totalElevation: weekActivities.reduce((sum, a) => sum + (a.totalElevationGain || 0), 0),
      avgPace: weekActivities.length > 0
        ? weekActivities.reduce((sum, a) => sum + a.avgPace, 0) / weekActivities.length
        : 0,
      avgHR: weekActivities.filter(a => a.avgHR).length > 0
        ? weekActivities.reduce((sum, a) => sum + (a.avgHR || 0), 0) / weekActivities.filter(a => a.avgHR).length
        : undefined,
    }
  }

  // Compare planned vs actual for a workout
  const compareWorkout = (planned: PlannedWorkout, actual: StravaActivity) => {
    const distanceKmPlanned = planned.distanceKm
    const distanceKmActual = actual.distance / 1000
    const distanceDiff = ((distanceKmActual - distanceKmPlanned) / distanceKmPlanned) * 100

    let paceMatch: 'on_target' | 'faster' | 'slower' | 'unknown' = 'unknown'
    if (planned.targetPace && actual.avgPace > 0) {
      if (actual.avgPace < planned.targetPace.min) paceMatch = 'faster'
      else if (actual.avgPace > planned.targetPace.max) paceMatch = 'slower'
      else paceMatch = 'on_target'
    }

    let elevationDiff: number | undefined
    if (planned.elevationGain && actual.totalElevationGain) {
      elevationDiff = ((actual.totalElevationGain - planned.elevationGain) / planned.elevationGain) * 100
    }

    return {
      distanceKmPlanned,
      distanceKmActual,
      distanceDiff,
      paceMatch,
      elevationDiff,
      paceActual: actual.avgPace,
      gapActual: actual.gradeAdjustedPace,
      hrActual: actual.avgHR,
    }
  }

  return {
    ...strava,
    activitiesByWeek,
    recentActivities,
    getActivityForWorkout,
    getWeekStats,
    compareWorkout,
  }
}
