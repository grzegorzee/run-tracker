// TRIMP = Training Impulse
// duration (min) × HR_ratio × exp(k × HR_ratio)
export function calculateTRIMP(
  durationMin: number,
  avgHR: number,
  restHR: number,
  maxHR: number,
  gender: 'male' | 'female' = 'male'
): number {
  if (maxHR <= restHR || avgHR <= restHR) return 0
  const hrRatio = (avgHR - restHR) / (maxHR - restHR)
  const k = gender === 'male' ? 1.92 : 1.67
  return durationMin * hrRatio * Math.exp(k * hrRatio)
}

// ACWR = Acute:Chronic Workload Ratio
// acute = sum TRIMP last 7 days
// chronic = avg TRIMP per week over 28 days
export function calculateACWR(
  activities: { trimp: number; date: string }[]
): number {
  const now = new Date()

  const acute = activities
    .filter(a => daysBetween(new Date(a.date), now) <= 7)
    .reduce((sum, a) => sum + a.trimp, 0)

  const chronicTotal = activities
    .filter(a => daysBetween(new Date(a.date), now) <= 28)
    .reduce((sum, a) => sum + a.trimp, 0)

  const chronic = chronicTotal / 4 // average per week

  return chronic > 0 ? acute / chronic : 1.0
}

// Aerobic decoupling (HR drift) — compares 1st half vs 2nd half
// Returns percentage: positive = HR drifting up (fatigue)
export function calculateAerobicDecoupling(
  firstHalfAvgHR: number,
  firstHalfAvgPace: number,
  secondHalfAvgHR: number,
  secondHalfAvgPace: number
): number {
  if (firstHalfAvgHR <= 0 || firstHalfAvgPace <= 0) return 0

  const ef1 = (1000 / firstHalfAvgPace) / firstHalfAvgHR  // speed/HR
  const ef2 = (1000 / secondHalfAvgPace) / secondHalfAvgHR

  return ((ef1 - ef2) / ef1) * 100
}

// Efficiency Factor = speed (km/h) / avgHR
export function calculateEF(speedKmH: number, avgHR: number): number {
  if (avgHR <= 0) return 0
  return speedKmH / avgHR
}

function daysBetween(d1: Date, d2: Date): number {
  return Math.abs(Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)))
}
