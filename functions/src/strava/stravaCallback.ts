import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

const db = admin.firestore()

function getStravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const clientSecret = process.env.STRAVA_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Strava credentials not configured')
  return { clientId, clientSecret }
}

interface StravaTokenResponse {
  access_token: string
  refresh_token: string
  expires_at: number
  athlete: {
    id: number
    firstname: string
    lastname: string
  }
}

export const stravaCallback = onCall(
  { region: 'europe-west1', timeoutSeconds: 120 },
  async (request) => {
    const { code, userId } = request.data as { code: string; userId: string }

    if (!code) throw new HttpsError('invalid-argument', 'Missing authorization code')
    if (!userId) throw new HttpsError('invalid-argument', 'Missing userId')

    const { clientId, clientSecret } = getStravaConfig()

    // Exchange code for tokens
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Strava token exchange failed:', errorText)
      throw new HttpsError('internal', 'Strava token exchange failed')
    }

    const data = (await response.json()) as StravaTokenResponse
    const athleteName = `${data.athlete.firstname} ${data.athlete.lastname}`

    // Clean reconnect: delete old activities
    const existingActivities = await db.collection('strava_activities')
      .where('userId', '==', userId)
      .get()

    if (!existingActivities.empty) {
      const deleteBatch = db.batch()
      existingActivities.docs.forEach((d) => deleteBatch.delete(d.ref))
      await deleteBatch.commit()
      console.log(`Deleted ${existingActivities.size} old activities for clean reconnect`)
    }

    // Save tokens + null lastSync for full lookback
    await db.doc(`users/${userId}`).update({
      stravaConnected: true,
      stravaTokens: {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: data.expires_at,
      },
      stravaAthleteId: String(data.athlete.id),
      stravaAthleteName: athleteName,
      stravaLastSync: null, // Force full lookback on new connection
    })

    // Auto-sync activities
    const syncResult = await syncUserActivities(userId, data.access_token)

    return {
      success: true,
      athleteName,
      synced: syncResult.synced,
      totalFetched: syncResult.totalFetched,
    }
  }
)

// Helper to refresh token if expired
export async function refreshStravaToken(userId: string, refreshToken: string): Promise<string> {
  const { clientId, clientSecret } = getStravaConfig()

  const response = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    throw new Error('Strava token refresh failed')
  }

  const data = (await response.json()) as {
    access_token: string
    refresh_token: string
    expires_at: number
  }

  await db.doc(`users/${userId}`).update({
    'stravaTokens.accessToken': data.access_token,
    'stravaTokens.refreshToken': data.refresh_token,
    'stravaTokens.expiresAt': data.expires_at,
  })

  return data.access_token
}

// Shared sync function — used by both callback (initial) and manual sync
export async function syncUserActivities(
  userId: string,
  accessToken: string
): Promise<{ synced: number; totalFetched: number; alreadyExisted: number; lookbackDays: number }> {
  const userDoc = await db.doc(`users/${userId}`).get()
  const userData = userDoc.data()
  const lastSync = userData?.stravaLastSync

  const now = Math.floor(Date.now() / 1000)

  // Lookback logic (from strength_save):
  // - No lastSync: full 365-day lookback
  // - Has lastSync: use max(lastSync, now - 7 days) — enforces 7-day minimum
  const afterFromLastSync = lastSync
    ? Math.floor(new Date(lastSync).getTime() / 1000)
    : now - 365 * 24 * 60 * 60

  const minLookback = now - 7 * 24 * 60 * 60 // 7-day minimum
  const after = Math.min(afterFromLastSync, minLookback)
  const lookbackDays = Math.round((now - after) / (24 * 60 * 60))

  // Fetch from Strava API
  const response = await fetch(
    `https://www.strava.com/api/v3/athlete/activities?after=${after}&per_page=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error(`Strava API error: ${response.status}`)
  }

  const activities = (await response.json()) as StravaApiActivity[]

  // Filter running activities only
  const runActivities = activities.filter(a =>
    ['Run', 'TrailRun', 'VirtualRun'].includes(a.sport_type)
  )

  let synced = 0
  let alreadyExisted = 0

  if (runActivities.length > 0) {
    // Get active training plan for matching
    const planSnapshot = await db.collection('training_plans')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    const plan = planSnapshot.empty ? null : planSnapshot.docs[0].data()

    const batch = db.batch()

    for (const activity of runActivities) {
      // Deduplication check
      const existing = await db.collection('strava_activities')
        .where('stravaId', '==', activity.id)
        .where('userId', '==', userId)
        .limit(1)
        .get()

      if (!existing.empty) {
        alreadyExisted++
        continue
      }

      const avgPace = activity.distance > 0
        ? (activity.moving_time / activity.distance) * 1000
        : 0

      const gradeAdjustedPace = calculateApproxGAP(
        avgPace,
        activity.total_elevation_gain || 0,
        activity.distance
      )

      // Parse best efforts
      const bestEfforts: Record<string, number> = {}
      if (activity.best_efforts) {
        for (const effort of activity.best_efforts) {
          const key = mapBestEffortName(effort.name)
          if (key) bestEfforts[key] = effort.elapsed_time
        }
      }

      // Parse splits
      const splits = activity.splits_metric?.map(s => ({
        km: s.split,
        pace: s.average_speed > 0 ? 1000 / s.average_speed : 0,
        elevDiff: s.elevation_difference,
        paceZone: s.pace_zone,
      }))

      // Try to match to training plan
      let matchedWorkoutId: string | null = null
      let matchedWeekNumber: number | null = null

      if (plan) {
        const match = matchActivityToPlan(activity, plan)
        if (match) {
          matchedWorkoutId = match.workoutId
          matchedWeekNumber = match.weekNumber
        }
      }

      const ref = db.collection('strava_activities').doc(`strava_${activity.id}`)
      batch.set(ref, {
        userId,
        stravaId: activity.id,
        name: activity.name,
        date: activity.start_date_local.split('T')[0],
        sportType: activity.sport_type,
        distance: activity.distance,
        movingTime: activity.moving_time,
        elapsedTime: activity.elapsed_time,
        avgSpeed: activity.average_speed,
        maxSpeed: activity.max_speed,
        avgPace,
        avgHR: activity.average_heartrate || null,
        maxHR: activity.max_heartrate || null,
        avgCadence: activity.average_cadence ? activity.average_cadence * 2 : null,
        calories: activity.calories || null,
        totalElevationGain: activity.total_elevation_gain || null,
        elevHigh: activity.elev_high || null,
        elevLow: activity.elev_low || null,
        avgTemp: activity.average_temp || null,
        perceivedExertion: activity.perceived_exertion || null,
        workoutType: activity.workout_type || null,
        deviceName: activity.device_name || null,
        prCount: activity.pr_count || 0,
        bestEfforts: Object.keys(bestEfforts).length > 0 ? bestEfforts : null,
        splits: splits || null,
        gradeAdjustedPace: gradeAdjustedPace || null,
        matchedWorkoutId,
        matchedWeekNumber,
        stravaUrl: `https://www.strava.com/activities/${activity.id}`,
        syncedAt: new Date().toISOString(),
      })

      synced++
    }

    if (synced > 0) {
      await batch.commit()
    }
  }

  // Update last sync timestamp
  await db.doc(`users/${userId}`).update({
    stravaLastSync: new Date().toISOString(),
  })

  return { synced, totalFetched: activities.length, alreadyExisted, lookbackDays }
}

