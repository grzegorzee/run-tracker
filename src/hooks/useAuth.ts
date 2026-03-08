import { useState, useEffect, useCallback } from 'react'
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, googleProvider, db } from '@/lib/firebase'
import type { UserProfile } from '@/types'

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS || '').split(',').map((e: string) => e.trim().toLowerCase())

interface AuthState {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    userProfile: null,
    loading: true,
    error: null,
  })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, userProfile: null, loading: false, error: null })
        return
      }

      if (ALLOWED_EMAILS.length > 0 && ALLOWED_EMAILS[0] !== '' && !ALLOWED_EMAILS.includes(user.email?.toLowerCase() || '')) {
        await firebaseSignOut(auth)
        setState({ user: null, userProfile: null, loading: false, error: 'Brak dostępu. Email nie jest na liście dozwolonych.' })
        return
      }

      try {
        const profile = await ensureUserDoc(user)
        setState({ user, userProfile: profile, loading: false, error: null })
      } catch {
        setState({ user, userProfile: null, loading: false, error: 'Błąd ładowania profilu' })
      }
    })

    return () => unsubscribe()
  }, [])

  const signIn = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setState(s => ({ ...s, loading: false, error: 'Błąd logowania' }))
      console.error('Sign in error:', err)
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
    setState({ user: null, userProfile: null, loading: false, error: null })
  }, [])

  return { ...state, signIn, signOut }
}

async function ensureUserDoc(user: User): Promise<UserProfile> {
  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)

  if (snap.exists()) {
    await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true })
    return { uid: user.uid, ...snap.data() } as UserProfile
  }

  const newProfile: Omit<UserProfile, 'lastLogin' | 'createdAt'> = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    photoURL: user.photoURL || undefined,
    role: 'user',
    onboardingCompleted: false,
    garminConnected: false,
    stravaConnected: false,
    preferredTerrain: 'road',
  }

  await setDoc(ref, {
    ...newProfile,
    lastLogin: serverTimestamp(),
    createdAt: serverTimestamp(),
  })

  return {
    ...newProfile,
    lastLogin: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  } as UserProfile
}
