import { createContext, useContext, type ReactNode } from 'react'
import { useAuth } from '@/hooks/useAuth'
import type { User } from 'firebase/auth'
import type { UserProfile } from '@/types'

interface UserContextValue {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
  signIn: () => Promise<void>
  signOut: () => Promise<void>
  isNewUser: boolean
}

const UserContext = createContext<UserContextValue | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const auth = useAuth()
  const isNewUser = !!auth.userProfile && !auth.userProfile.onboardingCompleted

  return (
    <UserContext.Provider value={{ ...auth, isNewUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used within UserProvider')
  return ctx
}
