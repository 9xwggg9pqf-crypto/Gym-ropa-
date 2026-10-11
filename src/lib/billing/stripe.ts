import 'server-only'
import Stripe from 'stripe'
import { serverEnv } from '@/lib/env'

let stripe: Stripe | null = null
export function getStripe(): Stripe | null {
  const key = serverEnv().stripeSecret
  if (!key) return null
  if (!stripe) stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20_000 })
  return stripe
}

export function isBillingConfigured(): boolean {
  const e = serverEnv()
  return Boolean(e.stripeSecret && e.stripeWebhookSecret)
}
