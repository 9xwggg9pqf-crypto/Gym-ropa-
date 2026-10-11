import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/billing/stripe'
import { serverEnv } from '@/lib/env'
import { createSupabaseAdmin } from '@/lib/supabase/server'
import { logEvent } from '@/lib/log'

export const runtime = 'nodejs'

// Webhook de Stripe: ÚNICA vía para activar, renovar o cancelar Premium.
// Verifica la firma con STRIPE_WEBHOOK_SECRET antes de tocar la base de datos.
export async function POST(request: Request) {
  const stripe = getStripe()
  const secret = serverEnv().stripeWebhookSecret
  const admin = createSupabaseAdmin()
  if (!stripe || !secret || !admin) return NextResponse.json({ error: 'not_configured' }, { status: 503 })

  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'missing_signature' }, { status: 400 })
  const raw = await request.text()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch {
    logEvent('warn', 'stripe_bad_signature')
    return NextResponse.json({ error: 'invalid_signature' }, { status: 400 })
  }

  async function syncSubscription(sub: Stripe.Subscription) {
    const userId = sub.metadata?.user_id
    if (!userId) {
      logEvent('warn', 'stripe_subscription_without_user', { event: event.type })
      return
    }
    const planId = sub.metadata?.plan_id || 'premium'
    const item = sub.items.data[0]
    const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
    const { error } = await admin!.from('subscriptions').upsert({
      user_id: userId,
      plan_id: planId,
      status: sub.status,
      stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      stripe_subscription_id: sub.id,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    if (error) throw new Error(`db: ${error.code}`)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        if (session.mode === 'subscription' && session.subscription) {
          const sub = await stripe.subscriptions.retrieve(typeof session.subscription === 'string' ? session.subscription : session.subscription.id)
          await syncSubscription(sub)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'customer.subscription.paused':
      case 'customer.subscription.resumed':
        await syncSubscription(event.data.object as Stripe.Subscription)
        break
      case 'invoice.payment_failed':
        // El estado pasa a past_due mediante customer.subscription.updated; aquí sólo se registra.
        logEvent('warn', 'stripe_payment_failed')
        break
      default:
        break
    }
  } catch (err) {
    logEvent('error', 'stripe_webhook_failed', { event: event.type, message: err instanceof Error ? err.message : 'unknown' })
    // 500 → Stripe reintentará el envío.
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
  return NextResponse.json({ received: true })
}
