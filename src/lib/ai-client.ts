import { httpsCallable } from 'firebase/functions'
import { functions } from './firebase'
import type { OnboardingData } from '@/types'

interface GeneratePlanResult {
  planId: string
  totalWeeks: number
  generatedUpTo: string
}

export async function generateTrainingPlan(data: OnboardingData): Promise<GeneratePlanResult> {
  const fn = httpsCallable<OnboardingData, GeneratePlanResult>(functions, 'generatePlan')
  const result = await fn(data)
  return result.data
}
