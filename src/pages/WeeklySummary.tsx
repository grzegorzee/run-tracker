import { useState, useEffect } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { motion } from 'framer-motion'
import { formatPace } from '@/lib/utils'
import { Loader2, Sparkles, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { toast } from 'sonner'
import type { WeeklySummary as WeeklySummaryType } from '@/types'

export default function WeeklySummary() {
  const { user } = useUser()
  useTrainingPlan() // ensure plan context is loaded
  const [summaries, setSummaries] = useState<WeeklySummaryType[]>([])
  const [loading, setLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    if (!user) return

    const q = query(
      collection(db, 'weekly_summaries'),
      where('userId', '==', user.uid),
      orderBy('weekNumber', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as WeeklySummaryType[]
      setSummaries(data)
      setLoading(false)
    })

    return () => unsub()
  }, [user])

  const handleGenerate = async () => {
    if (!user) return
    setIsGenerating(true)
    try {
      const trigger = httpsCallable(functions, 'triggerWeeklyDigest')
      await trigger({ userId: user.uid })
      toast.success('Podsumowanie wygenerowane')
    } catch (err) {
      console.error('Digest error:', err)
      toast.error('Błąd generowania')
    } finally {
      setIsGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--green-primary)' }} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Podsumowania tygodniowe
        </h1>
        <button
          onClick={handleGenerate}
          disabled={isGenerating}
          className="btn-ghost text-xs flex items-center gap-2"
        >
          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Generuj
        </button>
      </div>

      {summaries.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Brak podsumowań. Podsumowania generują się automatycznie w poniedziałki.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {summaries.map((summary, i) => (
            <motion.div
              key={summary.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    Tydzień {summary.weekNumber}
                  </h3>
                  <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                    {summary.weekStartDate} &middot;{' '}
                    <span className={`phase-${summary.weekType}`}>{summary.weekType.toUpperCase()}</span>
                  </p>
                </div>
                <CompletionBadge planned={summary.plannedWorkouts} actual={summary.actualWorkouts} />
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <MetricCell
                  label="Dystans"
                  planned={`${summary.plannedDistance}km`}
                  actual={`${summary.actualDistance}km`}
                  trend={summary.actualDistance >= summary.plannedDistance * 0.9 ? 'up' : 'down'}
                />
                <MetricCell
                  label="Treningi"
                  planned={String(summary.plannedWorkouts)}
                  actual={String(summary.actualWorkouts)}
                  trend={summary.actualWorkouts >= summary.plannedWorkouts ? 'up' : 'down'}
                />
                {summary.avgPace ? (
                  <MetricCell
                    label="Avg Pace"
                    planned=""
                    actual={`${formatPace(summary.avgPace)}/km`}
                    trend="neutral"
                  />
                ) : (
                  <MetricCell label="D+" planned="" actual={`${summary.actualElevation || 0}m`} trend="neutral" />
                )}
              </div>

              {/* AI insights */}
              {summary.aiInsights && (
                <div className="pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={14} style={{ color: 'var(--gold-accent)' }} />
                    <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--gold-accent)' }}>
                      AI Coach
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {summary.aiInsights}
                  </p>
                </div>
              )}

              {/* Suggestions */}
              {summary.adaptationSuggestions && summary.adaptationSuggestions.length > 0 && (
                <div className="mt-3 space-y-1">
                  {summary.adaptationSuggestions.map((s, j) => (
                    <p key={j} className="text-xs flex gap-2" style={{ color: 'var(--text-tertiary)' }}>
                      <span style={{ color: 'var(--green-primary)' }}>→</span>
                      {s}
                    </p>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}

function CompletionBadge({ planned, actual }: { planned: number; actual: number }) {
  const pct = planned > 0 ? Math.round((actual / planned) * 100) : 0
  const color = pct >= 90 ? 'var(--green-primary)' : pct >= 60 ? 'var(--gold-accent)' : 'var(--pace-interval)'

  return (
    <div className="px-2 py-1 rounded-lg text-xs font-bold" style={{ background: `${color}20`, color }}>
      {pct}%
    </div>
  )
}

function MetricCell({ label, planned, actual, trend }: {
  label: string; planned: string; actual: string; trend: 'up' | 'down' | 'neutral'
}) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus
  const trendColor = trend === 'up' ? 'var(--green-primary)' : trend === 'down' ? 'var(--pace-interval)' : 'var(--text-tertiary)'

  return (
    <div className="text-center">
      <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>{label}</p>
      <p className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{actual}</p>
      {planned && (
        <div className="flex items-center justify-center gap-1 mt-1">
          <TrendIcon size={10} style={{ color: trendColor }} />
          <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>plan: {planned}</span>
        </div>
      )}
    </div>
  )
}
