import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'

interface AuthCtx {
  session: Session | null
  user: User | null
  loading: boolean
  authError: string | null
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as any)
export const useAuth = () => useContext(Ctx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('getSession error:', error.message)
          setAuthError(error.message)
        }
        setSession(data.session)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Supabase connection failed:', err)
        setAuthError('Cannot connect to Supabase. Check your .env credentials.')
        setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthCtx = {
    session,
    user: session?.user ?? null,
    loading,
    authError,
    async signUp(email, password) {
      const { error } = await supabase.auth.signUp({ email, password })
      return { error: error?.message ?? null }
    },
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
    },
    async signOut() {
      await supabase.auth.signOut()
    }
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
