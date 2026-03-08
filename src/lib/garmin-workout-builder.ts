import type { PlannedWorkout, WorkoutType } from '@/types'

// Garmin workout JSON structures
interface GarminWorkoutStep {
  type: 'ExecutableStepDTO'
  stepType: 'warmup' | 'interval' | 'cooldown' | 'rest' | 'recovery'
  endCondition: 'distance' | 'time' | 'lap.button'
  endConditionValue?: number
  targetType?: 'pace.zone' | 'heart.rate.zone' | 'no.target'
  targetValueLow?: number
  targetValueHigh?: number
  description?: string
}

interface GarminRepeatGroup {
  type: 'RepeatGroupDTO'
  numberOfIterations: number
  steps: GarminWorkoutStep[]
}

interface GarminWorkout {
  workoutName: string
  description: string
  sport: 'RUNNING'
  subSport?: 'TRAIL_RUNNING'
  workoutSteps: (GarminWorkoutStep | GarminRepeatGroup)[]
}

// Convert pace (sec/km) to Garmin pace (m/s)
function paceToMs(secPerKm: number): number {
  return 1000 / secPerKm
}

export function buildGarminWorkout(workout: PlannedWorkout): GarminWorkout {
  const isTrail = isTrailWorkout(workout.type)
  const steps = buildSteps(workout, isTrail)

  return {
    workoutName: workout.title,
    description: workout.description,
    sport: 'RUNNING',
    subSport: isTrail ? 'TRAIL_RUNNING' : undefined,
    workoutSteps: steps,
  }
}

function isTrailWorkout(type: WorkoutType): boolean {
  return ['trail_run', 'hill_repeats', 'vertical_km', 'downhill_drills', 'back_to_back'].includes(type)
}

function buildSteps(workout: PlannedWorkout, isTrail: boolean): (GarminWorkoutStep | GarminRepeatGroup)[] {
  const steps: (GarminWorkoutStep | GarminRepeatGroup)[] = []

  switch (workout.type) {
    case 'easy_run':
    case 'recovery':
    case 'taper_easy':
      steps.push(simpleRun(workout))
      break

    case 'long_run':
    case 'trail_run':
    case 'back_to_back':
      steps.push(simpleRun(workout))
      break

    case 'tempo':
      steps.push(warmup(10 * 60))
      steps.push(tempoBlock(workout))
      steps.push(cooldown(10 * 60))
      break

    case 'intervals':
      steps.push(warmup(10 * 60))
      if (workout.intervals) {
        steps.push(intervalBlock(workout))
      }
      steps.push(cooldown(10 * 60))
      break

    case 'hill_repeats':
      steps.push(warmup(10 * 60))
      if (workout.intervals) {
        steps.push(hillRepeatBlock(workout))
      }
      steps.push(cooldown(10 * 60))
      break

    case 'taper_shakeout':
      // Short race-pace burst
      steps.push(warmup(5 * 60))
      steps.push({
        type: 'ExecutableStepDTO',
        stepType: 'interval',
        endCondition: 'distance',
        endConditionValue: 2000,
        targetType: isTrail ? 'heart.rate.zone' : 'pace.zone',
        targetValueLow: workout.targetPace ? paceToMs(workout.targetPace.max) : undefined,
        targetValueHigh: workout.targetPace ? paceToMs(workout.targetPace.min) : undefined,
        description: 'Race pace shakeout',
      })
      steps.push(cooldown(5 * 60))
      break

    default:
      steps.push(simpleRun(workout))
  }

  return steps
}

function simpleRun(workout: PlannedWorkout): GarminWorkoutStep {
  return {
    type: 'ExecutableStepDTO',
    stepType: 'interval',
    endCondition: 'distance',
    endConditionValue: workout.distanceKm * 1000,
    targetType: workout.targetPace ? 'pace.zone' : 'no.target',
    targetValueLow: workout.targetPace ? paceToMs(workout.targetPace.max) : undefined,
    targetValueHigh: workout.targetPace ? paceToMs(workout.targetPace.min) : undefined,
  }
}

function warmup(durationSeconds: number): GarminWorkoutStep {
  return {
    type: 'ExecutableStepDTO',
    stepType: 'warmup',
    endCondition: 'time',
    endConditionValue: durationSeconds,
    targetType: 'no.target',
    description: 'Easy warmup',
  }
}

function cooldown(durationSeconds: number): GarminWorkoutStep {
  return {
    type: 'ExecutableStepDTO',
    stepType: 'cooldown',
    endCondition: 'time',
    endConditionValue: durationSeconds,
    targetType: 'no.target',
    description: 'Easy cooldown',
  }
}

function tempoBlock(workout: PlannedWorkout): GarminWorkoutStep {
  const tempoDistance = Math.max((workout.distanceKm - 3) * 1000, 2000)
  return {
    type: 'ExecutableStepDTO',
    stepType: 'interval',
    endCondition: 'distance',
    endConditionValue: tempoDistance,
    targetType: 'pace.zone',
    targetValueLow: workout.targetPace ? paceToMs(workout.targetPace.max) : undefined,
    targetValueHigh: workout.targetPace ? paceToMs(workout.targetPace.min) : undefined,
    description: 'Tempo effort',
  }
}

function intervalBlock(workout: PlannedWorkout): GarminRepeatGroup {
  const intervals = workout.intervals!
  return {
    type: 'RepeatGroupDTO',
    numberOfIterations: intervals.repeats,
    steps: [
      {
        type: 'ExecutableStepDTO',
        stepType: 'interval',
        endCondition: intervals.workDistance ? 'distance' : 'time',
        endConditionValue: intervals.workDistance || intervals.workDuration || 60,
        targetType: 'pace.zone',
        targetValueLow: intervals.workPace ? paceToMs(intervals.workPace.max) : undefined,
        targetValueHigh: intervals.workPace ? paceToMs(intervals.workPace.min) : undefined,
        description: 'Fast',
      },
      {
        type: 'ExecutableStepDTO',
        stepType: 'recovery',
        endCondition: intervals.restDistance ? 'distance' : 'time',
        endConditionValue: intervals.restDistance || intervals.restDuration || 90,
        targetType: 'no.target',
        description: 'Recovery jog',
      },
    ],
  }
}

function hillRepeatBlock(workout: PlannedWorkout): GarminRepeatGroup {
  const intervals = workout.intervals!
  return {
    type: 'RepeatGroupDTO',
    numberOfIterations: intervals.repeats,
    steps: [
      {
        type: 'ExecutableStepDTO',
        stepType: 'interval',
        endCondition: intervals.workDistance ? 'distance' : 'time',
        endConditionValue: intervals.workDistance || 200,
        targetType: 'heart.rate.zone',
        description: 'Hill — hard effort uphill',
      },
      {
        type: 'ExecutableStepDTO',
        stepType: 'recovery',
        endCondition: 'lap.button',
        targetType: 'no.target',
        description: 'Jog back down',
      },
    ],
  }
}
