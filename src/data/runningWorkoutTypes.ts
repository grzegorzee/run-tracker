import type { WorkoutType } from '@/types'

interface WorkoutTypeConfig {
  type: WorkoutType
  label: string
  shortLabel: string
  color: string
  icon: string
  description: string
}

export const WORKOUT_TYPES: Record<WorkoutType, WorkoutTypeConfig> = {
  easy_run: {
    type: 'easy_run',
    label: 'Łatwy bieg',
    shortLabel: 'Easy',
    color: 'var(--pace-easy)',
    icon: '🏃',
    description: 'Bieg w strefie Z1-Z2, komfortowe tempo, możesz rozmawiać',
  },
  tempo: {
    type: 'tempo',
    label: 'Tempo',
    shortLabel: 'Tempo',
    color: 'var(--pace-tempo)',
    icon: '⚡',
    description: 'Bieg progowy — komfortowo szybko, na granicy Z3-Z4',
  },
  intervals: {
    type: 'intervals',
    label: 'Interwały',
    shortLabel: 'Intervals',
    color: 'var(--pace-interval)',
    icon: '🔥',
    description: 'Szybkie odcinki z odpoczynkiem — budują VO2max',
  },
  long_run: {
    type: 'long_run',
    label: 'Długi bieg',
    shortLabel: 'Long',
    color: 'var(--pace-long)',
    icon: '🛤️',
    description: 'Fundament wytrzymałości — easy pace, duży dystans',
  },
  recovery: {
    type: 'recovery',
    label: 'Regeneracja',
    shortLabel: 'Recovery',
    color: 'var(--pace-recovery)',
    icon: '🧘',
    description: 'Bardzo wolny bieg — aktywna regeneracja',
  },
  race: {
    type: 'race',
    label: 'Zawody',
    shortLabel: 'Race',
    color: 'var(--gold-accent)',
    icon: '🏅',
    description: 'Dzień wyścigu!',
  },
  hill_repeats: {
    type: 'hill_repeats',
    label: 'Hill repeats',
    shortLabel: 'Hills',
    color: 'var(--pace-hills)',
    icon: '⛰️',
    description: 'Podbieganie pod górki — buduje siłę i moc',
  },
  trail_run: {
    type: 'trail_run',
    label: 'Trail run',
    shortLabel: 'Trail',
    color: 'var(--pace-trail)',
    icon: '🌲',
    description: 'Bieg w terenie — effort > pace',
  },
  vertical_km: {
    type: 'vertical_km',
    label: 'Vertical KM',
    shortLabel: 'VK',
    color: 'var(--pace-hills)',
    icon: '🏔️',
    description: '1000m D+ na najkrótszym dystansie',
  },
  downhill_drills: {
    type: 'downhill_drills',
    label: 'Downhill drills',
    shortLabel: 'Downhill',
    color: 'var(--pace-trail)',
    icon: '⬇️',
    description: 'Trening zbiegania — wzmacnia kwadricepsy',
  },
  back_to_back: {
    type: 'back_to_back',
    label: 'Back-to-back',
    shortLabel: 'B2B',
    color: 'var(--pace-long)',
    icon: '🔄',
    description: 'Double long run sob+nd — symulacja ultra',
  },
  taper_easy: {
    type: 'taper_easy',
    label: 'Taper easy',
    shortLabel: 'Taper',
    color: 'var(--pace-taper)',
    icon: '🌊',
    description: 'Taper — zredukowana objętość, łatwe tempo',
  },
  taper_shakeout: {
    type: 'taper_shakeout',
    label: 'Shakeout',
    shortLabel: 'Shakeout',
    color: 'var(--pace-taper)',
    icon: '✨',
    description: 'Krótki bieg w race pace — przedstartowe pobudzenie',
  },
}

export function getWorkoutColor(type: WorkoutType): string {
  return WORKOUT_TYPES[type]?.color ?? 'var(--text-secondary)'
}

export function getWorkoutLabel(type: WorkoutType): string {
  return WORKOUT_TYPES[type]?.label ?? type
}
