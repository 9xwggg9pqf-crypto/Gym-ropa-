import { resolveFood } from './catalog'
import { toGrams } from './units'
import type { Food, NutrientKey, Nutrients, RecipeIngredient } from './types'
import { NUTRIENT_KEYS } from './types'

export interface IngredientNutrition {
  id: string
  name: string
  food: Food | undefined
  grams: number | null
  approximateQuantity: boolean
  quantityBasis: string
  nutrients: Nutrients | null
}

export type Precision = 'alta' | 'media' | 'baja'

export interface NutritionResult {
  total: Nutrients
  perServing: Nutrients
  servings: number
  lines: IngredientNutrition[]
  /** Ingredientes sin datos (no se han sumado: el total está incompleto). */
  missing: { id: string; name: string; reason: string }[]
  /** Nutrientes secundarios que faltan en alguno de los ingredientes sumados. */
  incompleteNutrients: NutrientKey[]
  /** kcal calculadas con factores de Atwater generales (4/4/9) por ración. */
  atwaterKcalPerServing: number | null
  /** Diferencia relativa entre kcal de la fuente y Atwater (informativo). */
  kcalMethodDiffPct: number | null
  precision: Precision
  notes: string[]
  sources: string[]
}

export function emptyNutrients(): Nutrients {
  return { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugars: 0, satFat: 0, sodiumMg: 0 }
}

export function nutrientsForGrams(food: Food, grams: number): Nutrients {
  const out = {} as Nutrients
  for (const k of NUTRIENT_KEYS) {
    const v = food.per100g[k]
    out[k] = v === null ? null : (v * grams) / 100
  }
  return out
}

function round(n: number | null, decimals = 1): number | null {
  if (n === null) return null
  const f = 10 ** decimals
  return Math.round(n * f) / f
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: n.kcal === null ? null : Math.round(n.kcal),
    protein: round(n.protein),
    carbs: round(n.carbs),
    fat: round(n.fat),
    fiber: round(n.fiber),
    sugars: round(n.sugars),
    satFat: round(n.satFat),
    sodiumMg: n.sodiumMg === null ? null : Math.round(n.sodiumMg),
  }
}

export function ingredientGrams(ing: RecipeIngredient): { grams: number | null; approximate: boolean; basis: string; food: Food | undefined } {
  const food = resolveFood(ing.foodKey, ing.inlineFood)
  const conv = toGrams(ing.quantity, ing.unit, food)
  return { ...conv, food }
}

/**
 * Cálculo nutricional determinista: suma los nutrientes de cada ingrediente
 * a partir de su peso real y de los datos del alimento asociado (USDA o etiqueta).
 * Nunca rellena con suposiciones: los ingredientes sin datos se listan en `missing`.
 */
export function computeNutrition(ingredients: RecipeIngredient[], servings: number): NutritionResult {
  const safeServings = Number.isFinite(servings) && servings > 0 ? servings : 1
  const total = emptyNutrients()
  const lines: IngredientNutrition[] = []
  const missing: NutritionResult['missing'] = []
  const incomplete = new Set<NutrientKey>()
  const sources = new Set<string>()
  let approxCount = 0
  let brandVariableCount = 0

  for (const ing of ingredients) {
    const { grams, approximate, basis, food } = ingredientGrams(ing)
    if (!food) {
      missing.push({ id: ing.id, name: ing.name, reason: 'Sin correspondencia en la base de datos nutricional' })
      lines.push({ id: ing.id, name: ing.name, food, grams: null, approximateQuantity: false, quantityBasis: basis, nutrients: null })
      continue
    }
    if (grams === null) {
      missing.push({ id: ing.id, name: ing.name, reason: `No se puede convertir a gramos (${basis})` })
      lines.push({ id: ing.id, name: ing.name, food, grams: null, approximateQuantity: false, quantityBasis: basis, nutrients: null })
      continue
    }
    if (approximate) approxCount++
    if (food.brandVariable) brandVariableCount++
    sources.add(food.source === 'custom_label' ? 'Etiqueta del producto (introducida por el usuario)' : food.source === 'usda_fdc_api' ? 'USDA FoodData Central (API)' : 'USDA FoodData Central — SR Legacy')
    const n = nutrientsForGrams(food, grams)
    for (const k of NUTRIENT_KEYS) {
      const v = n[k]
      if (v === null) {
        incomplete.add(k)
      } else {
        total[k] = (total[k] as number) + v
      }
    }
    lines.push({ id: ing.id, name: ing.name, food, grams, approximateQuantity: approximate, quantityBasis: basis, nutrients: n })
  }

  // Un nutriente principal desconocido en algún ingrediente invalida el total de ese nutriente.
  for (const k of incomplete) {
    if (k === 'kcal' || k === 'protein' || k === 'carbs' || k === 'fat') total[k] = null
  }

  const perServing = {} as Nutrients
  for (const k of NUTRIENT_KEYS) {
    const v = total[k]
    perServing[k] = v === null ? null : v / safeServings
  }

  let atwater: number | null = null
  let diffPct: number | null = null
  if (perServing.protein !== null && perServing.carbs !== null && perServing.fat !== null && perServing.kcal !== null) {
    atwater = perServing.protein * 4 + perServing.carbs * 4 + perServing.fat * 9
    diffPct = perServing.kcal > 0 ? ((atwater - perServing.kcal) / perServing.kcal) * 100 : null
  }

  const notes: string[] = []
  if (missing.length) notes.push(`Faltan datos de ${missing.length} ingrediente(s): el total está incompleto.`)
  if (approxCount) notes.push(`${approxCount} cantidad(es) expresadas en unidades o cucharadas: se usa un peso medio, el real puede variar.`)
  if (brandVariableCount) notes.push('Incluye productos comerciales: su composición varía según la marca. Para mayor precisión, usa los valores de la etiqueta.')
  if (diffPct !== null && Math.abs(diffPct) > 5) {
    notes.push(
      `Las kcal proceden de la fuente (factores de Atwater específicos de cada alimento). Calculadas con 4/4/9 kcal por gramo darían ${Math.round(atwater!)} kcal por ración; la diferencia se debe al método, no a un error.`,
    )
  }

  const precision: Precision = missing.length ? 'baja' : approxCount > 0 || brandVariableCount > 0 ? 'media' : 'alta'

  return {
    total,
    perServing,
    servings: safeServings,
    lines,
    missing,
    incompleteNutrients: [...incomplete],
    atwaterKcalPerServing: atwater,
    kcalMethodDiffPct: diffPct,
    precision,
    notes,
    sources: [...sources],
  }
}

/** Escala la receta a otro número de raciones manteniendo los valores por ración. */
export function scaleIngredients(ingredients: RecipeIngredient[], fromServings: number, toServings: number): RecipeIngredient[] {
  if (fromServings <= 0 || toServings <= 0) return ingredients
  const f = toServings / fromServings
  return ingredients.map((i) => ({
    ...i,
    quantity: Math.round(i.quantity * f * 100) / 100,
    minG: i.minG != null ? i.minG * f : i.minG,
    maxG: i.maxG != null ? i.maxG * f : i.maxG,
  }))
}
