'use client'
import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { getSupabaseBrowser } from '@/lib/supabase/client'
import type { ProfileRow } from '@/lib/api-types'

interface SessionState {
  configured: boolean
  loading: boolean
  user: User | null
  profile: ProfileRow | null
  isGuest: boolean
  refreshProfile: () => Promise<void>
  /** Garantiza una sesión: si no hay, crea una cuenta de invitado (anónima). */
  ensureSession: () => Promise<{ ok: true } | { ok: false; reason: string }>
  signOut: () => Promise<void>
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabaseBrowser()
  const [loading, setLoading] = useState(Boolean(supabase))
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const loadProfile = useCallback(
    async (u: User | null) => {
      if (!supabase || !u) {
        setProfile(null)
        return
      }
      const { data } = await supabase.from('profiles').select('*').eq('id', u.id).maybeSingle()
      setProfile((data as ProfileRow | null) ?? null)
    },
    [supabase],
  )

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active) return
      setUser(data.user ?? null)
      await loadProfile(data.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session: Session | null) => {
      setUser(session?.user ?? null)
      void loadProfile(session?.user ?? null)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [supabase, loadProfile])

  const ensureSession = useCallback(async (): Promise<{ ok: true } | { ok: false; reason: string }> => {
    if (!supabase) return { ok: false, reason: 'La base de datos no está configurada (Supabase).' }
    const { data } = await supabase.auth.getUser()
    if (data.user) return { ok: true }
    const { data: anon, error } = await supabase.auth.signInAnonymously()
    if (error || !anon.user) return { ok: false, reason: 'No se ha podido iniciar una sesión de invitado. Entra con tu email para continuar.' }
    setUser(anon.user)
    await loadProfile(anon.user)
    return { ok: true }
  }, [supabase, loadProfile])

  const value = useMemo<SessionState>(
    () => ({
      configured: Boolean(supabase),
      loading,
      user,
      profile,
      isGuest: Boolean(user?.is_anonymous),
      refreshProfile: () => loadProfile(user),
      ensureSession,
      signOut: async () => {
        await supabase?.auth.signOut()
        setUser(null)
        setProfile(null)
      },
    }),
    [supabase, loading, user, profile, loadProfile, ensureSession],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession fuera de SessionProvider')
  return v
}
