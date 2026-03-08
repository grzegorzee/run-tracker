import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'

const db = admin.firestore()

interface AnalyzeInput {
  activityId: string
  userId: string
}

const ANALYSIS_SYSTEM_PROMPT = `You are an expert running coach analyzing a completed workout.
Compare the planned workout with actual execution from Strava data.

ANALYSIS RULES:
1. Rate 1-5: 5=EXCELLENT (nailed every metric), 4=GOOD (minor deviations), 3=OK (completed but off targets), 2=BELOW_TARGET (significant misses), 1=MISSED (wrong workout entirely)
2. For trail runs: prioritize GAP (Grade-Adjusted Pace) over GPS pace, and effort (HR/RPE) over speed
3. Cadence check: 170-180 SPM is optimal for most runners
4. If this is a taper week: reduced volume is THE PLAN, not a failure
5. Elevation analysis for trail: compare planned D+ vs actual D+, note terrain difficulty
6. HR drift >10% in easy runs = fatigue signal worth noting
7. Be encouraging but honest. Specific, actionable suggestions.

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "rating": 4,
  "ratingLabel": "GOOD",
  "summary": "1-2 sentence summary of performance",
  "highlights": ["highlight 1", "highlight 2"],
  "suggestions": ["suggestion 1"],
  "elevationAnalysis": "Optional trail elevation analysis"
}`

export const analyzeWorkout = onCall(
  { timeoutSeconds: 60, region: 'europe-west1', memory: '256MiB' },
  async (request) => {
    const { activityId, userId } = request.data as AnalyzeInput

    if (!activityId || !userId) {
      throw new HttpsError('invalid-argument', 'Missing activityId or userId')
    }

    // Get the activity
    const activityDoc = await db.doc(`strava_activities/${activityId}`).get()
    if (!activityDoc.exists) {
      throw new HttpsError('not-found', 'Activity not found')
    }

    const activity = activityDoc.data()!
    if (activity.userId !== userId) {
      throw new HttpsError('permission-denied', 'Not your activity')
    }

    // Already analyzed?
    if (activity.aiSummary) {
      return { summary: activity.aiSummary, cached: true }
    }

    // Get matched planned workout if exists
    let plannedWorkout: Record<string, unknown> | null = null
    let weekContext: Record<string, unknown> | null = null

    if (activity.matchedWorkoutId) {
      const planSnapshot = await db.collection('training_plans')
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get()

      if (!planSnapshot.empty) {
        const plan = planSnapshot.docs[0].data()
        const weeks = plan.weeks as Array<Record<string, unknown>> || []

        for (const week of weeks) {
          const workouts = week.workouts as Array<Record<string, unknown>> || []
          const match = workouts.find(w => w.id === activity.matchedWorkoutId)
          if (match) {
            plannedWorkout = match
            weekContext = {
              weekNumber: week.weekNumber,
              weekType: week.weekType,
              phase: week.phase,
            }
            break
          }
        }
      }
    }

    // Build analysis prompt
    const userPrompt = buildAnalysisPrompt(activity, plannedWorkout, weekContext)

    let analysisJson: string | null = null

    // Try Claude first
    try {
      analysisJson = await analyzeWithClaude(userPrompt)
    } catch (err) {
      console.error('Claude analysis failed, trying OpenAI:', err)
    }

    // Fallback to OpenAI
    if (!analysisJson) {
      try {
        analysisJson = await analyzeWithOpenAI(userPrompt)
      } catch (err) {
        console.error('OpenAI analysis also failed:', err)
        throw new HttpsError('internal', 'AI analysis failed')
      }
    }

    if (!analysisJson) throw new HttpsError('internal', 'No analysis generated')

    let summary: Record<string, unknown>
    try {
      summary = JSON.parse(analysisJson)
    } catch {
      throw new HttpsError('internal', 'Invalid JSON from AI analysis')
    }

    // Save to activity
    await activityDoc.ref.update({ aiSummary: summary })

    return { summary, cached: false }
  }
)