// ===== Helpers =====

interface StravaApiActivity {
  id: number
  name: string
  sport_type: string
  start_date_local: string
  distance: number
  moving_time: number
  elapsed_time: number
  average_speed: number
  max_speed: number
  average_heartrate?: number
  max_heartrate?: number
  average_cadence?: number
  calories?: number
  total_elevation_gain?: number
  elev_high?: number
  elev_low?: number
  average_temp?: number
  perceived_exertion?: number
  workout_type?: number
  device_name?: string
  pr_count?: number
  best_efforts?: Array<{ name: string; elapsed_time: number }>
  splits_metric?: Array<{
    split: number
    average_speed: number
    elevation_difference: number
    pace_zone: number
  }>
}

function matchActivityToPlan(
  activity: StravaApiActivity,
  plan: FirebaseFirestore.DocumentData
): { workoutId: string; weekNumber: number } | null {
  const activityDate = new Date(activity.start_date_local)
  const activityDayOfWeek = activityDate.getDay() === 0 ? 7 : activityDate.getDay()
  const activityDistanceKm = activity.distance / 1000

  const weeks = plan.weeks as Array<{
    weekNumber: number
    startDate: string
    workouts: Array<{
      id: string
      dayOfWeek: number
      distanceKm: number
      elevationGain?: number
    }>
  }>

  if (!weeks) return null

  for (const week of weeks) {
    const weekStart = new Date(week.startDate)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)

    if (activityDate < weekStart || activityDate >= weekEnd) continue

    for (const workout of week.workouts) {
      if (workout.dayOfWeek !== activityDayOfWeek) continue
      const distanceDiff = Math.abs(activityDistanceKm - workout.distanceKm) / workout.distanceKm
      if (distanceDiff > 0.30) continue

      if (workout.elevationGain && activity.total_elevation_gain) {
        const elevDiff = Math.abs(activity.total_elevation_gain - workout.elevationGain) / workout.elevationGain
        if (elevDiff > 0.40) continue
      }

      return { workoutId: workout.id, weekNumber: week.weekNumber }
    }
  }

  return null
}

function calculateApproxGAP(
  avgPaceSecPerKm: number,
  totalElevationGain: number,
  distanceMeters: number
): number | null {
  if (distanceMeters <= 0 || avgPaceSecPerKm <= 0) return null
  if (!totalElevationGain || totalElevationGain < 10) return null
  const avgGradePercent = (totalElevationGain / distanceMeters) * 100
  const factor = 1 + avgGradePercent * 0.033
  return avgPaceSecPerKm / factor
}

function mapBestEffortName(name: string): string | null {
  const map: Record<string, string> = {
    '400m': '400m', '1k': '1k', '1 mile': '1mile',
    '5k': '5k', '10k': '10k', 'Half-Marathon': 'half', 'Marathon': 'marathon',
  }
  return map[name] || null
}
