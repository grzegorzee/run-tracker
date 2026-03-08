export interface TaperProtocol {
  taperWeeks: number
  volumeReduction: number[]     // per week, fraction of peak volume
  keepIntensity: boolean
  notes: string
}

export const TAPER_PROTOCOLS: Record<string, TaperProtocol> = {
  '5k': {
    taperWeeks: 1,
    volumeReduction: [0.65],
    keepIntensity: true,
    notes: 'Utrzymaj 1-2 krótkie odcinki w race pace',
  },
  '10k': {
    taperWeeks: 2,
    volumeReduction: [0.70, 0.55],
    keepIntensity: true,
    notes: 'Tydzień -2: tempo workout. Tydzień -1: tylko shakeout',
  },
  half_marathon: {
    taperWeeks: 2,
    volumeReduction: [0.70, 0.45],
    keepIntensity: true,
    notes: 'Ostatni długi bieg: 60% normalnego. Race week: 3 easy + shakeout',
  },
  marathon: {
    taperWeeks: 3,
    volumeReduction: [0.80, 0.60, 0.45],
    keepIntensity: true,
    notes: 'Wk-3: pełne jakościowe. Wk-2: 1 tempo. Wk-1: easy + 3km race pace shakeout',
  },
  ultra_50k: {
    taperWeeks: 3,
    volumeReduction: [0.75, 0.55, 0.35],
    keepIntensity: false,
    notes: 'Ostatnie 2 tygodnie: zero intensywności, tylko easy + spacer',
  },
  trail_race: {
    taperWeeks: 2,
    volumeReduction: [0.70, 0.45],
    keepIntensity: false,
    notes: 'Zredukuj elevation gain o 50-60%. Flat easy runs w race week',
  },
} as const

export function getTaperProtocol(goalType: string): TaperProtocol {
  if (goalType.includes('5k') && !goalType.includes('50k')) return TAPER_PROTOCOLS['5k']
  if (goalType.includes('10k')) return TAPER_PROTOCOLS['10k']
  if (goalType.includes('half')) return TAPER_PROTOCOLS['half_marathon']
  if (goalType.includes('marathon') && !goalType.includes('half')) return TAPER_PROTOCOLS['marathon']
  if (goalType.includes('ultra')) return TAPER_PROTOCOLS['ultra_50k']
  if (goalType.includes('trail')) return TAPER_PROTOCOLS['trail_race']
  return TAPER_PROTOCOLS['half_marathon'] // default
}
