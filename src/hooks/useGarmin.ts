import { useState, useCallback } from 'react'
import { buildGarminWorkout } from '@/lib/garmin-workout-builder'
import type { PlannedWorkout } from '@/types'

type GarminStatus = 'idle' | 'uploading' | 'scheduled' | 'error'

interface GarminUploadResult {
  garminWorkoutId?: string
  error?: string
}

export function useGarmin() {
  const [status, setStatus] = useState<GarminStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const uploadWorkout = useCallback(async (workout: PlannedWorkout, date: string): Promise<GarminUploadResult> => {
    setStatus('uploading')
    setError(null)

    try {
      const garminJson = buildGarminWorkout(workout)

      // TODO: Call Garmin MCP upload_workout + schedule_workout
      // For now, simulate the upload
      console.log('Garmin workout JSON:', garminJson)
      console.log('Schedule date:', date)

      // Simulate delay
      await new Promise(resolve => setTimeout(resolve, 1500))

      setStatus('scheduled')
      return { garminWorkoutId: `garmin_${Date.now()}` }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Upload failed'
      setError(errorMsg)
      setStatus('error')
      return { error: errorMsg }
    }
  }, [])

  const uploadWeek = useCallback(async (workouts: { workout: PlannedWorkout; date: string }[]): Promise<void> => {
    setStatus('uploading')
    setError(null)

    try {
      for (const { workout, date } of workouts) {
        await uploadWorkout(workout, date)
      }
      setStatus('scheduled')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Batch upload failed')
      setStatus('error')
    }
  }, [uploadWorkout])

  const reset = useCallback(() => {
    setStatus('idle')
    setError(null)
  }, [])

  return { status, error, uploadWorkout, uploadWeek, reset }
}
