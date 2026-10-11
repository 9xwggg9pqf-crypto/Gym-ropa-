import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { getStripe, isBillingConfigured } from '@/lib/billing/stripe'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { publicEnv } from '@/lib/env'

export const runtime = 'nodejs'

// Crea una sesión de Stripe Checkout para el plan indicado. El acceso Premium
// sólo se activa cuando llega el webhook firmado de Stripe, nunca desde aquí.
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  if (!isBillingConfigured()) return jsonError(503, 'billing_not_configured', 'Los pagos todavía no están activados.')
  if (auth.user.is_anonymous) return jsonError(403, 'account_required', 'Crea una cuenta con tu email antes de suscribirte.')
  const { planId } = ((await request.json().catch(() => ({}))) as { planId?: string })
  const { data: plan } = await auth.supabase.from('plans').select('id, stripe_price_id, active').eq('id', planId ?? 'premium').maybeSingle()
  if (!plan?.active || !plan.stripe_price_id) return jsonError(400, 'plan_unavailable', 'Este plan no está disponible para contratar todavía.')

  const stripe = getStripe()!
  const admin = createSupabaseAdmin()
  if (!admin) return jsonError(503, 'not_configured', 'Falta SUPABASE_SERVICE_ROLE_KEY en el servidor.')
  const { data: sub } = await admin.from('subscriptions').select('stripe_customer_id, status').eq('user_id', auth.user.id).maybeSingle()
  if (sub && ['active', 'trialing', 'past_due'].includes(sub.status as string)) return jsonError(409, 'already_subscribed', 'Ya tienes una suscripción. Gestiónala desde tu perfil.')

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: plan.stripe_price_id as string, quantity: 1 }],
      customer: (sub?.stripe_customer_id as string | undefined) ?? undefined,
      customer_email: sub?.stripe_customer_id ? undefined : auth.user.email ?? undefined,
      client_reference_id: auth.user.id,
      subscription_data: { metadata: { user_id: auth.user.id, plan_id: plan.id as string } },
      metadata: { user_id: auth.user.id, plan_id: plan.id as string },
      allow_promotion_codes: true,
      success_url: `${publicEnv.siteUrl}/planes?estado=ok`,
      cancel_url: `${publicEnv.siteUrl}/planes?estado=cancelado`,
    })
    return NextResponse.json({ url: session.url })
  } catch {
    return jsonError(502, 'billing_error', 'No se ha podido iniciar el pago. Inténtalo de nuevo.')
  }
}
