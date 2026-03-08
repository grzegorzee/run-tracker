// Grade adjustment factor (research-based energy cost)
export function gradeAdjustmentFactor(gradePercent: number): number {
  if (gradePercent >= 0) {
    return 1 + gradePercent * 0.033 // +3.3% energy per 1% uphill
  }
  return 1 + gradePercent * 0.017   // -1.7% per 1% downhill (less saving than cost)
}

// Calculate Grade-Adjusted Pace from GPS pace + grade
export function calculateGAP(gpsPaceSecPerKm: number, gradePercent: number): number {
  const factor = gradeAdjustmentFactor(gradePercent)
  return gpsPaceSecPerKm / factor
}

// Estimate average grade from total elevation and distance
export function estimateAverageGrade(
  totalElevationGain: number,
  distanceMeters: number
): number {
  if (distanceMeters <= 0) return 0
  return (totalElevationGain / distanceMeters) * 100
}

// Approximate GAP from activity-level data (no per-point streams)
export function approximateGAP(
  avgPaceSecPerKm: number,
  totalElevationGain: number,
  distanceMeters: number
): number {
  const avgGrade = estimateAverageGrade(totalElevationGain, distanceMeters)
  return calculateGAP(avgPaceSecPerKm, avgGrade)
}
