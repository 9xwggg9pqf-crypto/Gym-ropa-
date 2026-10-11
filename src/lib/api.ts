import 'server-only'
import { NextResponse } from 'next/server'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { AIError } from '@/lib/ai/client'
import { createSupabaseAdmin, getSessionUser } from '@/lib/supabase/server'
import type { Unit } from '@/lib/nutrition/types'
import type { PantryEntry } from '@/lib/recipes/enrich'
import { logEvent } from '@/lib/log'

export function jsonError(status: number, code: string, message: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, ...extra } }, { status })
}

export type AuthedContext = { supabase: SupabaseClient; user: User }

export async function requireUser(): Promise<AuthedContext | NextResponse> {
  const { supabase, user } = await getSessionUser()
  if (!supabase) return jsonError(503, 'not_configured', 'La base de datos no está configurada todavía (Supabase).')
  if (!user) return jsonError(401, 'unauthenticated', 'Necesitas iniciar sesión o empezar como invitado.')
  return { supabase, user }
}

export type { ProfileRow } from '@/lib/api-types'
import type { ProfileRow } from '@/lib/api-types'

export { toDietaryProfileClient as toDietaryProfile } from '@/lib/profile'

export async function loadProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  return (data as ProfileRow | null) ?? null
}

export async function loadPantry(supabase: SupabaseClient): Promise<PantryEntry[]> {
  const { data } = await supabase.from('pantry_items').select('name, food_key, quantity, unit, status').limit(500)
  return (data ?? []).map((r) => ({ name: r.name as string, foodKey: (r.food_key as string | null) ?? null, quantity: r.quantity === null ? null : Number(r.quantity), unit: r.unit as Unit, status: r.status as PantryEntry['status'] }))
}

type QuotaKind = 'scan' | 'generate' | 'adapt'
interface QuotaResult {
  allowed: boolean
  reason?: 'quota' | 'rate'
  event_id?: number
  plan: string
  used: number
  limit: number
}

/**
 * Consume cuota antes de una operación costosa y la devuelve si la operación
 * falla (para no cobrar al usuario por errores del proveedor).
 */
export async function withQuota<T>(ctx: AuthedContext, kind: QuotaKind, fn: () => Promise<{ result: T; usage?: { model: string; inputTokens: number; outputTokens: number } }>): Promise<NextResponse> {
  const { data, error } = await ctx.supabase.rpc('consume_quota', { p_kind: kind })
  if (error) {
    logEvent('error', 'quota_rpc_failed', { kind, code: error.code })
    return jsonError(503, 'quota_unavailable', 'No se ha podido comprobar tu cuota de uso. Inténtalo de nuevo.')
  }
  const q = data as QuotaResult
  if (!q.allowed) {
    if (q.reason === 'rate') return jsonError(429, 'rate_limited', 'Vas muy rápido. Espera un minuto antes de volver a intentarlo.')
    return jsonError(402, 'quota_exceeded', `Has usado ${q.used} de ${q.limit} este mes en tu plan. Puedes pasarte a Premium o esperar al próximo mes.`, { plan: q.plan })
  }
  const admin = createSupabaseAdmin()
  try {
    const { result, usage } = await fn()
    if (admin && usage && q.event_id) {
      await admin.rpc('record_usage_tokens', { p_event_id: q.event_id, p_model: usage.model, p_in: usage.inputTokens, p_out: usage.outputTokens })
    }
    return NextResponse.json({ ...result, quota: { plan: q.plan, used: q.used, limit: q.limit } })
  } catch (err) {
    if (admin && q.event_id) await admin.rpc('release_quota', { p_event_id: q.event_id })
    if (err instanceof AIError) {
      logEvent('warn', 'ai_error', { kind, code: err.code })
      return jsonError(err.httpStatus, err.code, err.message, { retryable: err.retryable })
    }
    logEvent('error', 'operation_failed', { kind, message: err instanceof Error ? err.message : 'unknown' })
    return jsonError(500, 'internal', 'Ha ocurrido un error inesperado. Inténtalo de nuevo.', { retryable: true })
  }
}
