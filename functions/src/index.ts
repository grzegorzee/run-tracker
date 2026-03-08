import * as admin from 'firebase-admin'

admin.initializeApp()

// AI
export { generatePlan } from './ai/generatePlan'

// Strava OAuth
export { stravaAuthUrl } from './strava/stravaAuthUrl'
export { stravaCallback } from './strava/stravaCallback'
export { stravaSync, scheduledStravaSync } from './strava/stravaSync'

// AI Analysis
export { analyzeWorkout } from './ai/analyzeWorkout'

// Adaptive Planner
export { adaptivePlanner, triggerAdaptivePlanner } from './ai/adaptivePlanner'

// Weekly Digest
export { weeklyDigest, triggerWeeklyDigest } from './ai/weeklyDigest'

// Adaptation Suggestions
export { suggestAdaptations } from './ai/suggestAdaptations'
