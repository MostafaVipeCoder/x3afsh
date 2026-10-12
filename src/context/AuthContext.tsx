import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/types'
import { identifyUser, resetAnalytics, track } from '../lib/analytics'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  session: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  signOut: async () => {},
})

const NEXT_KEY = 'x3afsh_next'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile((data as Profile) ?? null)
    if (data) identifyUser(userId, { governorate_id: (data as Profile).governorate_id, phone_verified: (data as Profile).phone_verified })
    return (data as Profile) ?? null
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session) await loadProfile(data.session.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s)
      if (s) {
        const p = await loadProfile(s.user.id)
        // Returning from Google: the URL carries ?code=…; clean it and continue to where the user wanted to go
        if (event === 'SIGNED_IN' && window.location.search.includes('code=')) {
          window.history.replaceState({}, '', window.location.pathname)
          track('logged_in', { method: 'google' })
          let next = '/'
          try { next = localStorage.getItem(NEXT_KEY) || '/'; localStorage.removeItem(NEXT_KEY) } catch { /* ignore */ }
          const needsProfile = !p?.display_name || !p?.phone
          window.location.hash = needsProfile ? `#/account?first=1&next=${encodeURIComponent(next)}` : `#${next}`
        }
      } else {
        setProfile(null)
      }
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => { if (session) await loadProfile(session.user.id) },
        signOut: async () => { await supabase.auth.signOut(); resetAnalytics() },
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
