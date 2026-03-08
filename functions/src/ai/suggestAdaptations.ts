import { onCall, HttpsError } from 'firebase-functions/v2/https'
import * as admin from 'firebase-admin'

const db = admin.firestore()

// Monthly adaptation analysis — analyzes 4-week trends and suggests plan changes
// This complements the rolling 7-day adaptivePlanner with longer-term insights

export const suggestAdaptations = onCall(
  { timeoutSeconds: 60, region: 'europe-west1', memory: '256MiB' },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Must be logged in')

    const userId = (request.data as { userId?: string })?.userId || uid

    // Get active plan
    const planSnap = await db.collection('training_plans')
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get()

    if (planSnap.empty) {
      throw new HttpsError('not-found', 'No active training plan')
    }

    const plan = planSnap.docs[0].data()
    const planRef = planSnap.docs[0].ref

    // Get last 28 days of activities
    const fourWeeksAgo = new Date()
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    const cutoff = fourWeeksAgo.toISOString().split('T')[0]

    const activitiesSnap = await db.collection('strava_activities')
      .where('userId', '==', userId)
      .where('date', '>=', cutoff)
      .orderBy('date', 'desc')
      .get()

    const activities = activitiesSnap.docs.map(d => d.data())

    if (activities.length < 4) {
      return { suggestions: [], message: 'Za mało danych (minimum 4 aktywności z ostatnich 28 dni)' }
    }

    // ===== Analyze pace trends =====
    const paceZones = plan.paceZones as { easy?: { min: number; max: number }; tempo?: { min: number; max: number } } || {}
    const easyActivities = activities.filter(a => a.avgPace > 0)

    let paceZoneUpdate: Record<string, { min: number; max: number }> | null = null
    const suggestions: string[] = []
    const alerts: string[] = []

    if (easyActivities.length >= 4 && paceZones.easy) {
      const avgPace = easyActivities.reduce((s, a) => s + a.avgPace, 0) / easyActivities.length
      const targetMid = (paceZones.easy.min + paceZones.easy.max) / 2
      const diff = ((avgPace - targetMid) / targetMid) * 100

      if (diff < -5) {
        // Consistently faster → suggest pace zone update
        const newThreshold = Math.round(avgPace / 1.25) // reverse easy zone calc
        paceZoneUpdate = {
          easy: { min: Math.round(newThreshold * 1.25), max: Math.round(newThreshold * 1.40) },
          tempo: { min: Math.round(newThreshold * 0.97), max: Math.round(newThreshold * 1.03) },
          interval: { min: Math.round(newThreshold * 0.85), max: Math.round(newThreshold * 0.92) },
          race: { min: Math.round(newThreshold * 0.95), max: Math.round(newThreshold * 1.00) },
        }
        suggestions.push('Twoje tempo jest konsekwentnie szybsze niż strefy — aktualizacja stref tempa zalecana')
      } else if (diff > 5) {
        suggestions.push('Twoje tempo jest wolniejsze niż strefy — sprawdź zmęczenie, rozważ deload')
      }
    }

    // ===== Analyze ACWR =====
    const now = new Date()
    const last7 = activities.filter(a => {
      const d = new Date(a.date)
      return (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24) <= 7
    })
    const last28 = activities

    const acuteLoad = last7.reduce((s, a) => s + (a.trimp || a.distance / 100), 0)
    const chronicLoad = last28.reduce((s, a) => s + (a.trimp || a.distance / 100), 0) / 4
    const acwr = chronicLoad > 0 ? acuteLoad / chronicLoad : 1.0

    if (acwr > 1.3) {
      alerts.push(`ACWR = ${acwr.toFixed(2)} (> 1.3) — ryzyko kontuzji! Zalecana redukcja objętości.`)
      suggestions.push('Zmniejsz objętość o 15-20% w następnym tygodniu')
    } else if (acwr < 0.8) {
      suggestions.push(`ACWR = ${acwr.toFixed(2)} (< 0.8) — za mały trening. Stopniowo zwiększaj objętość.`)
    }

    // ===== Analyze EF trend =====
    const activitiesWithEF = activities.filter(a => a.efficiencyFactor)
    if (activitiesWithEF.length >= 6) {
      const half = Math.floor(activitiesWithEF.length / 2)
      const recentEF = activitiesWithEF.slice(0, half).reduce((s, a) => s + a.efficiencyFactor, 0) / half
      const olderEF = activitiesWithEF.slice(half).reduce((s, a) => s + a.efficiencyFactor, 0) / (activitiesWithEF.length - half)
      const efChange = ((recentEF - olderEF) / olderEF) * 100

      if (efChange < -5) {
        alerts.push('Efficiency Factor spada — możliwe przetrenowanie')
        suggestions.push('Zalecany tydzień regeneracyjny (70% objętości, zero intensywności)')
      } else if (efChange > 5) {
        suggestions.push('Efficiency Factor rośnie stabilnie — świetny progres!')
      }
    }

    // ===== Analyze missed workouts =====
    const weekActivitiesCount = last7.length
    const plannedPerWeek = plan.daysPerWeek || 4
    if (weekActivitiesCount < plannedPerWeek * 0.5) {
      suggestions.push(`Wykonujesz mniej niż połowę zaplanowanych treningów (${weekActivitiesCount}/${plannedPerWeek}). Rozważ zmniejszenie częstotliwości do ${Math.max(3, plannedPerWeek - 1)} dni/tydzień.`)
    }

    // Apply pace zone update if suggested
    if (paceZoneUpdate) {
      await planRef.update({
        paceZones: paceZoneUpdate,
        paceZonesUpdatedAt: new Date().toISOString(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    }

    return {
      suggestions,
      alerts,
      acwr: Math.round(acwr * 100) / 100,
      paceZoneUpdated: !!paceZoneUpdate,
      newPaceZones: paceZoneUpdate,
      activitiesAnalyzed: activities.length,
    }
  }
)
