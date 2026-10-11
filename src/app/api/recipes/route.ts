import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { computeNutrition } from '@/lib/nutrition/compute'
import { SaveRecipeInput } from '@/lib/recipes/schema'
import type { Recipe } from '@/lib/nutrition/types'

export const runtime = 'nodejs'

// Guarda una receta. Los valores nutricionales de la ficha se RECALCULAN en el
// servidor con el motor determinista (no se confía en los que envía el cliente).
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  const parsed = SaveRecipeInput.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return jsonError(400, 'bad_request', 'La receta no es válida.', { issues: parsed.error.issues.slice(0, 5).map((i) => i.path.join('.')) })
  const { recipe, targets, source, parentId, imageUrl, imageCredit } = parsed.data
  const n = computeNutrition((recipe as Recipe).ingredients, recipe.servings)

  let version = 1
  if (parentId) {
    const { data: parent } = await auth.supabase.from('recipes').select('id, version').eq('id', parentId).maybeSingle()
    if (!parent) return jsonError(404, 'not_found', 'La receta original no existe o no es tuya.')
    const { count } = await auth.supabase.from('recipes').select('id', { count: 'exact', head: true }).eq('parent_id', parentId)
    version = (parent.version as number) + (count ?? 0) + 1
  }

  const { data, error } = await auth.supabase
    .from('recipes')
    .insert({
      title: recipe.title,
      data: recipe,
      servings: recipe.servings,
      kcal_per_serving: n.perServing.kcal,
      protein_per_serving: n.perServing.protein,
      carbs_per_serving: n.perServing.carbs,
      fat_per_serving: n.perServing.fat,
      targets: targets ?? null,
      source,
      parent_id: parentId ?? null,
      version,
      image_url: imageUrl ?? null,
      image_credit: imageCredit ?? null,
    })
    .select('id, created_at')
    .single()

  if (error) {
    if (error.message?.includes('saved_recipes_limit')) return jsonError(402, 'saved_recipes_limit', 'Has alcanzado el máximo de recetas guardadas de tu plan. Borra alguna o pásate a Premium.')
    return jsonError(500, 'save_failed', 'No se ha podido guardar la receta. Inténtalo de nuevo.')
  }
  return NextResponse.json({ id: data.id, createdAt: data.created_at, nutrition: { perServing: n.perServing, precision: n.precision } })
}
