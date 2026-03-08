// ===== Runner & Onboarding Types =====

export type RunnerType = 'road' | 'trail' | 'mountain' | 'mixed'

export type GoalType =
  | 'first_5k' | 'improve_5k'
  | 'first_10k' | 'improve_10k'
  | 'half_marathon' | 'marathon'
  | 'trail_race' | 'ultra'
  | 'run_more'

export type RunnerLevel = 'never_ran' | 'occasional' | 'regular' | 'competitive'

export type WeeklyDistance = '0' | '1-10' | '10-30' | '30-50' | '50+'

export type TerrainAccess = 'full' | 'limited' | 'none'
export type HillExperience = 'none' | 'basic' | 'advanced'

export interface OnboardingData {
  runnerType: RunnerType
  goalType: GoalType
  level: RunnerLevel
  weeklyDistance: WeeklyDistance
  comfortPace?: string          // mm:ss format
  raceTime?: string             // recent race time
  raceDistance?: string          // recent race distance
  daysPerWeek: number           // 3-6
  terrainAccess?: TerrainAccess
  targetElevation?: number      // meters D+
  hillExperience?: HillExperience
  injuries?: string
  goalDate?: string             // YYYY-MM-DD
}

// ===== Workout Types =====

export type WorkoutType =
  | 'easy_run'
  | 'tempo'
  | 'intervals'
  | 'long_run'
  | 'recovery'
  | 'race'
  | 'hill_repeats'
  | 'trail_run'
  | 'vertical_km'
  | 'downhill_drills'
  | 'back_to_back'
  | 'taper_easy'
  | 'taper_shakeout'

export type PhaseType = 'base' | 'build' | 'peak' | 'taper' | 'race'
export type WeekType = 'build' | 'recovery' | 'taper' | 'race'

// ===== Training Plan Types =====

export interface PaceZones {
  easy: { min: number; max: number }       // sec/km
  tempo: { min: number; max: number }
  interval: { min: number; max: number }
  race: { min: number; max: number }
}

export interface PhaseDefinition {
  phase: PhaseType
  startWeek: number
  endWeek: number
  weeklyKmTarget: number
  weeklyElevationTarget?: number
  description: string
}

export interface PlannedWorkout {
  id: string
  dayOfWeek: number             // 1=Mon, 7=Sun
  type: WorkoutType
  title: string
  description: string
  distanceKm: number
  targetPace?: { min: number; max: number }  // sec/km
  targetHR?: { min: number; max: number }
  elevationGain?: number        // meters
  intervals?: IntervalSet
  duration?: number             // minutes (alternative to distance)
}

export interface IntervalSet {
  repeats: number
  workDistance?: number          // meters
  workDuration?: number         // seconds
  workPace?: { min: number; max: number }
  restDistance?: number
  restDuration?: number
}

export interface TrainingWeek {
  weekNumber: number
  weekType: WeekType
  phase: PhaseType
  startDate: string             // YYYY-MM-DD
  totalDistanceKm: number
  totalElevation?: number
  workouts: PlannedWorkout[]
}

export interface TrainingPlan {
  id: string
  userId: string
  goalType: GoalType
  goalDate?: string
  targetRaceDistance?: string
  runnerType: RunnerType
  totalWeeks: number
  startDate: string
  endDate: string
  currentPhase: PhaseType
  taperWeeks: number
  macroStructure: PhaseDefinition[]
  generatedUpTo: string         // YYYY-MM-DD
  weeks: TrainingWeek[]
  paceZones: PaceZones
  paceZonesUpdatedAt?: string
  elevationTarget?: number
  status: 'active' | 'completed' | 'expired'
  createdAt: string
  updatedAt: string
}

// ===== Strava Activity Types =====

export interface BestEfforts {
  '400m'?: number
  '1k'?: number
  '1mile'?: number
  '5k'?: number
  '10k'?: number
  'half'?: number
  'marathon'?: number
}

export interface ActivitySplit {
  km: number
  pace: number
  elevDiff: number
  paceZone: number
}

export interface HRZoneDistribution {
  z1: number
  z2: number
  z3: number
  z4: number
  z5: number
}

export interface WorkoutAISummary {
  rating: number                // 1-5
  ratingLabel: string           // 'EXCELLENT' | 'GOOD' | 'OK' | 'BELOW_TARGET' | 'MISSED'
  summary: string
  highlights: string[]
  suggestions: string[]
  elevationAnalysis?: string
}

export interface StravaActivity {
  id: string
  userId: string
  stravaId: number
  name: string
  date: string
  sportType: 'Run' | 'TrailRun' | 'VirtualRun'
  distance: number              // meters
  movingTime: number            // seconds
  elapsedTime: number
  avgSpeed: number              // m/s
  maxSpeed: number
  avgPace: number               // sec/km
  avgHR?: number
  maxHR?: number
  avgCadence?: number
  calories?: number
  totalElevationGain?: number
  elevHigh?: number
  elevLow?: number
  avgTemp?: number
  perceivedExertion?: number
  workoutType?: number
  deviceName?: string
  prCount?: number
  bestEfforts?: BestEfforts
  splits?: ActivitySplit[]
  // Derived metrics
  trimp?: number
  efficiencyFactor?: number
  aerobicDecoupling?: number
  gradeAdjustedPace?: number
  hrZoneDistribution?: HRZoneDistribution
  // Matching
  matchedWorkoutId?: string
  matchedWeekNumber?: number
  // AI
  aiSummary?: WorkoutAISummary
  stravaUrl?: string
  syncedAt: string
}

// ===== Weekly Summary =====

export interface WeeklySummary {
  id: string
  userId: string
  planId: string
  weekNumber: number
  weekStartDate: string
  weekType: WeekType
  plannedDistance: number
  plannedWorkouts: number
  plannedElevation?: number
  actualDistance: number
  actualWorkouts: number
  actualElevation?: number
  avgPace?: number
  avgGAP?: number
  weeklyTrimp: number
  acwr?: number
  hrDriftTrend?: number
  efTrend?: number
  aiInsights?: string
  adaptationSuggestions?: string[]
}

// ===== User Types =====

export interface UserProfile {
  uid: string
  email: string
  displayName: string
  photoURL?: string
  role: string
  onboardingCompleted: boolean
  garminConnected: boolean
  stravaConnected: boolean
  stravaTokens?: {
    accessToken: string
    refreshToken: string
    expiresAt: number
  }
  stravaAthleteId?: string
  stravaAthleteName?: string
  stravaLastSync?: string
  preferredTerrain: RunnerType
  lastLogin: string
  createdAt: string
}
