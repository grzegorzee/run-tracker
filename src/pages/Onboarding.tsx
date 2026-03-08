import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useUser } from '@/contexts/UserContext'
import type { OnboardingData, RunnerType, GoalType, RunnerLevel, WeeklyDistance, TerrainAccess, HillExperience } from '@/types'

const TOTAL_STEPS = 9 // max steps (some conditional)

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

export default function Onboarding() {
  const navigate = useNavigate()
  const { user } = useUser()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [generating, setGenerating] = useState(false)

  const [data, setData] = useState<Partial<OnboardingData>>({
    daysPerWeek: 4,
  })

  const update = (partial: Partial<OnboardingData>) => {
    setData(prev => ({ ...prev, ...partial }))
  }

  const next = () => { setDirection(1); setStep(s => s + 1) }
  const prev = () => { setDirection(-1); setStep(s => Math.max(0, s - 1)) }

  const needsTrailQuestions = data.runnerType === 'trail' || data.runnerType === 'mountain' || data.runnerType === 'mixed'

  const handleGeneratePlan = async () => {
    if (!user) return
    setGenerating(true)

    try {
      // Save onboarding data to user profile
      await updateDoc(doc(db, 'users', user.uid), {
        onboardingCompleted: true,
        preferredTerrain: data.runnerType || 'road',
        onboardingData: data,
      })

      // TODO: Call Cloud Function to generate plan
      // For now, just navigate to dashboard
      navigate('/dashboard', { replace: true })
    } catch (err) {
      console.error('Onboarding error:', err)
      setGenerating(false)
    }
  }

  const progress = ((step + 1) / TOTAL_STEPS) * 100

  const renderStep = () => {
    switch (step) {
      case 0: return <StepRunnerType value={data.runnerType} onChange={(v) => { update({ runnerType: v }); next() }} />
      case 1: return <StepGoal value={data.goalType} onChange={(v) => { update({ goalType: v }); next() }} />
      case 2: return <StepLevel value={data.level} onChange={(v) => { update({ level: v }); next() }} />
      case 3: return <StepDistance value={data.weeklyDistance} onChange={(v) => { update({ weeklyDistance: v }); next() }} />
      case 4: return <StepRecentResults data={data} onChange={update} onNext={next} />
      case 5: return <StepDaysPerWeek value={data.daysPerWeek || 4} onChange={(v) => { update({ daysPerWeek: v }); next() }} />
      case 6:
        if (needsTrailQuestions) {
          return <StepTrailProfile data={data} onChange={update} onNext={next} />
        }
        return <StepInjuries value={data.injuries} onChange={update} onNext={next} />
      case 7:
        if (needsTrailQuestions) {
          return <StepInjuries value={data.injuries} onChange={update} onNext={next} />
        }
        return <StepGoalDate value={data.goalDate} onChange={update} onNext={handleGeneratePlan} />
      case 8:
        return <StepGoalDate value={data.goalDate} onChange={update} onNext={handleGeneratePlan} />
      default:
        return null
    }
  }

  if (generating) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center"
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--green-surface)', boxShadow: 'var(--shadow-glow)' }}
          >
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <path d="M4 24L10 8L14 16L18 10L22 18L28 6" stroke="var(--green-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </motion.div>
          <h2 className="font-display text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            AI analizuje Twoje dane...
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Generuję spersonalizowany plan treningowy
          </p>
          <div className="mt-6 w-48 h-1 mx-auto rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'var(--green-primary)' }}
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 8, ease: 'linear' }}
            />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)' }}>
      {/* Progress bar */}
      <div className="h-1 w-full" style={{ background: 'var(--bg-surface)' }}>
        <motion.div
          className="h-full"
          style={{ background: 'linear-gradient(90deg, var(--green-deep), var(--green-primary))' }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Back button */}
      {step > 0 && (
        <button
          onClick={prev}
          className="absolute top-6 left-4 text-sm px-3 py-1.5 rounded-lg z-10"
          style={{ color: 'var(--text-secondary)' }}
        >
          ← Wstecz
        </button>
      )}

      {/* Steps */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Step counter */}
      <p className="text-center pb-6 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        {step + 1} / {TOTAL_STEPS}
      </p>
    </div>
  )
}

