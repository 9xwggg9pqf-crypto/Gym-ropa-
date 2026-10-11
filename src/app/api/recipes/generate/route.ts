import { jsonError, loadPantry, loadProfile, requireUser, toDietaryProfile, withQuota } from '@/lib/api'
import { GenerateInput, generateRecipes } from '@/lib/ai/recipes'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  const body = await request.json().catch(() => null)
  const parsed = GenerateInput.safeParse(body)
  if (!parsed.success) return jsonError(400, 'bad_request', 'Datos de la petición no válidos.', { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) })
  const input = parsed.data

  const [profile, pantry] = await Promise.all([loadProfile(auth.supabase, auth.user.id), loadPantry(auth.supabase)])
  let favoriteRecipes: string[] = []
  if (profile?.personalization_consent) {
    const { data } = await auth.supabase.from('recipes').select('title').eq('is_favorite', true).order('updated_at', { ascending: false }).limit(10)
    favoriteRecipes = (data ?? []).map((r) => String(r.title).slice(0, 80))
  }
  const kind = input.mode === 'plato_concreto' || input.targets ? 'adapt' : 'generate'

  return withQuota(auth, kind, async () => {
    const r = await generateRecipes(input, {
      profile: toDietaryProfile(profile),
      pantry,
      locale: profile?.locale ?? 'es',
      cookingLevel: profile?.cooking_level,
      budget: profile?.budget,
      usualMinutes: profile?.usual_minutes,
      defaultServings: profile?.default_servings,
      favorites: profile?.favorites,
      favoriteRecipes,
    })
    if (input.request.trim()) {
      await auth.supabase.from('search_history').insert({ query: input.request.trim().slice(0, 500), kind: input.mode === 'plato_concreto' ? 'dish' : 'ingredients' })
    }
    const { usage, ...result } = r
    return { result, usage }
  })
}
