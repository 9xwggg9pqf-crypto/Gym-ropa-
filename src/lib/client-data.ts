'use client'
// Acceso a datos desde el navegador. Todas las consultas pasan por las
// políticas RLS de Supabase: cada usuario sólo puede leer y modificar lo suyo.
import { getSupabaseBrowser } from '@/lib/supabase/client'
import type { CustomFoodRow, MealPlanRow, PantryRow, PlanRow, ProfileRow, RecipeRow, ShoppingRowDb } from '@/lib/api-types'
import type { Food, MealTargets, Recipe } from '@/lib/nutrition/types'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; retryable?: boolean }

function db() {
  const s = getSupabaseBrowser()
  if (!s) throw new Error('not_configured')
  return s
}

async function run<T>(fn: () => PromiseLike<{ data: T | null; error: { message: string; code?: string } | null }>, fallback = 'No se ha podido completar la operación.'): Promise<Result<T>> {
  try {
    const { data, error } = await fn()
    if (error) return { ok: false, error: friendly(error.message) ?? fallback, code: error.code }
    return { ok: true, data: data as T }
  } catch (e) {
    if (e instanceof Error && e.message === 'not_configured') return { ok: false, error: 'La base de datos no está configurada.', code: 'not_configured' }
    return { ok: false, error: 'Sin conexión con el servidor. Inténtalo de nuevo.', retryable: true }
  }
}

function friendly(msg: string): string | null {
  if (msg.includes('saved_recipes_limit')) return 'Has alcanzado el máximo de recetas guardadas de tu plan.'
  if (msg.includes('JWT') || msg.includes('not authenticated')) return 'Tu sesión ha caducado. Vuelve a entrar.'
  if (msg.includes('violates check constraint')) return 'Algún dato no es válido. Revisa los campos.'
  return null
}

