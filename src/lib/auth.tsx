import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, SUPABASE_ON } from './supabase'

interface AuthState {
  ready: boolean
  session: Session | null
  signIn: (email: string, pw: string) => Promise<string | null>   // null=성공, string=에러메시지
  signUp: (email: string, pw: string) => Promise<string | null>
  signOut: () => Promise<void>
  email: string | null
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(!SUPABASE_ON)  // 로컬 모드면 즉시 준비완료

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  const value: AuthState = {
    ready,
    session,
    email: session?.user?.email ?? null,
    signIn: async (email, pw) => {
      if (!supabase) return null
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
      return error ? error.message : null
    },
    signUp: async (email, pw) => {
      if (!supabase) return null
      const { error } = await supabase.auth.signUp({ email: email.trim(), password: pw })
      return error ? error.message : null
    },
    signOut: async () => { await supabase?.auth.signOut() },
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const s = useContext(Ctx)
  if (!s) throw new Error('AuthProvider missing')
  return s
}
