import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { getStripe } from '@/lib/billing/stripe'
import { logEvent } from '@/lib/log'

export const runtime = 'nodejs'

// Elimina la cuenta y TODOS sus datos (borrado en cascada en la base de datos).
// Si hay una suscripción activa en Stripe, se cancela antes.
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  const body = (await request.json().catch(() => ({}))) as { confirm?: string }
  if (body.confirm !== 'ELIMINAR') return jsonError(400, 'confirmation_required', 'Escribe ELIMINAR para confirmar.')
  const admin = createSupabaseAdmin()
  if (!admin) return jsonError(503, 'not_configured', 'El borrado de cuentas requiere configurar SUPABASE_SERVICE_ROLE_KEY en el servidor.')

  const { data: sub } = await admin.from('subscriptions').select('stripe_subscription_id, status').eq('user_id', auth.user.id).maybeSingle()
  if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status as string)) {
    const stripe = getStripe()
    if (!stripe) return jsonError(503, 'billing_unavailable', 'Tienes una suscripción activa y no podemos cancelarla ahora. Inténtalo más tarde.')
    try {
      await stripe.subscriptions.cancel(sub.stripe_subscription_id as string)
    } catch {
      return jsonError(502, 'billing_error', 'No se ha podido cancelar tu suscripción. No se ha borrado nada; inténtalo de nuevo.')
    }
  }
  const { error } = await admin.auth.admin.deleteUser(auth.user.id)
  if (error) {
    logEvent('error', 'account_delete_failed', { code: error.code ?? 'unknown' })
    return jsonError(500, 'delete_failed', 'No se ha podido eliminar la cuenta. Inténtalo de nuevo.')
  }
  await auth.supabase.auth.signOut()
  return NextResponse.json({ deleted: true })
}
