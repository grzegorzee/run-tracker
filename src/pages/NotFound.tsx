import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
      <p className="font-mono text-6xl font-bold" style={{ color: 'var(--green-primary)' }}>404</p>
      <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Strona nie znaleziona</p>
      <Link to="/dashboard" className="btn-primary mt-6 text-sm">
        Wróć do Dashboard
      </Link>
    </div>
  )
}
