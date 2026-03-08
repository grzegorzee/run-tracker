import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'

const db = admin.firestore()

// ===== Adaptive Planner — Rolling 7-Day Generation =====
// Generates the next 7 days of workouts based on:
// - Current phase from macroStructure
// - Recent Strava data (last 14 days)
// - ACWR, HR drift, EF trends
// - Missed workouts
// - Pace zone accuracy

const ADAPTIVE_SYSTEM_PROMPT = `You are an expert running coach generating the next 7 days of training.
You receive the runner's macro plan (what phase they're in), recent Strava data, and derived metrics.

ADAPTATION RULES:
1. ACWR > 1.3 → reduce volume 15-20% for next 7 days
2. ACWR < 0.8 → gradually increase (not suddenly!)
3. HR drift > 10% in easy runs → decrease intensity, add rest day
4. HR drift < 3% → great fitness, can push tempo slightly
5. Pace 5%+ faster than target consistently → update pace zones (suggest faster threshold)
6. Pace 5%+ slower consistently → check fatigue/injury, suggest deload
7. 2+ missed workouts last week → reduce to 3 days/week, simplify
8. EF declining 3+ weeks → overtraining risk, force recovery week
9. EF rising steadily → keep course, progressing well

VOLUME RULES:
- Max 10-15% increase per week
- Recovery week every 3-4 build weeks (70% volume)
- 80% easy (Z1-Z2), 20% quality
- Trail: elevation targets from macroStructure

TAPER RULES:
- Follow taper protocol if in taper phase
- Reduce volume but maintain some race-pace work
- Taper shakeout: 2-3km at race pace only

WORKOUT TYPES: easy_run, tempo, intervals, long_run, recovery, hill_repeats, trail_run, vertical_km, downhill_drills, back_to_back, taper_easy, taper_shakeout

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "workouts": [
    {
      "id": "adaptive-YYYY-MM-DD",
      "dayOfWeek": 1,
      "date": "YYYY-MM-DD",
      "type": "easy_run",
      "title": "Easy Run",
      "description": "Comfortable easy pace",
      "distanceKm": 6,
      "targetPace": { "min": 340, "max": 370 },
      "targetHR": { "min": 130, "max": 150 },
      "elevationGain": 50
    }
  ],
  "weekSummary": {
    "totalDistanceKm": 42,
    "totalElevation": 500,
    "weekType": "build",
    "adjustmentReason": "Why adjustments were made"
  },
  "paceZoneUpdate": null,
  "alerts": ["Any warnings or flags for the runner"]
}

Pace values in SECONDS PER KM. Generate workouts in Polish descriptions.`

// Manual trigger — user clicks "Generate next workouts"
export const triggerAdaptivePlanner = onCall(
  { timeoutSeconds: 120, region: 'europe-west1', memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in')

    const userId = (request.data as { userId?: string })?.userId || uid
    return runAdaptivePlanner(userId)
  }
)

