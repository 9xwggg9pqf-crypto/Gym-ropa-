import { exactFood, getFood, resolveFood } from '@/lib/nutrition/catalog'
import { computeNutrition, type NutritionResult } from '@/lib/nutrition/compute'
import { optimizeAlternatives, type OptimizationResult } from '@/lib/nutrition/optimize'
import { checkIngredients, isFoodAllowed, recipeAllergens, type DietaryIssue, type DietaryProfile } from '@/lib/nutrition/restrictions'
import { toGrams } from '@/lib/nutrition/units'
import type { MealTargets, Recipe, RecipeIngredient, Unit } from '@/lib/nutrition/types'
import type { RecipeOutput } from '@/lib/ai/schemas'

export interface PantryEntry {
  foodKey: string | null
  name: string
  quantity: number | null
  unit: Unit
  status?: 'disponible' | 'agotado' | 'revisar'
}

export type PantryStatus = 'tienes' | 'insuficiente' | 'falta' | 'basico'
const STAPLES = new Set(['sal', 'pimienta_negra', 'aceite_oliva', 'aceite_girasol'])

let counter = 0
function newId(): string {
  counter = (counter + 1) % 1_000_000
  return `ing_${Date.now().toString(36)}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** Convierte la salida de la IA en una receta interna, validando cada clave de catálogo. */
export function recipeFromAI(out: RecipeOutput): { recipe: Recipe; unmatched: string[] } {
  const unmatched: string[] = []
  const ingredients: RecipeIngredient[] = out.ingredients
    .filter((i) => Number.isFinite(i.quantity) && i.quantity > 0)
    .map((i) => {
      let food = getFood(i.catalogKey)
      if (!food) food = exactFood(i.name)
      if (!food) unmatched.push(i.name)
      const minG = i.minG !== null && i.minG >= 0 ? i.minG : null
      const maxG = i.maxG !== null && i.maxG > 0 && (minG === null || i.maxG >= minG) ? i.maxG : null
      return {
        id: newId(),
        foodKey: food?.key ?? null,
        name: i.name,
        quantity: Math.round(i.quantity * 100) / 100,
        unit: i.unit,
        role: i.role,
        adjustable: i.adjustable && Boolean(food),
        minG,
        maxG,
        optional: i.optional,
        note: i.note,
      }
    })
  const byName = new Map(ingredients.map((i) => [i.name.toLowerCase(), i.id]))
  const recipe: Recipe = {
    title: out.title.slice(0, 160),
    description: out.description,
    servings: Math.min(50, Math.max(1, Math.round(out.servings) || 1)),
    prepMinutes: Math.max(0, Math.round(out.prepMinutes)),
    cookMinutes: Math.max(0, Math.round(out.cookMinutes)),
    difficulty: out.difficulty,
    utensils: out.utensils,
    ingredients,
    steps: out.steps.map((s) => ({
      text: s.text,
      timerSeconds: s.timerSeconds !== null && s.timerSeconds > 0 && s.timerSeconds < 86400 ? Math.round(s.timerSeconds) : null,
      temperatureC: s.temperatureC !== null && s.temperatureC > 0 && s.temperatureC < 400 ? Math.round(s.temperatureC) : null,
    })),
    tips: out.tips,
    substitutions: out.substitutions
      .map((s) => ({
        ingredientId: byName.get(s.ingredientName.toLowerCase()) ?? '',
        options: s.options.map((o) => ({ foodKey: getFood(o.catalogKey)?.key ?? null, name: o.name, note: o.note })),
      }))
      .filter((s) => s.ingredientId),
    safetyNotes: out.safetyNotes,
    tags: out.tags,
  }
  return { recipe, unmatched }
}

export function pantryStatus(ingredients: RecipeIngredient[], pantry: PantryEntry[]): Record<string, PantryStatus> {
  const out: Record<string, PantryStatus> = {}
  for (const ing of ingredients) {
    const food = resolveFood(ing.foodKey, ing.inlineFood)
    const stock = pantry.filter((p) => (p.status ?? 'disponible') === 'disponible' && ((food && p.foodKey === food.key) || (!food && p.name.toLowerCase() === ing.name.toLowerCase())))
    if (stock.length === 0) {
      out[ing.id] = food && STAPLES.has(food.key) ? 'basico' : 'falta'
      continue
    }
    const need = toGrams(ing.quantity, ing.unit, food).grams
    const known = stock.every((p) => p.quantity !== null)
    if (!known || need === null) {
      out[ing.id] = 'tienes'
      continue
    }
    const have = stock.reduce((s, p) => s + (toGrams(p.quantity!, p.unit, food).grams ?? 0), 0)
    out[ing.id] = have >= need ? 'tienes' : 'insuficiente'
  }
  return out
}

export interface EnrichedRecipe {
  recipe: Recipe
  nutrition: NutritionResult
  optimization: { balanced: OptimizationResult; calories: OptimizationResult; protein: OptimizationResult; distinct: boolean } | null
  issues: DietaryIssue[]
  allergens: ReturnType<typeof recipeAllergens>
  pantry: Record<string, PantryStatus>
  blocked: boolean
}

export function hasTargets(t: MealTargets | null | undefined): t is MealTargets {
  return Boolean(t && (t.kcal || t.protein || t.carbs || t.fat))
}

/**
 * Enriquecimiento determinista de una receta: nutrición, ajuste a objetivos
 * (con tres estrategias), revisión de alergias/dieta y cruce con la despensa.
 */
export function enrichRecipe(recipe: Recipe, ctx: { profile: DietaryProfile; pantry: PantryEntry[]; targets?: MealTargets | null }): EnrichedRecipe {
  let working = recipe
  let optimization: EnrichedRecipe['optimization'] = null
  if (hasTargets(ctx.targets)) {
    optimization = optimizeAlternatives(recipe.ingredients, recipe.servings, ctx.targets, { isAllowed: (f) => isFoodAllowed(f, ctx.profile) })
    working = { ...recipe, ingredients: optimization.balanced.ingredients }
  }
  const nutrition = computeNutrition(working.ingredients, working.servings)
  const issues = checkIngredients(working.ingredients, ctx.profile)
  return {
    recipe: working,
    nutrition,
    optimization,
    issues,
    allergens: recipeAllergens(working.ingredients),
    pantry: pantryStatus(working.ingredients, ctx.pantry),
    blocked: issues.some((i) => i.severity === 'bloqueo'),
  }
}
