'use client'
// Sustituto de src/lib/client-data.ts para la versión de prueba: mismas funciones,
// pero sobre el almacén privado del artefacto en lugar de Supabase.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { CustomFoodRow, MealPlanRow, PantryRow, PlanRow, ProfileRow, RecipeRow, ShoppingRowDb } from '@/lib/api-types'
import type { Food, MealTargets, Recipe } from '@/lib/nutrition/types'
import { computeNutrition } from '@/lib/nutrition/compute'
import { getOne, insertOne, listAll, patchOne, profileDoc, removeOne, clean } from './store'
import { handleApi } from './api-handlers'

export type Result<T> = { ok: true; data: T } | { ok: false; error: string; code?: string; retryable?: boolean }

async function run<T>(fn: () => Promise<T>, fallback = 'No se ha podido completar la operación.'): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() }
  } catch (e: any) {
    if (e?.message === 'not_configured') return { ok: false, error: 'Abre la app desde claude.ai con tu sesión iniciada para guardar datos.', code: 'not_configured' }
    if (e?.code === 'quota_exceeded') return { ok: false, error: 'Se ha llenado el espacio de la versión de prueba. Borra algunos datos.', code: 'quota_exceeded' }
    return { ok: false, error: fallback, retryable: true }
  }
}

// ── API propia (rutas /api/* simuladas en el navegador) ─────────────────────
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<Result<T>> {
  const res = await handleApi(url, init?.method ?? 'GET', init?.json, init?.body)
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    const err = body?.error ?? {}
    return { ok: false, error: err.message ?? `Error ${res.status}`, code: err.code, retryable: err.retryable ?? res.status >= 500 }
  }
  return { ok: true, data: body as T }
}

// ── Perfil ──────────────────────────────────────────────────────────────────
export const updateProfile = (id: string, patch: Partial<ProfileRow>) =>
  run(async () => {
    const ref = await profileDoc()
    if (!ref) throw new Error('not_configured')
    const s = await ref.get()
    const body = clean({ ...(s.exists ? s.data() : {}), ...patch, id })
    await ref.set(body)
    return body as ProfileRow
  })

// ── Recetas ─────────────────────────────────────────────────────────────────
const byNewest = (a: { created_at: string }, b: { created_at: string }) => b.created_at.localeCompare(a.created_at)
export const listRecipes = () => run(async () => (await listAll<RecipeRow>('recipes')).sort(byNewest))
export const getRecipe = (id: string) =>
  run(async () => {
    const r = await getOne<RecipeRow>('recipes', id)
    if (!r) throw new Error('not_found')
    return r
  }, 'No se ha encontrado la receta.')
export const listVersions = (rootId: string) => run(async () => (await listAll<RecipeRow>('recipes')).filter((r) => r.id === rootId || r.parent_id === rootId).sort((a, b) => a.version - b.version))
export const setFavorite = (id: string, value: boolean) => run(async () => (await patchOne<RecipeRow>('recipes', id, { is_favorite: value }), null))
export const deleteRecipe = (id: string) =>
  run(async () => {
    await removeOne('recipes', id)
    for (const p of await listAll<MealPlanRow>('plan')) if (p.recipe_id === id) await removeOne('plan', p.id)
    for (const r of await listAll<RecipeRow>('recipes')) if (r.parent_id === id) await patchOne<RecipeRow>('recipes', r.id, { parent_id: null })
    return null
  })
export const markCooked = (id: string) => run(async () => (await patchOne<RecipeRow>('recipes', id, { last_cooked_at: new Date().toISOString() }), null))

export async function saveRecipe(input: { recipe: Recipe; targets?: MealTargets | null; source?: 'ai' | 'manual' | 'adapted'; parentId?: string | null; imageUrl?: string | null; imageCredit?: string | null }): Promise<Result<{ id: string }>> {
  return api<{ id: string }>('/api/recipes', { method: 'POST', json: input })
}

