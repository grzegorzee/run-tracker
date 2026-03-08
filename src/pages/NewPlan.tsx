import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, ArrowRight } from 'lucide-react'

export default function NewPlan() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="glass-card p-8 md:p-12 max-w-md mx-4 text-center"
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--green-surface)' }}
        >
          <Sparkles size={32} style={{ color: 'var(--green-primary)' }} />
        </motion.div>

        <h1 className="font-display text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          Nowy rozdział
        </h1>
        <p className="text-sm leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
          Twój poprzedni plan treningowy się zakończył. Czas na nowe cele — AI przygotuje spersonalizowany plan
          na podstawie Twoich dotychczasowych wyników ze Stravy.
        </p>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate('/onboarding')}
          className="btn-primary w-full flex items-center justify-center gap-2 text-sm py-3"
        >
          Zacznij nowy plan <ArrowRight size={16} />
        </motion.button>

        <p className="mt-4 text-xs" style={{ color: 'var(--text-tertiary)' }}>
          Twoje dane z poprzedniego planu pozostaną dostępne w Analytics.
        </p>
      </motion.div>
    </div>
  )
}
