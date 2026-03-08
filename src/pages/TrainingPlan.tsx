import { motion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Watch } from 'lucide-react'

export default function TrainingPlan() {
  // TODO: Replace with real data from useTrainingPlan

  const phases = [
    { name: 'BASE', weeks: '1-4', class: 'phase-base' },
    { name: 'BUILD', weeks: '5-10', class: 'phase-build' },
    { name: 'PEAK', weeks: '11-13', class: 'phase-peak' },
    { name: 'TAPER', weeks: '14-15', class: 'phase-taper' },
    { name: 'RACE', weeks: '16', class: 'phase-race' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
          Plan treningowy
        </h1>
        <div className="flex items-center gap-2">
          <button className="btn-ghost p-2 rounded-xl"><ChevronLeft size={18} /></button>
          <span className="text-sm font-mono font-medium" style={{ color: 'var(--text-primary)' }}>Tydzień 8</span>
          <button className="btn-ghost p-2 rounded-xl"><ChevronRight size={18} /></button>
        </div>
      </div>

      {/* Phase timeline */}
      <div className="flex gap-1 h-2 rounded-full overflow-hidden">
        {phases.map((phase) => (
          <motion.div
            key={phase.name}
            className="h-full rounded-full"
            style={{
              flex: phase.name === 'BUILD' ? 3 : phase.name === 'BASE' ? 2 : phase.name === 'PEAK' ? 1.5 : 1,
              background: phase.name === 'BUILD' ? 'var(--green-primary)' :
                         phase.name === 'BASE' ? 'var(--pace-easy)' :
                         phase.name === 'PEAK' ? 'var(--pace-interval)' :
                         phase.name === 'TAPER' ? 'var(--pace-taper)' :
                         'var(--gold-accent)',
              opacity: phase.name === 'BUILD' ? 1 : 0.4,
            }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-medium" style={{ color: 'var(--text-tertiary)' }}>
        {phases.map((phase) => (
          <span key={phase.name} className={phase.class}>{phase.name}</span>
        ))}
      </div>

      {/* Week workouts */}
      <div className="space-y-3">
        {[
          { day: 'Poniedziałek', type: 'easy_run', name: 'Easy Run', km: 6, pace: '5:40-6:00', color: 'var(--pace-easy)', done: true },
          { day: 'Wtorek', type: 'hill_repeats', name: 'Hill Repeats', km: 8, pace: '5:00-5:15', color: 'var(--pace-hills)', done: false, today: true },
          { day: 'Środa', type: 'rest', name: 'Odpoczynek', km: 0, pace: '', color: 'var(--text-tertiary)', done: false },
          { day: 'Czwartek', type: 'tempo', name: 'Tempo Run', km: 10, pace: '5:10/km', color: 'var(--pace-tempo)', done: false },
          { day: 'Piątek', type: 'rest', name: 'Odpoczynek', km: 0, pace: '', color: 'var(--text-tertiary)', done: false },
          { day: 'Sobota', type: 'long_run', name: 'Long Trail Run', km: 22, pace: '1200m D+', color: 'var(--pace-trail)', done: false },
          { day: 'Niedziela', type: 'recovery', name: 'Recovery', km: 4, pace: '6:30+', color: 'var(--pace-recovery)', done: false },
        ].map((workout, i) => (
          <motion.div
            key={workout.day}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
            className="glass-card p-4 flex items-center gap-4"
            style={{
              borderLeft: `3px solid ${workout.color}`,
              opacity: workout.done ? 0.6 : 1,
            }}
          >
            <div className="w-20 flex-shrink-0">
              <p className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>{workout.day.slice(0, 3)}</p>
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold" style={{ color: workout.done ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                {workout.done && '✓ '}{workout.name}
              </p>
              {workout.km > 0 && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                  {workout.km} km &middot; {workout.pace}
                </p>
              )}
            </div>
            {workout.today && (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full"
                style={{ background: 'var(--green-surface)', color: 'var(--green-primary)' }}>
                Dziś
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Garmin batch upload */}
      <button className="btn-primary w-full flex items-center justify-center gap-2">
        <Watch size={16} />
        Wyślij cały tydzień na Garmin
      </button>
    </div>
  )
}