// ===== Step Components =====

function StepRunnerType({ value, onChange }: { value?: RunnerType; onChange: (v: RunnerType) => void }) {
  const options: { value: RunnerType; icon: string; label: string; desc: string }[] = [
    { value: 'road', icon: '🛣️', label: 'Biegacz asfaltowy', desc: 'Drogi, chodniki, bieżnia' },
    { value: 'mountain', icon: '⛰️', label: 'Biegacz górski', desc: 'Szlaki, góry, trail running' },
    { value: 'trail', icon: '🌲', label: 'Biegacz terenowy', desc: 'Mieszany, parki leśne' },
    { value: 'mixed', icon: '🔄', label: 'Mieszany', desc: 'Biegam wszędzie' },
  ]
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Kim jesteś jako biegacz?
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Wybierz swój główny teren
      </p>
      <div className="grid grid-cols-2 gap-3">
        {options.map((opt) => (
          <OptionCard
            key={opt.value}
            icon={opt.icon}
            label={opt.label}
            description={opt.desc}
            selected={value === opt.value}
            onClick={() => onChange(opt.value)}
          />
        ))}
      </div>
    </div>
  )
}

function StepGoal({ value, onChange }: { value?: GoalType; onChange: (v: GoalType) => void }) {
  const options: { value: GoalType; label: string }[] = [
    { value: 'first_5k', label: 'Pierwszy 5K' },
    { value: 'improve_5k', label: 'Szybsze 5K' },
    { value: 'first_10k', label: 'Pierwszy 10K' },
    { value: 'improve_10k', label: 'Szybsze 10K' },
    { value: 'half_marathon', label: 'Półmaraton' },
    { value: 'marathon', label: 'Maraton' },
    { value: 'trail_race', label: 'Bieg trailowy' },
    { value: 'ultra', label: 'Ultra (50K+)' },
    { value: 'run_more', label: 'Chcę biegać więcej' },
  ]
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Jaki jest Twój cel?
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Dopasujemy plan do Twojego celu
      </p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="py-3 px-4 rounded-xl text-sm font-medium text-left transition-all"
            style={{
              background: value === opt.value ? 'var(--green-surface)' : 'var(--glass-bg)',
              border: `1px solid ${value === opt.value ? 'var(--green-primary)' : 'var(--glass-border)'}`,
              color: value === opt.value ? 'var(--green-primary)' : 'var(--text-primary)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepLevel({ value, onChange }: { value?: RunnerLevel; onChange: (v: RunnerLevel) => void }) {
  const options: { value: RunnerLevel; label: string; desc: string }[] = [
    { value: 'never_ran', label: 'Nigdy nie biegałem', desc: 'Zaczynam od zera' },
    { value: 'occasional', label: 'Od czasu do czasu', desc: '1-2 razy w tygodniu, nieregularnie' },
    { value: 'regular', label: 'Regularnie', desc: '3+ razy w tygodniu, od kilku miesięcy' },
    { value: 'competitive', label: 'Zaawansowany', desc: 'Startuję w zawodach, trenuję systematycznie' },
  ]
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Twój poziom biegowy
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Bądź szczery — lepszy plan zaczyna się od prawdy
      </p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className="w-full py-4 px-5 rounded-xl text-left transition-all"
            style={{
              background: value === opt.value ? 'var(--green-surface)' : 'var(--glass-bg)',
              border: `1px solid ${value === opt.value ? 'var(--green-primary)' : 'var(--glass-border)'}`,
            }}
          >
            <p className="text-sm font-semibold" style={{ color: value === opt.value ? 'var(--green-primary)' : 'var(--text-primary)' }}>
              {opt.label}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{opt.desc}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepDistance({ value, onChange }: { value?: WeeklyDistance; onChange: (v: WeeklyDistance) => void }) {
  const options: WeeklyDistance[] = ['0', '1-10', '10-30', '30-50', '50+']
  const labels: Record<WeeklyDistance, string> = {
    '0': '0 km — nie biegam',
    '1-10': '1-10 km / tydzień',
    '10-30': '10-30 km / tydzień',
    '30-50': '30-50 km / tydzień',
    '50+': '50+ km / tydzień',
  }
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Tygodniowy dystans
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Ile km biegasz średnio w tygodniu?
      </p>
      <div className="space-y-2">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className="w-full py-3 px-5 rounded-xl text-sm font-medium text-left transition-all"
            style={{
              background: value === opt ? 'var(--green-surface)' : 'var(--glass-bg)',
              border: `1px solid ${value === opt ? 'var(--green-primary)' : 'var(--glass-border)'}`,
              color: value === opt ? 'var(--green-primary)' : 'var(--text-primary)',
            }}
          >
            {labels[opt]}
          </button>
        ))}
      </div>
    </div>
  )
}

