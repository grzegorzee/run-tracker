import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'
import Anthropic from '@anthropic-ai/sdk'

const db = admin.firestore()

interface OnboardingInput {
  runnerType: string
  goalType: string
  level: string
  weeklyDistance: string
  comfortPace?: string
  raceTime?: string
  raceDistance?: string
  daysPerWeek: number
  terrainAccess?: string
  targetElevation?: number
  hillExperience?: string
  injuries?: string
  goalDate?: string
}

const SYSTEM_PROMPT = `You are an expert running coach creating personalized training plans.

RULES:
1. Max weekly volume increase: 10-15% (the 10% rule)
2. 80/20 principle: 80% easy running (Z1-Z2), 20% quality (tempo, intervals, hills)
3. Recovery week every 3-4 weeks (reduce to 70% volume)
4. Tapering before race: reduce volume progressively while maintaining some intensity
5. Trail runs use effort (HR/RPE), not GPS pace
6. Power hiking on grades >15-20% is more efficient than running
7. Grade-Adjusted Pace (GAP) for trail zone definition
8. Back-to-back long runs only from build phase onwards
9. Never long run >38km for marathon, >24km for half marathon
10. Realistic timeframes: marathon prep minimum 16 weeks, half minimum 12 weeks

TAPERING PROTOCOLS:
- 5K: 1 week (65% volume)
- 10K: 2 weeks (70% → 55%)
- Half Marathon: 2 weeks (70% → 45%)
- Marathon: 3 weeks (80% → 60% → 45%)
- Ultra 50K: 3 weeks (75% → 55% → 35%)
- Trail Race: 2 weeks (70% → 45%, reduce D+ 50-60%)

VOLUME LIMITS:
- HM Beginner: Peak 35-45 km/wk, long run max 18km
- HM Intermediate: Peak 45-60 km/wk, long run max 21km
- HM Advanced: Peak 60-80 km/wk, long run max 24km
- Marathon Beginner: Peak 45-55 km/wk, long run max 30km
- Marathon Intermediate: Peak 55-80 km/wk, long run max 34km
- Marathon Advanced: Peak 80-145 km/wk, long run max 38km
- Trail: Peak elevation/week = 60-80% of race D+

OUTPUT FORMAT: Return ONLY valid JSON with this structure:
{
  "macroStructure": [
    { "phase": "base|build|peak|taper|race", "startWeek": 1, "endWeek": 4, "weeklyKmTarget": 30, "weeklyElevationTarget": 500, "description": "..." }
  ],
  "weeks": [
    {
      "weekNumber": 1,
      "weekType": "build|recovery|taper|race",
      "phase": "base",
      "totalDistanceKm": 30,
      "totalElevation": 200,
      "workouts": [
        {
          "id": "w1-1",
          "dayOfWeek": 1,
          "type": "easy_run|tempo|intervals|long_run|recovery|hill_repeats|trail_run|taper_easy|taper_shakeout",
          "title": "Easy Run",
          "description": "Comfortable easy pace",
          "distanceKm": 6,
          "targetPace": { "min": 340, "max": 370 },
          "elevationGain": 50
        }
      ]
    }
  ],
  "paceZones": {
    "easy": { "min": 340, "max": 380 },
    "tempo": { "min": 290, "max": 310 },
    "interval": { "min": 260, "max": 280 },
    "race": { "min": 285, "max": 300 }
  },
  "totalWeeks": 16,
  "taperWeeks": 3,
  "elevationTarget": 800
}

Pace values are in SECONDS PER KM.
Generate macroStructure for ALL weeks, but only generate detailed workouts for the FIRST 2 WEEKS.
The rest will be generated adaptively based on Strava data.`

