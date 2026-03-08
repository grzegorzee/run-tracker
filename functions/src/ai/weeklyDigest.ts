import { onSchedule } from 'firebase-functions/v2/scheduler'
import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'

const db = admin.firestore()

const DIGEST_SYSTEM_PROMPT = `You are an expert running coach creating a weekly training summary.
Analyze the runner's week: what was planned vs what was done, key metrics, and actionable insights.

RULES:
1. Be encouraging but honest
2. If taper week: emphasize that reduced volume is THE PLAN, celebrate rest
3. If recovery week: highlight recovery importance
4. Note any concerning trends (HR drift, missed workouts, overtraining signs)
5. Include specific numbers (km, pace, D+)
6. For trail runners: analyze elevation separately
7. Provide 2-3 specific, actionable suggestions for next week

OUTPUT FORMAT: Return ONLY valid JSON:
{
  "aiInsights": "2-3 paragraph summary in Polish",
  "adaptationSuggestions": ["suggestion 1", "suggestion 2"],
  "weekRating": 4,
  "highlights": ["highlight 1", "highlight 2"]
}`

// Scheduled: Monday 8:00 CET
export const weeklyDigest = onSchedule(
  {
    schedule: '0 8 * * 1',
    timeZone: 'Europe/Warsaw',
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 300,
  },
  async () => {
    const activePlans = await db.collection('training_plans')
      .where('status', '==', 'active')
      .get()

    for (const planDoc of activePlans.docs) {
      try {
        await generateWeeklyDigest(planDoc.data().userId, planDoc.id)
      } catch (err) {
        console.error(`Weekly digest failed for ${planDoc.data().userId}:`, err)
      }
    }
  }
)

// Manual trigger
export const triggerWeeklyDigest = onCall(
  { timeoutSeconds: 60, region: 'europe-west1', memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in')
    const userId = (request.data as { userId?: string })?.userId || uid
    return generateWeeklyDigest(userId)
  }
)

async function generateWeeklyDigest(userId: string, planId?: string) {
  // Get active plan
  let plan: FirebaseFirestore.DocumentData
  let resolvedPlanId: string

  if (planId) {
    const doc = await db.doc(`training_plans/${planId}`).get()
    plan = doc.data()!
    resolvedPlanId = planId
  } else {
    const snap = await db.collection('training_plans')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get()
    if (snap.empty) throw new Error('No active plan')
    plan = snap.docs[0].data()
    resolvedPlanId = snap.docs[0].id
  }

  // Calculate last week number
  const startDate = new Date(plan.startDate)
  const now = new Date()
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
  const currentWeekNumber = Math.floor(daysSinceStart / 7) + 1
  const lastWeekNumber = currentWeekNumber - 1

  if (lastWeekNumber < 1) return { message: 'Too early for digest' }

  // Get last week's planned workouts
  const weeks = plan.weeks as Array<Record<string, unknown>> || []
  const lastWeek = weeks.find(w => (w.weekNumber as number) === lastWeekNumber)

  // Get last week's activities
  const weekStart = new Date(startDate)
  weekStart.setDate(weekStart.getDate() + (lastWeekNumber - 1) * 7)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 7)

  const activitiesSnap = await db.collection('strava_activities')
    .where('userId', '==', userId)
    .where('date', '>=', weekStart.toISOString().split('T')[0])
    .where('date', '<', weekEnd.toISOString().split('T')[0])
    .get()

  const activities = activitiesSnap.docs.map(d => d.data())

  // Build prompt
  const parts: string[] = []
  parts.push(`=== TYDZIEŃ ${lastWeekNumber} ===`)

  if (lastWeek) {
    parts.push(`Phase: ${lastWeek.phase}`)
    parts.push(`Week type: ${lastWeek.weekType}`)
    parts.push(`Planned distance: ${lastWeek.totalDistanceKm} km`)
    parts.push(`Planned workouts: ${(lastWeek.workouts as unknown[])?.length || 0}`)
    if (lastWeek.totalElevation) parts.push(`Planned D+: ${lastWeek.totalElevation}m`)
  }

  const actualDistance = activities.reduce((s, a) => s + (a.distance || 0) / 1000, 0)
  const actualElevation = activities.reduce((s, a) => s + (a.totalElevationGain || 0), 0)
  const avgPace = activities.length > 0
    ? activities.reduce((s, a) => s + (a.avgPace || 0), 0) / activities.length
    : 0

  parts.push(`\nActual workouts: ${activities.length}`)
  parts.push(`Actual distance: ${actualDistance.toFixed(1)} km`)
  parts.push(`Actual D+: ${actualElevation}m`)
  parts.push(`Avg pace: ${formatPace(avgPace)}/km`)

  if (activities.length > 0) {
    parts.push('\nActivities:')
    for (const a of activities) {
      parts.push(`  ${a.date}: ${a.name} — ${(a.distance / 1000).toFixed(1)}km, ${formatPace(a.avgPace)}/km${a.avgHR ? `, HR ${a.avgHR}` : ''}${a.totalElevationGain ? `, D+ ${a.totalElevationGain}m` : ''}`)
    }
  }

  parts.push('\nRunner type: ' + (plan.runnerType || 'road'))
  parts.push('Create weekly digest in Polish.')

  const userPrompt = parts.join('\n')

  // AI generation
  let resultJson: string | null = null
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error('No API key')
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: DIGEST_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })
    const textBlock = response.content.find(b => b.type === 'text')
    if (textBlock?.type === 'text') {
      const match = textBlock.text.match(/\{[\s\S]*\}/)
      if (match) resultJson = match[0]
    }
  } catch (err) {
    console.error('Claude digest failed:', err)
  }

  if (!resultJson) {
    try {
      const { default: OpenAI } = await import('openai')
      const apiKey = process.env.OPENAI_API_KEY
      if (!apiKey) throw new Error('No OpenAI key')
      const openai = new OpenAI({ apiKey })
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 2000,
        messages: [
          { role: 'system', content: DIGEST_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      })
      resultJson = response.choices[0]?.message?.content || null
    } catch (err) {
      console.error('OpenAI digest failed:', err)
    }
  }

  let digestData: Record<string, unknown> = {}
  if (resultJson) {
    try { digestData = JSON.parse(resultJson) } catch {}
  }

  // Save weekly summary
  const summaryRef = db.collection('weekly_summaries').doc(`${userId}_w${lastWeekNumber}`)
  await summaryRef.set({
    userId,
    planId: resolvedPlanId,
    weekNumber: lastWeekNumber,
    weekStartDate: weekStart.toISOString().split('T')[0],
    weekType: lastWeek?.weekType || 'build',
    plannedDistance: lastWeek?.totalDistanceKm || 0,
    plannedWorkouts: (lastWeek?.workouts as unknown[])?.length || 0,
    plannedElevation: lastWeek?.totalElevation || null,
    actualDistance: Math.round(actualDistance * 10) / 10,
    actualWorkouts: activities.length,
    actualElevation,
    avgPace: Math.round(avgPace),
    aiInsights: digestData.aiInsights || null,
    adaptationSuggestions: digestData.adaptationSuggestions || [],
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  })

  return { weekNumber: lastWeekNumber, ...digestData }
}

function formatPace(secPerKm: number): string {
  if (!secPerKm || secPerKm <= 0) return '—'
  const min = Math.floor(secPerKm / 60)
  const sec = Math.round(secPerKm % 60)
  return `${min}:${sec.toString().padStart(2, '0')}`
}