function StepRecentResults({ data, onChange, onNext }: { data: Partial<OnboardingData>; onChange: (d: Partial<OnboardingData>) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Ostatnie wyniki
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Opcjonalne — pomaga ustalić strefy tempa
      </p>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Komfortowe tempo (min:sek /km)
          </label>
          <input
            type="text"
            placeholder="np. 5:30"
            value={data.comfortPace || ''}
            onChange={(e) => onChange({ comfortPace: e.target.value })}
            className="w-full py-3 px-4 rounded-xl text-sm font-mono"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Czas ostatnich zawodów (opcjonalne)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={data.raceDistance || ''}
              onChange={(e) => onChange({ raceDistance: e.target.value })}
              className="py-3 px-4 rounded-xl text-sm"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
            >
              <option value="">Dystans</option>
              <option value="5k">5K</option>
              <option value="10k">10K</option>
              <option value="half">Półmaraton</option>
              <option value="marathon">Maraton</option>
            </select>
            <input
              type="text"
              placeholder="np. 1:45:00"
              value={data.raceTime || ''}
              onChange={(e) => onChange({ raceTime: e.target.value })}
              className="py-3 px-4 rounded-xl text-sm font-mono"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        </div>
      </div>
      <button onClick={onNext} className="btn-primary w-full mt-8">
        Dalej
      </button>
    </div>
  )
}

function StepDaysPerWeek({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Ile dni w tygodniu?
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Ile dni chcesz trenować?
      </p>
      <div className="grid grid-cols-4 gap-3">
        {[3, 4, 5, 6].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className="py-6 rounded-xl text-center transition-all"
            style={{
              background: value === n ? 'var(--green-surface)' : 'var(--glass-bg)',
              border: `1px solid ${value === n ? 'var(--green-primary)' : 'var(--glass-border)'}`,
            }}
          >
            <p className="font-mono text-3xl font-bold" style={{ color: value === n ? 'var(--green-primary)' : 'var(--text-primary)' }}>
              {n}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-tertiary)' }}>dni</p>
          </button>
        ))}
      </div>
    </div>
  )
}

