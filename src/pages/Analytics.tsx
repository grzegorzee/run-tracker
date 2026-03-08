import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUser } from '@/contexts/UserContext'
import { useTrainingPlan } from '@/hooks/useTrainingPlan'
import { useRunningActivities } from '@/hooks/useRunningActivities'
import { formatPace, formatDistance } from '@/lib/utils'
import { racePrediction, calculatePaceZones, calculateVDOT, RACE_DISTANCES } from '@/lib/pace-utils'
import { calculateGAP } from '@/lib/elevation-utils'
import AnimatedNumber from '@/components/AnimatedNumber'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts'

type TabId = 'overview' | 'charts' | 'progress' | 'tools'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Przegląd' },
  { id: 'charts', label: 'Wykresy' },
  { id: 'progress', label: 'Postęp' },
  { id: 'tools', label: 'Narzędzia' },
]

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')
  const { user } = useUser()
  const { plan } = useTrainingPlan()
  const { activities, getWeekStats } = useRunningActivities(user?.uid || '')

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
        Analytics
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-surface)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all"
            style={{
              background: activeTab === tab.id ? 'var(--green-surface)' : 'transparent',
              color: activeTab === tab.id ? 'var(--green-primary)' : 'var(--text-secondary)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'overview' && <OverviewTab plan={plan} activities={activities} getWeekStats={getWeekStats} />}
          {activeTab === 'charts' && <ChartsTab activities={activities} />}
          {activeTab === 'progress' && <ProgressTab plan={plan} getWeekStats={getWeekStats} />}
          {activeTab === 'tools' && <ToolsTab />}
        </motion.div>
      </AnimatePresence>

      {activities.length === 0 && (
        <p className="text-center text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Połącz Stravę i zsynchronizuj aktywności, żeby zobaczyć pełną analitykę.
        </p>
      )}
    </div>
  )
}

// ===== Tab 1: Overview =====

