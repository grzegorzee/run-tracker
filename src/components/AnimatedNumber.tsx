import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

interface AnimatedNumberProps {
  value: number
  decimals?: number
  duration?: number
  prefix?: string
  suffix?: string
  className?: string
}

export default function AnimatedNumber({
  value,
  decimals = 1,
  duration = 1.2,
  prefix = '',
  suffix = '',
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(0)

  useEffect(() => {
    const startTime = Date.now()
    const startValue = displayValue

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / (duration * 1000), 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      const current = startValue + (value - startValue) * eased

      setDisplayValue(current)

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration])

  return (
    <motion.span
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className={`font-mono tabular-nums ${className}`}
    >
      {prefix}{displayValue.toFixed(decimals)}{suffix}
    </motion.span>
  )
}
