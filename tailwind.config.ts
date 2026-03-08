import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Satoshi', 'system-ui', 'sans-serif'],
        body: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['Space Grotesk', 'monospace'],
      },
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        border: {
          subtle: 'var(--border-subtle)',
          active: 'var(--border-active)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          tertiary: 'var(--text-tertiary)',
        },
        green: {
          primary: 'var(--green-primary)',
          glow: 'var(--green-glow)',
          surface: 'var(--green-surface)',
          deep: 'var(--green-deep)',
        },
        gold: {
          accent: 'var(--gold-accent)',
          glow: 'var(--gold-glow)',
        },
        pace: {
          easy: 'var(--pace-easy)',
          tempo: 'var(--pace-tempo)',
          interval: 'var(--pace-interval)',
          long: 'var(--pace-long)',
          recovery: 'var(--pace-recovery)',
          trail: 'var(--pace-trail)',
          hills: 'var(--pace-hills)',
          taper: 'var(--pace-taper)',
        },
      },
      borderRadius: {
        sm: '12px',
        md: '16px',
        lg: '20px',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        elevated: 'var(--shadow-elevated)',
        glow: 'var(--shadow-glow)',
      },
      backdropBlur: {
        glass: '20px',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '1' },
        },
        'count-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'count-up': 'count-up 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-in': 'slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
}

export default config