function StepTrailProfile({ data, onChange, onNext }: { data: Partial<OnboardingData>; onChange: (d: Partial<OnboardingData>) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Profil terenu
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Powiedz nam o swoim terenie treningowym
      </p>
      <div className="space-y-6">
        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Dostęp do terenu górskiego
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['full', 'limited', 'none'] as TerrainAccess[]).map((v) => (
              <button
                key={v}
                onClick={() => onChange({ terrainAccess: v })}
                className="py-3 px-2 rounded-xl text-xs font-medium text-center transition-all"
                style={{
                  background: data.terrainAccess === v ? 'var(--green-surface)' : 'var(--glass-bg)',
                  border: `1px solid ${data.terrainAccess === v ? 'var(--green-primary)' : 'var(--glass-border)'}`,
                  color: data.terrainAccess === v ? 'var(--green-primary)' : 'var(--text-primary)',
                }}
              >
                {v === 'full' ? 'Stały' : v === 'limited' ? 'Ograniczony' : 'Brak'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Docelowe D+ zawodów (m)
          </label>
          <input
            type="number"
            placeholder="np. 2000"
            value={data.targetElevation || ''}
            onChange={(e) => onChange({ targetElevation: parseInt(e.target.value) || undefined })}
            className="w-full py-3 px-4 rounded-xl text-sm font-mono"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
            }}
          />
        </div>

        <div>
          <label className="text-xs font-medium uppercase tracking-wider block mb-2" style={{ color: 'var(--text-tertiary)' }}>
            Doświadczenie z bieganiem pod górę
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['none', 'basic', 'advanced'] as HillExperience[]).map((v) => (
              <button
                key={v}
                onClick={() => onChange({ hillExperience: v })}
                className="py-3 px-2 rounded-xl text-xs font-medium text-center transition-all"
                style={{
                  background: data.hillExperience === v ? 'var(--green-surface)' : 'var(--glass-bg)',
                  border: `1px solid ${data.hillExperience === v ? 'var(--green-primary)' : 'var(--glass-border)'}`,
                  color: data.hillExperience === v ? 'var(--green-primary)' : 'var(--text-primary)',
                }}
              >
                {v === 'none' ? 'Brak' : v === 'basic' ? 'Podstawowe' : 'Zaawansowane'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button onClick={onNext} className="btn-primary w-full mt-8">
        Dalej
      </button>
    </div>
  )
}

function StepInjuries({ value, onChange, onNext }: { value?: string; onChange: (d: Partial<OnboardingData>) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Kontuzje i ograniczenia
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Opcjonalne — AI uwzględni w planie
      </p>
      <textarea
        placeholder="np. Problemy z kolanem, ból achillesa..."
        value={value || ''}
        onChange={(e) => onChange({ injuries: e.target.value })}
        rows={4}
        className="w-full py-3 px-4 rounded-xl text-sm resize-none"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
        }}
      />
      <button onClick={onNext} className="btn-primary w-full mt-8">
        Dalej
      </button>
    </div>
  )
}

function StepGoalDate({ value, onChange, onNext }: { value?: string; onChange: (d: Partial<OnboardingData>) => void; onNext: () => void }) {
  return (
    <div>
      <h2 className="font-display text-2xl font-bold text-center mb-2" style={{ color: 'var(--text-primary)' }}>
        Data docelowa
      </h2>
      <p className="text-sm text-center mb-8" style={{ color: 'var(--text-secondary)' }}>
        Opcjonalne — data zawodów lub deadline
      </p>
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange({ goalDate: e.target.value })}
        className="w-full py-3 px-4 rounded-xl text-sm font-mono"
        style={{
          background: 'var(--glass-bg)',
          border: '1px solid var(--glass-border)',
          color: 'var(--text-primary)',
          colorScheme: 'dark',
        }}
      />
      <button onClick={onNext} className="btn-primary w-full mt-8">
        🚀 Wygeneruj plan treningowy
      </button>
      <button
        onClick={onNext}
        className="w-full mt-3 py-2 text-sm"
        style={{ color: 'var(--text-tertiary)' }}
      >
        Pomiń — bez daty docelowej
      </button>
    </div>
  )
}

// ===== Reusable Card =====

function OptionCard({ icon, label, description, selected, onClick }: {
  icon: string; label: string; description: string; selected: boolean; onClick: () => void
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="p-5 rounded-xl text-left transition-all"
      style={{
        background: selected ? 'var(--green-surface)' : 'var(--glass-bg)',
        border: `1px solid ${selected ? 'var(--green-primary)' : 'var(--glass-border)'}`,
        boxShadow: selected ? 'var(--shadow-glow)' : 'none',
      }}
    >
      <span className="text-3xl block mb-2">{icon}</span>
      <p className="text-sm font-semibold" style={{ color: selected ? 'var(--green-primary)' : 'var(--text-primary)' }}>
        {label}
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{description}</p>
    </motion.button>
  )
}
