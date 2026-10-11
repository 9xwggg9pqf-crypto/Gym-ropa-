import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { publicEnv } from '@/lib/env'

export const runtime = 'nodejs'

// Portal de cliente de Stripe: cambiar tarjeta, ver facturas, cancelar.
export async function POST() {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  if (!isBillingConfigured()) return jsonError(503, 'billing_not_configured', 'Los pagos todavía no están activados.')
  const { data: sub } = await auth.supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', auth.user.id).maybeSingle()
  if (!sub?.stripe_customer_id) return jsonError(404, 'no_customer', 'No tienes ninguna suscripción que gestionar.')
  try {
    const session = await getStripe()!.billingPortal.sessions.create({ customer: sub.stripe_customer_id as string, return_url: `${publicEnv.siteUrl}/perfil` })
    return NextResponse.json({ url: session.url })
  } catch {
    return jsonError(502, 'billing_error', 'No se ha podido abrir el portal de pagos.')
  }
}