function OverviewTab({ plan, activities, getWeekStats }: {
  plan: ReturnType<typeof useTrainingPlan>['plan']
  activities: ReturnType<typeof useRunningActivities>['activities']
  getWeekStats: ReturnType<typeof useRunningActivities>['getWeekStats']
}) {
  const weeklyData = useMemo(() => {
    if (!plan) return []
    return plan.weeks.map(week => {
      const stats = getWeekStats(week.weekNumber)
      return {
        week: `T${week.weekNumber}`,
        planned: week.totalDistanceKm,
        actual: stats.totalDistance / 1000,
        elevation: stats.totalElevation,
        plannedElev: week.totalElevation || 0,
      }
    })
  }, [plan, getWeekStats])

  return (
    <div className="space-y-6">
      {/* Weekly km chart */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Km / tydzień — Plan vs Wykonanie
        </h3>
        {weeklyData.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
              <Bar dataKey="planned" name="Plan" fill="var(--green-deep)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="actual" name="Wykonanie" fill="var(--green-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <PlaceholderBars />
        )}
      </div>

      {/* Elevation chart */}
      {weeklyData.some(d => d.elevation > 0 || d.plannedElev > 0) && (
        <div className="glass-card p-5">
          <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
            D+ / tydzień
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="week" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <Bar dataKey="plannedElev" name="Plan D+" fill="var(--pace-trail)" opacity={0.4} radius={[4, 4, 0, 0]} />
              <Bar dataKey="elevation" name="D+" fill="var(--pace-trail)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Recent activities */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Ostatnie aktywności
        </h3>
        <div className="space-y-2">
          {activities.slice(0, 8).map((act, i) => (
            <motion.div
              key={act.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center justify-between py-2 px-3 rounded-lg"
              style={{ background: i % 2 === 0 ? 'var(--glass-bg)' : 'transparent' }}
            >
              <div>
                <p className="text-sm font-medium truncate max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
                  {act.name}
                </p>
                <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{act.date}</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm" style={{ color: 'var(--text-primary)' }}>{formatDistance(act.distance)}</p>
                <p className="font-mono text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{formatPace(act.avgPace)}/km</p>
              </div>
            </motion.div>
          ))}
          {activities.length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--text-tertiary)' }}>Brak aktywności</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ===== Tab 2: Charts =====

function ChartsTab({ activities }: { activities: ReturnType<typeof useRunningActivities>['activities'] }) {
  const [filter, setFilter] = useState<'all' | 'easy' | 'tempo' | 'trail'>('all')

  const paceData = useMemo(() => {
    let filtered = [...activities].reverse()
    if (filter !== 'all') {
      filtered = filtered.filter(a => {
        if (filter === 'trail') return a.sportType === 'TrailRun'
        if (filter === 'easy') return a.avgPace > 330 // > 5:30/km approx
        if (filter === 'tempo') return a.avgPace < 330
        return true
      })
    }
    return filtered.map(a => ({
      date: a.date.slice(5), // MM-DD
      pace: Math.round(a.avgPace),
      gap: a.gradeAdjustedPace ? Math.round(a.gradeAdjustedPace) : null,
      hr: a.avgHR || null,
      cadence: a.avgCadence || null,
    }))
  }, [activities, filter])

  return (
    <div className="space-y-6">
      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'easy', 'tempo', 'trail'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="py-1 px-3 rounded-full text-xs font-medium transition-all"
            style={{
              background: filter === f ? 'var(--green-surface)' : 'transparent',
              color: filter === f ? 'var(--green-primary)' : 'var(--text-tertiary)',
              border: `1px solid ${filter === f ? 'var(--border-active)' : 'var(--border-subtle)'}`,
            }}
          >
            {f === 'all' ? 'Wszystkie' : f === 'easy' ? 'Easy' : f === 'tempo' ? 'Tempo' : 'Trail'}
          </button>
        ))}
      </div>

      {/* Pace trend */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Trend tempa
        </h3>
        {paceData.length > 1 ? (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={paceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis
                reversed
                tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }}
                tickFormatter={v => formatPace(v)}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
                formatter={(val) => formatPace(val as number)}
              />
              <Line type="monotone" dataKey="pace" stroke="var(--green-primary)" strokeWidth={2} dot={{ r: 3 }} name="Pace" />
              <Line type="monotone" dataKey="gap" stroke="var(--pace-trail)" strokeWidth={2} dot={{ r: 3 }} name="GAP" connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Za mało danych</p>
        )}
      </div>

      {/* HR trend */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Trend HR
        </h3>
        {paceData.filter(d => d.hr).length > 1 ? (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceData.filter(d => d.hr)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="hr" stroke="var(--pace-interval)" strokeWidth={2} dot={{ r: 3 }} name="Avg HR" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Brak danych HR</p>
        )}
      </div>

      {/* Cadence */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Kadencja
        </h3>
        {paceData.filter(d => d.cadence).length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={paceData.filter(d => d.cadence)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} />
              <YAxis tick={{ fill: 'var(--text-tertiary)', fontSize: 10 }} domain={[150, 200]} />
              <Tooltip
                contentStyle={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  color: 'var(--text-primary)',
                  fontSize: 12,
                }}
              />
              <Line type="monotone" dataKey="cadence" stroke="var(--pace-long)" strokeWidth={2} dot={{ r: 3 }} name="Kadencja" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-xs text-center py-8" style={{ color: 'var(--text-tertiary)' }}>Brak danych kadencji</p>
        )}
      </div>
    </div>
  )
}

// ===== Tab 3: Progress =====

function ProgressTab({ plan, getWeekStats }: {
  plan: ReturnType<typeof useTrainingPlan>['plan']
  getWeekStats: ReturnType<typeof useRunningActivities>['getWeekStats']
}) {
  const progressData = useMemo(() => {
    if (!plan) return { completion: 0, weeks: [] as Array<{ week: number; status: 'done' | 'partial' | 'skipped' | 'future' }> }

    let totalPlanned = 0
    let totalCompleted = 0
    const weeks: Array<{ week: number; status: 'done' | 'partial' | 'skipped' | 'future' }> = []

    const now = new Date()
    const startDate = new Date(plan.startDate)

    for (const week of plan.weeks) {
      const weekStartDate = new Date(startDate)
      weekStartDate.setDate(weekStartDate.getDate() + (week.weekNumber - 1) * 7)

      if (weekStartDate > now) {
        weeks.push({ week: week.weekNumber, status: 'future' })
        continue
      }

      const planned = week.workouts.length
      const stats = getWeekStats(week.weekNumber)
      const done = stats.completedWorkouts

      totalPlanned += planned
      totalCompleted += done

      if (done >= planned) weeks.push({ week: week.weekNumber, status: 'done' })
      else if (done > 0) weeks.push({ week: week.weekNumber, status: 'partial' })
      else weeks.push({ week: week.weekNumber, status: 'skipped' })
    }

    const completion = totalPlanned > 0 ? Math.round((totalCompleted / totalPlanned) * 100) : 0
    return { completion, weeks }
  }, [plan, getWeekStats])

  return (
    <div className="space-y-6">
      {/* Completion ring */}
      <div className="glass-card p-6 flex items-center justify-center">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="8" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke="var(--green-primary)"
              strokeWidth="8"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: progressData.completion / 100 }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
              style={{ strokeDasharray: '264', strokeDashoffset: '0' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-mono text-3xl font-bold" style={{ color: 'var(--green-primary)' }}>
              <AnimatedNumber value={progressData.completion} decimals={0} />
            </span>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>%</span>
          </div>
        </div>
      </div>

      {/* Week heatmap */}
      <div className="glass-card p-5">
        <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
          Realizacja po tygodniach
        </h3>
        <div className="grid grid-cols-8 gap-2">
          {progressData.weeks.map((w, i) => {
            const colors = {
              done: 'var(--green-primary)',
              partial: 'var(--gold-accent)',
              skipped: 'var(--pace-interval)',
              future: 'var(--border-subtle)',
            }
            return (
              <motion.div
                key={w.week}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.03 }}
                className="aspect-square rounded-lg flex items-center justify-center text-[10px] font-bold"
                style={{ background: colors[w.status], color: w.status === 'future' ? 'var(--text-tertiary)' : '#000' }}
                title={`Tydzień ${w.week}: ${w.status}`}
              >
                {w.week}
              </motion.div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-3 justify-center">
          {[
            { label: 'Pełne', color: 'var(--green-primary)' },
            { label: 'Częściowe', color: 'var(--gold-accent)' },
            { label: 'Pominięte', color: 'var(--pace-interval)' },
            { label: 'Przyszłe', color: 'var(--border-subtle)' },
          ].map(l => (
            <div key={l.label} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded" style={{ background: l.color }} />
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>{l.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ===== Tab 4: Tools =====

function ToolsTab() {
  return (
    <div className="space-y-6">
      <RacePredictor />
      <PaceZoneCalculator />
      <VDOTCalculator />
      <GAPCalculator />
    </div>
  )
}

function RacePredictor() {
  const [raceDistance, setRaceDistance] = useState('5k')
  const [raceTime, setRaceTime] = useState('')

  const predictions = useMemo(() => {
    if (!raceTime) return null
    const parts = raceTime.split(':').map(Number)
    let totalSeconds = 0
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1]
    else return null

    const distanceMap: Record<string, number> = { '5k': 5000, '10k': 10000, 'half': 21097.5, 'marathon': 42195 }
    const d1 = distanceMap[raceDistance]
    if (!d1 || totalSeconds <= 0) return null

    return Object.entries(RACE_DISTANCES).map(([key, d2]) => ({
      name: key,
      distance: d2,
      time: racePrediction(d1, totalSeconds, d2),
    }))
  }, [raceDistance, raceTime])

  return (
    <div className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        Race Predictor (Riegel)
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Dystans bazowy</label>
          <select
            value={raceDistance}
            onChange={e => setRaceDistance(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <option value="5k">5 km</option>
            <option value="10k">10 km</option>
            <option value="half">Półmaraton</option>
            <option value="marathon">Maraton</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Czas (mm:ss lub h:mm:ss)</label>
          <input
            type="text"
            value={raceTime}
            onChange={e => setRaceTime(e.target.value)}
            placeholder="25:30"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />
        </div>
      </div>
      {predictions && (
        <div className="space-y-2">
          {predictions.map(p => (
            <div key={p.name} className="flex items-center justify-between py-1">
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p.name}</span>
              <span className="font-mono text-sm font-medium" style={{ color: 'var(--green-primary)' }}>
                {formatTime(p.time)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PaceZoneCalculator() {
  const [threshold, setThreshold] = useState('')

  const zones = useMemo(() => {
    if (!threshold) return null
    const parts = threshold.split(':').map(Number)
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
    const secPerKm = parts[0] * 60 + parts[1]
    return calculatePaceZones(secPerKm)
  }, [threshold])

  return (
    <div className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        Kalkulator stref tempa
      </h3>
      <div className="mb-4">
        <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Tempo progowe (mm:ss/km)</label>
        <input
          type="text"
          value={threshold}
          onChange={e => setThreshold(e.target.value)}
          placeholder="5:00"
          className="w-full py-2 px-3 rounded-lg text-sm"
          style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
        />
      </div>
      {zones && (
        <div className="space-y-2">
          {Object.entries(zones).map(([zone, range]) => (
            <div key={zone} className="flex items-center justify-between py-1">
              <span className="text-sm capitalize" style={{ color: 'var(--text-secondary)' }}>{zone}</span>
              <span className="font-mono text-sm" style={{ color: 'var(--green-primary)' }}>
                {formatPace(range.min)} - {formatPace(range.max)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VDOTCalculator() {
  const [distance, setDistance] = useState('5000')
  const [time, setTime] = useState('')

  const vdot = useMemo(() => {
    if (!time) return null
    const parts = time.split(':').map(Number)
    let totalSeconds = 0
    if (parts.length === 3) totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2]
    else if (parts.length === 2) totalSeconds = parts[0] * 60 + parts[1]
    else return null
    if (totalSeconds <= 0) return null
    return calculateVDOT(Number(distance), totalSeconds)
  }, [distance, time])

  return (
    <div className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        VDOT Calculator
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Dystans (m)</label>
          <select
            value={distance}
            onChange={e => setDistance(e.target.value)}
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          >
            <option value="1609">1 mila</option>
            <option value="5000">5 km</option>
            <option value="10000">10 km</option>
            <option value="21097">Półmaraton</option>
            <option value="42195">Maraton</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Czas</label>
          <input
            type="text"
            value={time}
            onChange={e => setTime(e.target.value)}
            placeholder="25:30"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />
        </div>
      </div>
      {vdot !== null && (
        <div className="text-center">
          <p className="font-mono text-4xl font-bold" style={{ color: 'var(--green-primary)' }}>
            {vdot.toFixed(1)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>VDOT</p>
        </div>
      )}
    </div>
  )
}

function GAPCalculator() {
  const [gpsPace, setGpsPace] = useState('')
  const [grade, setGrade] = useState('')

  const gap = useMemo(() => {
    if (!gpsPace || !grade) return null
    const parts = gpsPace.split(':').map(Number)
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null
    const secPerKm = parts[0] * 60 + parts[1]
    const gradePercent = parseFloat(grade)
    if (isNaN(gradePercent)) return null
    return calculateGAP(secPerKm, gradePercent)
  }, [gpsPace, grade])

  return (
    <div className="glass-card p-5">
      <h3 className="font-display text-sm font-semibold mb-4" style={{ color: 'var(--text-secondary)' }}>
        GAP Calculator
      </h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>GPS Pace (mm:ss/km)</label>
          <input
            type="text"
            value={gpsPace}
            onChange={e => setGpsPace(e.target.value)}
            placeholder="6:30"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider block mb-1" style={{ color: 'var(--text-tertiary)' }}>Nachylenie (%)</label>
          <input
            type="text"
            value={grade}
            onChange={e => setGrade(e.target.value)}
            placeholder="5"
            className="w-full py-2 px-3 rounded-lg text-sm"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
          />
        </div>
      </div>
      {gap !== null && (
        <div className="text-center">
          <p className="font-mono text-3xl font-bold" style={{ color: 'var(--pace-trail)' }}>
            {formatPace(gap)}/km
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Grade-Adjusted Pace</p>
        </div>
      )}
    </div>
  )
}

// Helpers

function PlaceholderBars() {
  return (
    <div className="h-48 flex items-end justify-center gap-2">
      {[35, 42, 38, 45, 40, 48, 44, 42].map((h, i) => (
        <motion.div
          key={i}
          initial={{ height: 0 }}
          animate={{ height: `${h * 2}px` }}
          transition={{ delay: i * 0.08, duration: 0.6 }}
          className="w-8 rounded-t-lg"
          style={{ background: 'linear-gradient(to top, var(--green-deep), var(--green-primary))' }}
        />
      ))}
    </div>
  )
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.round(seconds % 60)
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}