// Scheduled — runs every night at 21:00 CET
export const adaptivePlanner = onSchedule(
  {
    schedule: '0 21 * * *',
    timeZone: 'Europe/Warsaw',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    // Process all users with active plans
    const activePlans = await db.collection('training_plans')
      .where('status', '==', 'active')
      .get()

    const results: Array<{ userId: string; ok: boolean; error?: string }> = []

    for (const planDoc of activePlans.docs) {
      const plan = planDoc.data()
      try {
        // Check if generation needed (less than 3 days of workouts ahead)
        const generatedUpTo = new Date(plan.generatedUpTo)
        const now = new Date()
        const daysAhead = Math.floor((generatedUpTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

        if (daysAhead < 3) {
          await runAdaptivePlanner(plan.userId, planDoc.id)
          results.push({ userId: plan.userId, ok: true })
        } else {
          results.push({ userId: plan.userId, ok: true, error: `Still ${daysAhead} days ahead` })
        }
      } catch (err) {
        console.error(`Adaptive planner failed for ${plan.userId}:`, err)
        results.push({ userId: plan.userId, ok: false, error: String(err) })
      }
    }

    console.log('Adaptive planner results:', JSON.stringify(results))
  }
)

async function runAdaptivePlanner(
  userId: string,
  planId?: string
): Promise<{ generated: number; generatedUpTo: string; alerts: string[] }> {
  // Get active plan
  let planDoc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot

  if (planId) {
    planDoc = await db.doc(`training_plans/${planId}`).get()
  } else {
    const planSnapshot = await db.collection('training_plans')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (planSnapshot.empty) {
      throw new HttpsError('not-found', 'No active training plan')
    }
    planDoc = planSnapshot.docs[0]
  }

  const plan = planDoc.data()
  if (!plan) throw new HttpsError('not-found', 'Plan data missing')

  // Determine current phase from macroStructure
  const macroStructure = plan.macroStructure as Array<{
    phase: string
    startWeek: number
    endWeek: number
    weeklyKmTarget: number
    weeklyElevationTarget?: number
  }> || []

  const startDate = new Date(plan.startDate)
  const now = new Date()
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1

  const currentPhaseBlock = macroStructure.find(
    p => currentWeekNumber >= p.startWeek && currentWeekNumber <= p.endWeek
  ) || macroStructure[macroStructure.length - 1]

  // Get recent Strava activities (last 14 days)
  const twoWeeksAgo = new Date()
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
  const cutoffDate = twoWeeksAgo.toISOString().split('T')[0]

  const activitiesSnapshot = await db.collection('strava_activities')
    .where('userId', '==', userId)
    .where('date', '>=', cutoffDate)
    .orderBy('date', 'desc')
    .get()

  const recentActivities = activitiesSnapshot.docs.map(d => d.data())

  // Calculate derived metrics
  const metrics = calculateAdaptationMetrics(recentActivities, plan)

  // Check missed workouts (compare planned vs actual last 7 days)
  const weekActivities = recentActivities.filter(a => {
    const actDate = new Date(a.date)
    const daysAgo = Math.floor((now.getTime() - actDate.getTime()) / (1000 * 60 * 60 * 24))
    return daysAgo <= 7
  })

  const existingWeeks = plan.weeks as Array<{ weekNumber: number; workouts: Array<Record<string, unknown>> }> || []
  const lastWeek = existingWeeks.find(w => w.weekNumber === currentWeekNumber)
  const plannedWorkoutsCount = lastWeek?.workouts?.length || plan.daysPerWeek || 4
  const missedWorkouts = Math.max(0, plannedWorkoutsCount - weekActivities.length)

  // Calculate generation window (next 7 days)
  const generationStartDate = new Date()
  generationStartDate.setDate(generationStartDate.getDate() + 1)
  const generationEndDate = new Date(generationStartDate)
  generationEndDate.setDate(generationEndDate.getDate() + 6)

  // Build prompt
  const userPrompt = buildAdaptivePrompt({
    currentPhase: currentPhaseBlock,
    currentWeekNumber,
    totalWeeks: plan.totalWeeks,
    paceZones: plan.paceZones,
    runnerType: plan.runnerType,
    daysPerWeek: plan.daysPerWeek || 4,
    recentActivities,
    metrics,
    missedWorkouts,
    generationStart: generationStartDate.toISOString().split('T')[0],
    generationEnd: generationEndDate.toISOString().split('T')[0],
    elevationTarget: currentPhaseBlock?.weeklyElevationTarget || plan.elevationTarget,
  })

  let resultJson: string | null = null

  // Try Claude first
  try {
    resultJson = await generateWithClaude(userPrompt)
  } catch (err) {
    console.error('Claude adaptive failed, trying OpenAI:', err)
  }

  // Fallback to OpenAI
  if (!resultJson) {
    try {
      resultJson = await generateWithOpenAI(userPrompt)
    } catch (err) {
      console.error('OpenAI adaptive also failed:', err)
      throw new HttpsError('internal', 'AI adaptive generation failed')
    }
  }

  if (!resultJson) throw new HttpsError('internal', 'No adaptive plan generated')

  let result: {
    workouts: Array<Record<string, unknown>>
    weekSummary: Record<string, unknown>
    paceZoneUpdate: Record<string, unknown> | null
    alerts: string[]
  }

  try {
    result = JSON.parse(resultJson)
  } catch {
    throw new HttpsError('internal', 'Invalid JSON from adaptive AI')
  }

  // Build new week entry
  const newWeekNumber = currentWeekNumber + 1
  const newWeek = {
    weekNumber: newWeekNumber,
    weekType: result.weekSummary?.weekType || 'build',
    phase: currentPhaseBlock?.phase || plan.currentPhase,
    startDate: generationStartDate.toISOString().split('T')[0],
    totalDistanceKm: result.weekSummary?.totalDistanceKm || 0,
    totalElevation: result.weekSummary?.totalElevation || null,
    workouts: result.workouts || [],
  }

  // Update plan — append new week, update generatedUpTo
  const newGeneratedUpTo = generationEndDate.toISOString().split('T')[0]

  // Check if this week already exists (avoid duplicates)
  const updatedWeeks = [...existingWeeks]
  const existingIdx = updatedWeeks.findIndex(w => w.weekNumber === newWeekNumber)
  if (existingIdx >= 0) {
    updatedWeeks[existingIdx] = newWeek as typeof updatedWeeks[0]
  } else {
    updatedWeeks.push(newWeek as typeof updatedWeeks[0])
  }

  const updateData: Record<string, unknown> = {
    weeks: updatedWeeks,
    generatedUpTo: newGeneratedUpTo,
    currentPhase: currentPhaseBlock?.phase || plan.currentPhase,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }

  // Update pace zones if AI suggests it
  if (result.paceZoneUpdate) {
    updateData.paceZones = result.paceZoneUpdate
    updateData.paceZonesUpdatedAt = new Date().toISOString()
  }

  await (planDoc.ref || db.doc(`training_plans/${planDoc.id}`)).update(updateData)

  return {
    generated: result.workouts?.length || 0,
    generatedUpTo: newGeneratedUpTo,
    alerts: result.alerts || [],
  }
}

interface AdaptivePromptInput {
  currentPhase: {
    phase: string
    startWeek: number
    endWeek: number
    weeklyKmTarget: number
    weeklyElevationTarget?: number
  } | undefined
  currentWeekNumber: number
  totalWeeks: number
  paceZones: Record<string, { min: number; max: number }>
  runnerType: string
  daysPerWeek: number
  recentActivities: FirebaseFirestore.DocumentData[]
  metrics: AdaptationMetrics
  missedWorkouts: number
  generationStart: string
  generationEnd: string
  elevationTarget?: number
}

interface AdaptationMetrics {
  acwr: number
  avgHrDrift: number
  avgEF: number
  efTrend: 'rising' | 'stable' | 'declining'
  totalKmLast7Days: number
  totalKmLast14Days: number
  avgPaceEasyRuns: number
  paceVsTargetDiff: number  // % difference
}

function buildAdaptivePrompt(input: AdaptivePromptInput): string {
  const parts: string[] = []

  parts.push('=== CURRENT PLAN CONTEXT ===')
  parts.push(`Week ${input.currentWeekNumber} of ${input.totalWeeks}`)
  if (input.currentPhase) {
    parts.push(`Phase: ${input.currentPhase.phase} (weeks ${input.currentPhase.startWeek}-${input.currentPhase.endWeek})`)
    parts.push(`Weekly km target: ${input.currentPhase.weeklyKmTarget} km`)
    if (input.currentPhase.weeklyElevationTarget) {
      parts.push(`Weekly elevation target: ${input.currentPhase.weeklyElevationTarget}m D+`)
    }
  }
  parts.push(`Runner type: ${input.runnerType}`)
  parts.push(`Available days: ${input.daysPerWeek} per week`)
  parts.push(`Generation period: ${input.generationStart} to ${input.generationEnd}`)

  parts.push('\n=== PACE ZONES (sec/km) ===')
  for (const [zone, range] of Object.entries(input.paceZones)) {
    parts.push(`${zone}: ${formatPace(range.min)}-${formatPace(range.max)}/km`)
  }

  parts.push('\n=== RECENT PERFORMANCE (last 14 days) ===')
  parts.push(`ACWR: ${input.metrics.acwr.toFixed(2)} (safe: 0.8-1.3)`)
  parts.push(`Avg HR drift (easy runs): ${input.metrics.avgHrDrift.toFixed(1)}%`)
  parts.push(`Avg Efficiency Factor: ${input.metrics.avgEF.toFixed(3)}`)
  parts.push(`EF trend: ${input.metrics.efTrend}`)
  parts.push(`Total km (7 days): ${input.metrics.totalKmLast7Days.toFixed(1)} km`)
  parts.push(`Total km (14 days): ${input.metrics.totalKmLast14Days.toFixed(1)} km`)
  parts.push(`Avg easy pace: ${formatPace(input.metrics.avgPaceEasyRuns)}/km`)
  parts.push(`Pace vs target: ${input.metrics.paceVsTargetDiff > 0 ? '+' : ''}${input.metrics.paceVsTargetDiff.toFixed(1)}%`)
  parts.push(`Missed workouts (last 7 days): ${input.missedWorkouts}`)

  if (input.recentActivities.length > 0) {
    parts.push('\n=== RECENT ACTIVITIES ===')
    for (const act of input.recentActivities.slice(0, 10)) {
      const km = (act.distance / 1000).toFixed(1)
      const pace = formatPace(act.avgPace)
      const hr = act.avgHR ? `HR ${act.avgHR}` : ''
      const elev = act.totalElevationGain ? `D+ ${act.totalElevationGain}m` : ''
      parts.push(`${act.date}: ${act.name} — ${km}km, ${pace}/km ${hr} ${elev}`.trim())
    }
  } else {
    parts.push('\n(No recent Strava activities — generate workouts based on macroStructure only)')
  }

  if (input.elevationTarget) {
    parts.push(`\nWeekly elevation target: ${input.elevationTarget}m D+`)
  }

  parts.push('\nGenerate 7 days of workouts. Reply with JSON only.')

  return parts.join('\n')
}

function calculateAdaptationMetrics(
  activities: FirebaseFirestore.DocumentData[],
  plan: FirebaseFirestore.DocumentData
): AdaptationMetrics {
  const now = new Date()

  const last7 = activities.filter(a => {
    const d = new Date(a.date)
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
  })

  const last14 = activities.filter(a => {
    const d = new Date(a.date)
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 14
  })

  const last28 = activities.filter(a => {
    const d = new Date(a.date)
    return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 28
  })

  // ACWR (using distance as proxy if TRIMP not available)
  const acuteLoad = last7.reduce((sum, a) => sum + (a.trimp || a.distance / 100), 0)
  const chronicLoad = last28.reduce((sum, a) => sum + (a.trimp || a.distance / 100), 0) / 4
  const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0

  // HR drift from easy runs
  const easyRuns = last14.filter(a =>
    a.avgHR && (a.sportType === 'Run') && a.aerobicDecoupling !== undefined
  )
  const avgHrDrift = easyRuns.length > 0
    ? easyRuns.reduce((sum, a) => sum + (a.aerobicDecoupling || 0), 0) / easyRuns.length
    : 0

  // Efficiency Factor
  const activitiesWithEF = last14.filter(a => a.efficiencyFactor)
  const avgEF = activitiesWithEF.length > 0
    ? activitiesWithEF.reduce((sum, a) => sum + a.efficiencyFactor, 0) / activitiesWithEF.length
    : 0

  // EF trend (compare last 7 days EF vs previous 7 days)
  const efLast7 = last7.filter(a => a.efficiencyFactor)
  const efPrev7 = last14.filter(a => {
    const d = new Date(a.date)
    const daysAgo = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
    return daysAgo > 7 && daysAgo <= 14 && a.efficiencyFactor
  })

  let efTrend: 'rising' | 'stable' | 'declining' = 'stable'
  if (efLast7.length > 0 && efPrev7.length > 0) {
    const avgRecent = efLast7.reduce((s, a) => s + a.efficiencyFactor, 0) / efLast7.length
    const avgPrev = efPrev7.reduce((s, a) => s + a.efficiencyFactor, 0) / efPrev7.length
    const diff = (avgRecent - avgPrev) / avgPrev
    if (diff > 0.03) efTrend = 'rising'
    else if (diff < -0.03) efTrend = 'declining'
  }

  // Total km
  const totalKmLast7Days = last7.reduce((sum, a) => sum + a.distance / 1000, 0)
  const totalKmLast14Days = last14.reduce((sum, a) => sum + a.distance / 1000, 0)

  // Avg easy pace
  const easyActivities = last14.filter(a => a.avgPace > 0 && !a.matchedWorkoutId?.includes('interval') && !a.matchedWorkoutId?.includes('tempo'))
  const avgPaceEasyRuns = easyActivities.length > 0
    ? easyActivities.reduce((sum, a) => sum + a.avgPace, 0) / easyActivities.length
    : 0

  // Pace vs target
  const paceZones = plan.paceZones as { easy?: { min: number; max: number } } || {}
  const targetEasyPace = paceZones.easy ? (paceZones.easy.min + paceZones.easy.max) / 2 : 0
  const paceVsTargetDiff = targetEasyPace > 0 && avgPaceEasyRuns > 0
    ? ((avgPaceEasyRuns - targetEasyPace) / targetEasyPace) * 100
    : 0

  return {
    acwr,
    avgHrDrift,
    avgEF,
    efTrend,
    totalKmLast7Days,
    totalKmLast14Days,
    avgPaceEasyRuns,
    paceVsTargetDiff,
  }
}

async function generateWithClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const anthropic = new Anthropic({ apiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: ADAPTIVE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in adaptive response')

  return jsonMatch[0]
}

async function generateWithOpenAI(userPrompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const openai = new OpenAI({ apiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    messages: [
      { role: 'system', content: ADAPTIVE_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  })

  return response.choices[0]?.message?.content || ''
}

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return '—'
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}
