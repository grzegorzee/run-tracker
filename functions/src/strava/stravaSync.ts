import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import * as admin from 'firebase-admin'
import { refreshStravaToken, syncUserActivities } from './stravaCallback'

const db = admin.firestore()

// Manual sync trigger (frontend button)
export const stravaSync = onCall(
  { region: 'europe-west1', timeoutSeconds: 60 },
  async (request) => {
    const userId = (request.data as { userId?: string })?.userId || request.auth?.uid
    if (!userId) throw new HttpsError('unauthenticated', 'Must be logged in')

    const userDoc = await db.doc(`users/${userId}`).get()
    const userData = userDoc.data()

    if (!userData?.stravaConnected || !userData?.stravaTokens) {
      throw new HttpsError('failed-precondition', 'Strava not connected')
    }

    let accessToken = userData.stravaTokens.accessToken
    const now = Math.floor(Date.now() / 1000)

    // Refresh token if expired
    if (userData.stravaTokens.expiresAt <= now) {
      accessToken = await refreshStravaToken(userId, userData.stravaTokens.refreshToken)
    }

    const result = await syncUserActivities(userId, accessToken)
    return { success: true, ...result }
  }
)

// Scheduled sync — every 6 hours for all connected users
export const scheduledStravaSync = onSchedule(
  { schedule: 'every 6 hours', region: 'europe-west1', timeoutSeconds: 300 },
  async () => {
    const usersSnapshot = await db.collection('users')
      .where('stravaConnected', '==', true)
      .get()

    const results = await Promise.allSettled(
      usersSnapshot.docs.map(async (userDoc) => {
        const userData = userDoc.data()
        if (!userData.stravaTokens) return

        let accessToken = userData.stravaTokens.accessToken
        const now = Math.floor(Date.now() / 1000)

        if (userData.stravaTokens.expiresAt <= now) {
          accessToken = await refreshStravaToken(userDoc.id, userData.stravaTokens.refreshToken)
        }

        return syncUserActivities(userDoc.id, accessToken)
      })
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length
    console.log(`Scheduled Strava sync: ${succeeded} succeeded, ${failed} failed`)
  }
)
