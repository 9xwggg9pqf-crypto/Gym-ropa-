import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSupabaseConfigured, publicEnv, serverEnv } from '@/lib/env'

/** Cliente con la sesión del usuario (respeta RLS). */
export async function createSupabaseServer(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null
  const cookieStore = await cookies()
  return createServerClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // Llamado desde un Server Component: el proxy se encarga de refrescar la sesión.
        }
      },
    },
  })
}

/** Cliente de servicio (salta RLS). Sólo para webhooks, borrado de cuenta y cuotas. */
export function createSupabaseAdmin(): SupabaseClient | null {
  const key = serverEnv().serviceRoleKey
  if (!isSupabaseConfigured() || !key) return null
  return createAdmin(publicEnv.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
}

export async function getSessionUser() {
  const supabase = await createSupabaseServer()
  if (!supabase) return { supabase: null, user: null }
  const { data } = await supabase.auth.getUser()
  return { supabase, user: data.user ?? null }
}
