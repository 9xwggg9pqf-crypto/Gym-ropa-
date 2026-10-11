import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/api'

export const runtime = 'nodejs'

// Exporta todos los datos del usuario (derecho de acceso y portabilidad).
export async function GET() {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  const s = auth.supabase
  const tables = ['profiles', 'recipes', 'collections', 'collection_recipes', 'pantry_items', 'meal_plan_entries', 'shopping_items', 'search_history', 'custom_foods', 'subscriptions', 'usage_events'] as const
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), account: { id: auth.user.id, email: auth.user.email ?? null } }
  for (const t of tables) {
    const { data } = await s.from(t).select('*').limit(10000)
    out[t] = data ?? []
  }
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': `attachment; filename="snackeats-datos-${new Date().toISOString().slice(0, 10)}.json"`,
      'cache-control': 'no-store',
    },
  })
}
