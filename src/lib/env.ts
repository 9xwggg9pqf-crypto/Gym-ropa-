// Comprobaciones de configuración. Nunca se exponen secretos al navegador:
// sólo las variables NEXT_PUBLIC_* llegan al cliente.

export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
}

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey)
}

export function serverEnv() {
  return {
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    anthropicKey: process.env.ANTHROPIC_API_KEY ?? '',
    anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
    fdcApiKey: process.env.FDC_API_KEY ?? '',
    stripeSecret: process.env.STRIPE_SECRET_KEY ?? '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    unsplashKey: process.env.UNSPLASH_ACCESS_KEY ?? '',
  }
}

export function integrationStatus() {
  const s = serverEnv()
  return {
    supabase: isSupabaseConfigured(),
    serviceRole: Boolean(s.serviceRoleKey),
    ai: Boolean(s.anthropicKey),
    fdc: Boolean(s.fdcApiKey),
    stripe: Boolean(s.stripeSecret && s.stripeWebhookSecret),
    photos: Boolean(s.unsplashKey),
  }
}
