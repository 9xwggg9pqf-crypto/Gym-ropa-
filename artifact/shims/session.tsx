'use client'
// Sustituto de src/lib/session: la "cuenta" es la de claude.ai de quien abre el artefacto.
import type { User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProfileRow } from '@/lib/api-types'
import { cap, userId } from './runtime'
import { profileDoc } from './store'

interface SessionState {
  configured: boolean
  loading: boolean
  user: User | null
  profile: ProfileRow | null
  isGuest: boolean
  refreshProfile: () => Promise<void>
  ensureSession: () => Promise<{ ok: true } | { ok: false; reason: string }>
  signOut: () => Promise<void>
}

export function defaultProfile(id: string): ProfileRow {
  return {
    id,
    display_name: null,
    locale: 'es',
    region: 'ES',
    profile_type: 'cotidiana',
    cooking_level: 'basico',
    usual_minutes: null,
    budget: null,
    default_servings: 1,
    allergies: [],
    intolerances: [],
    diets: [],
    dislikes: [],
    favorites: [],
    default_targets: null,
    personalization_consent: false,
  }
}

const Ctx = createContext<SessionState | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [configured, setConfigured] = useState(true)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileRow | null>(null)

  const load = useCallback(async () => {
    const [db, id] = await Promise.all([cap('db'), userId()])
    if (!db || !id) {
      setConfigured(false)
      setLoading(false)
      return
    }
    setUser({ id, email: undefined, is_anonymous: false } as unknown as User)
    const ref = await profileDoc()
    const snap = ref ? await ref.get().catch(() => null) : null
    setProfile(snap?.exists ? { ...defaultProfile(id), ...(snap.data() as Partial<ProfileRow>), id } : defaultProfile(id))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const value = useMemo<SessionState>(
    () => ({
      configured,
      loading,
      user,
      profile,
      isGuest: false,
      refreshProfile: load,
      ensureSession: async () => (user ? { ok: true } : { ok: false, reason: 'Abre la app desde claude.ai con tu sesión iniciada para guardar datos y usar la IA.' }),
      signOut: async () => {},
    }),
    [configured, loading, user, profile, load],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSession fuera de SessionProvider')
  return v
}