export const updateRecipeData = (id: string, recipe: Recipe, snapshot: { kcal: number | null; protein: number | null; carbs: number | null; fat: number | null }, targets: MealTargets | null) =>
  run(async () => {
    await patchOne<RecipeRow>('recipes', id, { title: recipe.title, data: recipe, servings: recipe.servings, kcal_per_serving: snapshot.kcal, protein_per_serving: snapshot.protein, carbs_per_serving: snapshot.carbs, fat_per_serving: snapshot.fat, targets })
    return null
  })

/** Guarda una receta (usado por la ruta /api/recipes simulada). */
export async function insertRecipe(input: { recipe: Recipe; targets?: MealTargets | null; source?: 'ai' | 'manual' | 'adapted'; parentId?: string | null }) {
  const n = computeNutrition(input.recipe.ingredients, input.recipe.servings)
  let version = 1
  if (input.parentId) {
    const all = await listAll<RecipeRow>('recipes')
    const parent = all.find((r) => r.id === input.parentId)
    if (!parent) throw new Error('not_found')
    version = parent.version + all.filter((r) => r.parent_id === input.parentId).length + 1
  }
  const now = new Date().toISOString()
  return insertOne<Record<string, unknown>>('recipes', {
    title: input.recipe.title,
    data: input.recipe,
    servings: input.recipe.servings,
    kcal_per_serving: n.perServing.kcal,
    protein_per_serving: n.perServing.protein,
    carbs_per_serving: n.perServing.carbs,
    fat_per_serving: n.perServing.fat,
    targets: input.targets ?? null,
    source: input.source ?? 'ai',
    parent_id: input.parentId ?? null,
    version,
    is_favorite: false,
    image_url: null,
    image_credit: null,
    last_cooked_at: null,
    created_at: now,
    updated_at: now,
  })
}

// ── Colecciones ─────────────────────────────────────────────────────────────
type CollectionDoc = { id: string; name: string; recipe_ids: string[]; created_at: string }
export const listCollections = () =>
  run(async () =>
    (await listAll<CollectionDoc>('collections'))
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((c) => ({ id: c.id, name: c.name, collection_recipes: (c.recipe_ids ?? []).map((recipe_id) => ({ recipe_id })) })),
  )
export const createCollection = (name: string) => run(async () => ({ id: (await insertOne('collections', { name: name.slice(0, 60), recipe_ids: [] })).id }))
export const deleteCollection = (id: string) => run(async () => (await removeOne('collections', id), null))
export const addToCollection = (collectionId: string, recipeId: string) =>
  run(async () => {
    const c = await getOne<CollectionDoc>('collections', collectionId)
    if (c && !c.recipe_ids.includes(recipeId)) await patchOne<CollectionDoc>('collections', collectionId, { recipe_ids: [...c.recipe_ids, recipeId] })
    return null
  })
export const removeFromCollection = (collectionId: string, recipeId: string) =>
  run(async () => {
    const c = await getOne<CollectionDoc>('collections', collectionId)
    if (c) await patchOne<CollectionDoc>('collections', collectionId, { recipe_ids: c.recipe_ids.filter((x) => x !== recipeId) })
    return null
  })

// ── Despensa ────────────────────────────────────────────────────────────────
const PANTRY_DEFAULTS = { food_key: null, quantity: null, unit: 'g', location: 'despensa', status: 'disponible', food_state: null, purchased_on: null, expires_on: null, date_kind: null, use_first: false, low_threshold: null }
export const listPantry = () => run(async () => (await listAll<PantryRow>('pantry')).sort(byNewest))
export const insertPantry = (rows: Partial<PantryRow>[]) => run(async () => Promise.all(rows.map((r) => insertOne('pantry', { ...PANTRY_DEFAULTS, ...r } as Record<string, unknown>))) as unknown as Promise<PantryRow[]>)
export const updatePantry = (id: string, patch: Partial<PantryRow>) =>
  run(async () => {
    const r = await patchOne<PantryRow>('pantry', id, patch)
    if (!r) throw new Error('not_found')
    return r
  })
export const deletePantry = (id: string) => run(async () => (await removeOne('pantry', id), null))