export const generatePlan = onCall(
  { timeoutSeconds: 120, region: 'europe-west1', memory: '512MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in')

    const input = request.data as OnboardingInput
    if (!input.goalType || !input.runnerType) {
      throw new HttpsError('invalid-argument', 'Missing required fields')
    }

    const userPrompt = buildUserPrompt(input)

    let planJson: string | null = null

    // Try Claude first
    try {
      planJson = await generateWithClaude(userPrompt)
    } catch (err) {
      console.error('Claude failed, trying OpenAI fallback:', err)
    }

    // Fallback to OpenAI
    if (!planJson) {
      try {
        planJson = await generateWithOpenAI(userPrompt)
      } catch (err) {
        console.error('OpenAI also failed:', err)
        throw new HttpsError('internal', 'AI generation failed')
      }
    }

    if (!planJson) throw new HttpsError('internal', 'No plan generated')

    // Parse and validate
    let plan: Record<string, unknown>
    try {
      plan = JSON.parse(planJson)
    } catch {
      throw new HttpsError('internal', 'Invalid JSON from AI')
    }

    // Save to Firestore
    const now = new Date().toISOString()
    const startDate = now.split('T')[0]

    const totalWeeks = (plan.totalWeeks as number) || 16
    const endDate = new Date(Date.now() + totalWeeks * 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const weeks = plan.weeks as Array<Record<string, unknown>>
    const lastWeek = weeks[weeks.length - 1]
    const generatedUpTo = lastWeek
      ? calculateWeekEndDate(startDate, (lastWeek.weekNumber as number) || 2)
      : startDate

    const planDoc = {
      userId: uid,
      goalType: input.goalType,
      goalDate: input.goalDate || null,
      targetRaceDistance: input.goalType,
      runnerType: input.runnerType,
      totalWeeks,
      startDate,
      endDate,
      currentPhase: 'base',
      taperWeeks: (plan.taperWeeks as number) || 2,
      macroStructure: plan.macroStructure || [],
      generatedUpTo,
      weeks: plan.weeks || [],
      paceZones: plan.paceZones || {},
      paceZonesUpdatedAt: now,
      elevationTarget: (plan.elevationTarget as number) || null,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    const ref = await db.collection('training_plans').add(planDoc)

    return { planId: ref.id, totalWeeks, generatedUpTo }
  }
)

function buildUserPrompt(input: OnboardingInput): string {
  const parts = [
    `Runner type: ${input.runnerType}`,
    `Goal: ${input.goalType}`,
    `Level: ${input.level}`,
    `Weekly distance: ${input.weeklyDistance} km`,
    `Days per week: ${input.daysPerWeek}`,
  ]

  if (input.comfortPace) parts.push(`Comfort pace: ${input.comfortPace}/km`)
  if (input.raceTime && input.raceDistance) parts.push(`Recent race: ${input.raceDistance} in ${input.raceTime}`)
  if (input.terrainAccess) parts.push(`Mountain access: ${input.terrainAccess}`)
  if (input.targetElevation) parts.push(`Target race D+: ${input.targetElevation}m`)
  if (input.hillExperience) parts.push(`Hill experience: ${input.hillExperience}`)
  if (input.injuries) parts.push(`Injuries/limitations: ${input.injuries}`)
  if (input.goalDate) parts.push(`Target date: ${input.goalDate}`)

  return `Create a personalized running training plan for this runner:\n\n${parts.join('\n')}\n\nToday's date: ${new Date().toISOString().split('T')[0]}`
}

async function generateWithClaude(userPrompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set')

  const anthropic = new Anthropic({ apiKey })

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in response')

  // Extract JSON from response
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')

  return jsonMatch[0]
}

async function generateWithOpenAI(userPrompt: string): Promise<string> {
  const { default: OpenAI } = await import('openai')
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY not set')

  const openai = new OpenAI({ apiKey })

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 8000,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
  })

  return response.choices[0]?.message?.content || ''
}

function calculateWeekEndDate(startDate: string, weekNumber: number): string {
  const start = new Date(startDate)
  start.setDate(start.getDate() + (weekNumber * 7) - 1)
  return start.toISOString().split('T')[0]
}