// ── Llamadas a la API propia ────────────────────────────────────────────────
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<Result<T>> {
  try {
    const res = await fetch(url, {
      ...init,
      headers: init?.json !== undefined ? { 'content-type': 'application/json', ...(init?.headers ?? {}) } : init?.headers,
      body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) {
      const err = body?.error ?? {}
      return { ok: false, error: err.message ?? `Error ${res.status}`, code: err.code, retryable: err.retryable ?? res.status >= 500 }
    }
    return { ok: true, data: body as T }
  } catch {
    return { ok: false, error: 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.', retryable: true }
  }
}

// ── Perfil ──────────────────────────────────────────────────────────────────
export const updateProfile = (id: string, patch: Partial<ProfileRow>) => run<ProfileRow>(() => db().from('profiles').update(patch).eq('id', id).select('*').single())

// ── Recetas ─────────────────────────────────────────────────────────────────
const RECIPE_LIST = 'id, title, data, servings, kcal_per_serving, protein_per_serving, carbs_per_serving, fat_per_serving, targets, source, parent_id, version, is_favorite, image_url, image_credit, last_cooked_at, created_at, updated_at'
export const listRecipes = () => run<RecipeRow[]>(() => db().from('recipes').select(RECIPE_LIST).order('created_at', { ascending: false }).limit(500))
export const getRecipe = (id: string) => run<RecipeRow>(() => db().from('recipes').select(RECIPE_LIST).eq('id', id).single(), 'No se ha encontrado la receta.')
export const listVersions = (rootId: string) => run<RecipeRow[]>(() => db().from('recipes').select(RECIPE_LIST).or(`id.eq.${rootId},parent_id.eq.${rootId}`).order('version'))
export const setFavorite = (id: string, value: boolean) => run<null>(() => db().from('recipes').update({ is_favorite: value }).eq('id', id))
export const deleteRecipe = (id: string) => run<null>(() => db().from('recipes').delete().eq('id', id))
export const markCooked = (id: string) => run<null>(() => db().from('recipes').update({ last_cooked_at: new Date().toISOString() }).eq('id', id))

export function saveRecipe(input: { recipe: Recipe; targets?: MealTargets | null; source?: 'ai' | 'manual' | 'adapted'; parentId?: string | null; imageUrl?: string | null; imageCredit?: string | null }) {
  return api<{ id: string }>('/api/recipes', { method: 'POST', json: input })
}

/** Actualiza una receta propia. La ficha nutricional se recalcula en el cliente con el mismo motor determinista. */
export const updateRecipeData = (id: string, recipe: Recipe, snapshot: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }, targets: MealTargets | null) =>
  run<null>(() =>
    db()
      .from('recipes')
      .update({ title: recipe.title, data: recipe, servings: recipe.servings, kcal_per_serving: snapshot.kcal, protein_per_serving: snapshot.protein, carbs_per_serving: snapshot.carbs, fat_per_serving: snapshot.fat, targets })
      .eq('id', id),
  )

// ── Colecciones ─────────────────────────────────────────────────────────────
export const listCollections = () => run<{ id: string; name: string; collection_recipes: { recipe_id: string }[] }[]>(() => db().from('collections').select('id, name, collection_recipes(recipe_id)').order('created_at'))
export const createCollection = (name: string) => run<{ id: string }>(() => db().from('collections').insert({ name }).select('id').single())
export const deleteCollection = (id: string) => run<null>(() => db().from('collections').delete().eq('id', id))
export const addToCollection = (collectionId: string, recipeId: string) => run<null>(() => db().from('collection_recipes').upsert({ collection_id: collectionId, recipe_id: recipeId }))
export const removeFromCollection = (collectionId: string, recipeId: string) => run<null>(() => db().from('collection_recipes').delete().eq('collection_id', collectionId).eq('recipe_id', recipeId))

// ── Despensa ────────────────────────────────────────────────────────────────
export const listPantry = () => run<PantryRow[]>(() => db().from('pantry_items').select('*').order('created_at', { ascending: false }).limit(500))
export const insertPantry = (rows: Partial<PantryRow>[]) => run<PantryRow[]>(() => db().from('pantry_items').insert(rows).select('*'))
export const updatePantry = (id: string, patch: Partial<PantryRow>) => run<PantryRow>(() => db().from('pantry_items').update(patch).eq('id', id).select('*').single())
export const deletePantry = (id: string) => run<null>(() => db().from('pantry_items').delete().eq('id', id))

// ── Lista de la compra ──────────────────────────────────────────────────────
export const listShopping = () => run<ShoppingRowDb[]>(() => db().from('shopping_items').select('*').order('category').order('name').limit(1000))
export const insertShopping = (rows: Partial<ShoppingRowDb>[]) => run<ShoppingRowDb[]>(() => db().from('shopping_items').insert(rows).select('*'))
export const updateShopping = (id: string, patch: Partial<ShoppingRowDb>) => run<null>(() => db().from('shopping_items').update(patch).eq('id', id))
export const deleteShopping = (ids: string[]) => run<null>(() => db().from('shopping_items').delete().in('id', ids))

// ── Planificador ────────────────────────────────────────────────────────────
export const listPlan = (from: string, to: string) => run<MealPlanRow[]>(() => db().from('meal_plan_entries').select('id, plan_date, slot, position, recipe_id, servings').gte('plan_date', from).lte('plan_date', to).order('plan_date').order('position'))
export const insertPlan = (rows: Omit<MealPlanRow, 'id' | 'position'>[]) => run<MealPlanRow[]>(() => db().from('meal_plan_entries').insert(rows).select('id, plan_date, slot, position, recipe_id, servings'))
export const updatePlan = (id: string, patch: Partial<MealPlanRow>) => run<null>(() => db().from('meal_plan_entries').update(patch).eq('id', id))
export const deletePlan = (id: string) => run<null>(() => db().from('meal_plan_entries').delete().eq('id', id))

// ── Historial ───────────────────────────────────────────────────────────────
export const listHistory = () => run<{ id: string; query: string; kind: string; created_at: string }[]>(() => db().from('search_history').select('*').order('created_at', { ascending: false }).limit(50))
export const deleteHistory = (id: string) => run<null>(() => db().from('search_history').delete().eq('id', id))
export const clearHistory = (userId: string) => run<null>(() => db().from('search_history').delete().eq('user_id', userId))

// ── Alimentos personalizados ────────────────────────────────────────────────
export const listCustomFoods = () => run<CustomFoodRow[]>(() => db().from('custom_foods').select('*').order('name'))
export const insertCustomFood = (row: Omit<CustomFoodRow, 'id'>) => run<CustomFoodRow>(() => db().from('custom_foods').insert(row).select('*').single())
export const deleteCustomFood = (id: string) => run<null>(() => db().from('custom_foods').delete().eq('id', id))

export function customFoodToFood(r: CustomFoodRow): Food {
  return {
    key: `custom:${r.id}`,
    fdcId: null,
    name: r.name,
    aliases: [],
    usdaDescription: null,
    category: 'otros',
    group: 'other',
    state: 'prepared',
    allergens: r.allergens as Food['allergens'],
    mayContain: [],
    animal: null,
    per100g: { kcal: Number(r.kcal), protein: Number(r.protein), carbs: Number(r.carbs), fat: Number(r.fat), fiber: r.fiber === null ? null : Number(r.fiber), sugars: r.sugars === null ? null : Number(r.sugars), satFat: r.sat_fat === null ? null : Number(r.sat_fat), sodiumMg: r.sodium_mg === null ? null : Number(r.sodium_mg) },
    portions: { unit: r.unit_grams ? { name: 'unidad', grams: Number(r.unit_grams) } : null, tbspG: null, tspG: null, cupG: null, densityGPerMl: null },
    source: 'custom_label',
  }
}

// ── Planes y uso ────────────────────────────────────────────────────────────
export const listPlans = () => run<PlanRow[]>(() => db().from('plans').select('*').order('sort'))
export const usageSummary = () => run<{ plan: string; limits: Record<string, number>; used: Record<string, number>; saved_recipes: number }>(() => db().rpc('usage_summary'))
export const getSubscription = () => run<{ plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null>(() => db().from('subscriptions').select('plan_id, status, current_period_end, cancel_at_period_end').maybeSingle())