// ── Lista de la compra ──────────────────────────────────────────────────────
export const listShopping = () => run(async () => (await listAll<ShoppingRowDb>('shopping')).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)))
export const insertShopping = (rows: Partial<ShoppingRowDb>[]) => run(async () => Promise.all(rows.map((r) => insertOne('shopping', { item_key: null, quantity: null, unit: 'g', category: 'otros', checked: false, source: 'manual', ...r } as Record<string, unknown>))) as unknown as Promise<ShoppingRowDb[]>)
export const updateShopping = (id: string, patch: Partial<ShoppingRowDb>) => run(async () => (await patchOne<ShoppingRowDb>('shopping', id, patch), null))
export const deleteShopping = (ids: string[]) =>
  run(async () => {
    for (const id of ids) await removeOne('shopping', id)
    return null
  })

// ── Planificador ────────────────────────────────────────────────────────────
export const listPlan = (from: string, to: string) => run(async () => (await listAll<MealPlanRow>('plan')).filter((p) => p.plan_date >= from && p.plan_date <= to).sort((a, b) => a.plan_date.localeCompare(b.plan_date) || a.position - b.position))
export const insertPlan = (rows: Omit<MealPlanRow, 'id' | 'position'>[]) => run(async () => Promise.all(rows.map((r, i) => insertOne('plan', { ...r, position: Date.now() + i } as Record<string, unknown>))) as unknown as Promise<MealPlanRow[]>)
export const updatePlan = (id: string, patch: Partial<MealPlanRow>) => run(async () => (await patchOne<MealPlanRow>('plan', id, patch), null))
export const deletePlan = (id: string) => run(async () => (await removeOne('plan', id), null))

// ── Historial ───────────────────────────────────────────────────────────────
type HistoryRow = { id: string; query: string; kind: string; created_at: string }
export const listHistory = () => run(async () => (await listAll<HistoryRow>('history')).sort(byNewest).slice(0, 50))
export const deleteHistory = (id: string) => run(async () => (await removeOne('history', id), null))
export const clearHistory = (_userId: string) =>
  run(async () => {
    for (const h of await listAll<HistoryRow>('history')) await removeOne('history', h.id)
    return null
  })
export async function addHistory(query: string, kind: 'dish' | 'ingredients' | 'scan') {
  try {
    const all = (await listAll<HistoryRow>('history')).sort(byNewest)
    for (const old of all.slice(49)) await removeOne('history', old.id)
    await insertOne('history', { query: query.slice(0, 500), kind })
  } catch {
    /* el historial es opcional */
  }
}

// ── Alimentos personalizados ────────────────────────────────────────────────
export const listCustomFoods = () => run(async () => (await listAll<CustomFoodRow>('foods')).sort((a, b) => a.name.localeCompare(b.name)))
export const insertCustomFood = (row: Omit<CustomFoodRow, 'id'>) => run(async () => (await insertOne('foods', row as unknown as Record<string, unknown>)) as unknown as CustomFoodRow)
export const deleteCustomFood = (id: string) => run(async () => (await removeOne('foods', id), null))

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

// ── Planes y uso (en la versión de prueba no hay cuotas ni pagos) ───────────
export const listPlans = () =>
  run(async (): Promise<PlanRow[]> => [
    { id: 'free', name: 'Gratis', description: 'Para cocinar mejor cada día', price_cents: 0, currency: 'eur', billing_interval: null, stripe_price_id: null, limits: {}, features: ['Versión de prueba: sin límites de la app (usa tu cuenta de Claude)'], sort: 1 },
    { id: 'premium', name: 'Premium', description: 'Para quien cocina con objetivos', price_cents: 499, currency: 'eur', billing_interval: 'month', stripe_price_id: null, limits: {}, features: ['Los pagos no están activos en la versión de prueba'], sort: 2 },
  ])
export const usageSummary = () =>
  run(async () => ({ plan: 'free', limits: { scan: 999, generate: 999, adapt: 999, saved_recipes: 999 }, used: {}, saved_recipes: (await listAll<RecipeRow>('recipes')).length }))
export const getSubscription = () => run(async () => null as { plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null)
