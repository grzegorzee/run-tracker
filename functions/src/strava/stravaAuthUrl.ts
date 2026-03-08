import { onCall, HttpsError } from 'firebase-functions/v2/https'

function getStravaConfig() {
  const clientId = process.env.STRAVA_CLIENT_ID
  const redirectUri = process.env.STRAVA_REDIRECT_URI || 'https://grzegorzee.github.io/run-tracker/strava-callback.html'
  if (!clientId) throw new Error('STRAVA_CLIENT_ID not set')
  return { clientId, redirectUri }
}

export const stravaAuthUrl = onCall(
  { region: 'europe-west1' },
  async (request) => {
    // Accept userId from request.data (like strength_save) — no auth required for URL generation
    const userId = (request.data as { userId?: string })?.userId || request.auth?.uid
    if (!userId) throw new HttpsError('unauthenticated', 'Must be logged in')

    const { clientId, redirectUri } = getStravaConfig()
    const scope = 'read,activity:read_all'

    const url = `https://www.strava.com/oauth/authorize` +
      `?client_id=${clientId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=${scope}` +
      `&approval_prompt=force` +
      `&state=${userId}`

    return { url }
  }
)