function buildAnalysisPrompt(
  activity: FirebaseFirestore.DocumentData,
  planned: Record<string, unknown> | null,
  weekContext: Record<string, unknown> | null
): string {
  const parts: string[] = []

  parts.push('=== ACTUAL ACTIVITY (from Strava) ===')
  parts.push(`Name: ${activity.name}`)
  parts.push(`Type: ${activity.sportType}`)
  parts.push(`Date: ${activity.date}`)
  parts.push(`Distance: ${(activity.distance / 1000).toFixed(2)} km`)
  parts.push(`Moving time: ${Math.round(activity.movingTime / 60)} min`)
  parts.push(`Avg pace: ${formatPaceSec(activity.avgPace)}/km`)

  if (activity.gradeAdjustedPace) {
    parts.push(`GAP (Grade-Adjusted Pace): ${formatPaceSec(activity.gradeAdjustedPace)}/km`)
  }
  if (activity.avgHR) parts.push(`Avg HR: ${activity.avgHR} bpm`)
  if (activity.maxHR) parts.push(`Max HR: ${activity.maxHR} bpm`)
  if (activity.avgCadence) parts.push(`Avg cadence: ${activity.avgCadence} SPM`)
  if (activity.totalElevationGain) parts.push(`Elevation gain: ${activity.totalElevationGain}m`)
  if (activity.elevHigh) parts.push(`Highest point: ${activity.elevHigh}m`)
  if (activity.perceivedExertion) parts.push(`RPE: ${activity.perceivedExertion}/10`)
  if (activity.prCount && activity.prCount > 0) parts.push(`Personal records: ${activity.prCount}`)

  if (activity.bestEfforts) {
    parts.push('\nBest efforts:')
    for (const [dist, time] of Object.entries(activity.bestEfforts)) {
      parts.push(`  ${dist}: ${formatTimeSec(time as number)}`)
    }
  }

  if (activity.splits && activity.splits.length > 0) {
    parts.push('\nSplits per km:')
    for (const split of activity.splits.slice(0, 15)) {
      parts.push(`  km ${split.km}: ${formatPaceSec(split.pace)}/km, elev diff ${split.elevDiff}m`)
    }
  }

  if (planned) {
    parts.push('\n=== PLANNED WORKOUT ===')
    parts.push(`Type: ${planned.type}`)
    parts.push(`Title: ${planned.title}`)
    parts.push(`Description: ${planned.description}`)
    parts.push(`Planned distance: ${planned.distanceKm} km`)
    if (planned.targetPace) {
      const tp = planned.targetPace as { min: number; max: number }
      parts.push(`Target pace: ${formatPaceSec(tp.min)}-${formatPaceSec(tp.max)}/km`)
    }
    if (planned.targetHR) {
      const hr = planned.targetHR as { min: number; max: number }
      parts.push(`Target HR: ${hr.min}-${hr.max} bpm`)
    }
    if (planned.elevationGain) parts.push(`Target D+: ${planned.elevationGain}m`)
    if (planned.intervals) {
      const iv = planned.intervals as Record<string, unknown>
      parts.push(`Intervals: ${iv.repeats}x ${iv.workDistance || iv.workDuration}`)
    }
  } else {
    parts.push('\n(No matched planned workout — this was an extra/unplanned activity)')
  }

  if (weekContext) {
    parts.push(`\nWeek ${weekContext.weekNumber}, Phase: ${weekContext.phase}, Week type: ${weekContext.weekType}`)
    if (weekContext.weekType === 'taper') {
      parts.push('⚠️ THIS IS A TAPER WEEK — reduced volume is intentional and good!')
    }
    if (weekContext.weekType === 'recovery') {
      parts.push('⚠️ THIS IS A RECOVERY WEEK — easy effort is the goal!')
    }
  }

  parts.push('\nAnalyze this workout. Be specific, use numbers. Reply in Polish.')

  return parts.join('\n')
}

async function analyzeWithClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const anthropic = new Anthropic({ apiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2000,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in analysis response')

  return jsonMatch[0]
}

async function analyzeWithOpenAI(userPrompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const openai = new OpenAI({ apiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 2000,
    messages: [
      { role: 'system', content: ANALYSIS_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  })

  return response.choices[0]?.message?.content || ''
}

function formatPaceSec(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return '—'
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}

function formatTimeSec(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = Math.round(totalSeconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
