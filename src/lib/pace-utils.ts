// Race prediction using Riegel formula: T2 = T1 × (D2/D1)^1.06
export function racePrediction(knownDistance: number, knownTime: number, targetDistance: number): number {
  return knownTime * Math.pow(targetDistance / knownDistance, 1.06)
}

// Calculate VDOT from race performance
export function calculateVDOT(distanceMeters: number, timeSeconds: number): number {
  const distanceKm = distanceMeters / 1000
  const timeMin = timeSeconds / 60
  const velocity = distanceKm / timeMin // km/min

  // Simplified Daniels VDOT estimation
  const percentVO2 = 0.8 + 0.1894393 * Math.exp(-0.012778 * timeMin)
    + 0.2989558 * Math.exp(-0.1932605 * timeMin)
  const vo2 = -4.60 + 0.182258 * velocity * 1000
    + 0.000104 * Math.pow(velocity * 1000, 2)

  return vo2 / percentVO2
}

// Calculate pace zones from threshold pace (sec/km)
export function calculatePaceZones(thresholdPace: number) {
  return {
    easy: { min: Math.round(thresholdPace * 1.25), max: Math.round(thresholdPace * 1.40) },
    tempo: { min: Math.round(thresholdPace * 0.97), max: Math.round(thresholdPace * 1.03) },
    interval: { min: Math.round(thresholdPace * 0.85), max: Math.round(thresholdPace * 0.92) },
    race: { min: Math.round(thresholdPace * 0.95), max: Math.round(thresholdPace * 1.00) },
  }
}

// Parse pace string (e.g. "5:30") to seconds per km
export function parsePace(paceStr: string): number {
  const parts = paceStr.split(':')
  if (parts.length !== 2) return 0
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

// Format seconds to pace string
export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / 60)
  const seconds = Math.round(secondsPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Speed (m/s) to pace (sec/km)
export function speedToPace(speedMs: number): number {
  if (speedMs <= 0) return 0
  return 1000 / speedMs
}

// Pace (sec/km) to speed (km/h)
export function paceToSpeedKmh(paceSecPerKm: number): number {
  if (paceSecPerKm <= 0) return 0
  return 3600 / paceSecPerKm
}

// Standard race distances in meters
export const RACE_DISTANCES = {
  '5k': 5000,
  '10k': 10000,
  'half': 21097.5,
  'marathon': 42195,
  '50k': 50000,
} as const
