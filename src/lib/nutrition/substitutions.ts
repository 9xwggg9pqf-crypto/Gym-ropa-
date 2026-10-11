import { FOODS, resolveFood } from './catalog'
import { nutrientsForGrams } from './compute'
import { isFoodAllowed, type DietaryProfile, ALLERGEN_LABELS } from './restrictions'
import { toGrams } from './units'
import type { Allergen, Food, FoodGroup, RecipeIngredient } from './types'

/** Grupos intercambiables desde el punto de vista culinario. */
const COMPATIBLE: Partial<Record<FoodGroup, FoodGroup[]>> = {
  protein_meat: ['protein_meat', 'protein_fish', 'protein_veg'],
  protein_fish: ['protein_fish', 'protein_meat', 'protein_veg'],
  protein_veg: ['protein_veg', 'legume', 'protein_meat', 'protein_fish'],
  legume: ['legume', 'protein_veg'],
  carb_grain: ['carb_grain', 'carb_tuber'],
  carb_tuber: ['carb_tuber', 'carb_grain'],
  cheese: ['cheese'],
  dairy_liquid: ['dairy_liquid'],
  yogurt: ['yogurt'],
  fat_oil: ['fat_oil', 'fat_butter'],
  fat_butter: ['fat_butter', 'fat_oil'],
  vegetable: ['vegetable'],
  fruit: ['fruit'],
  nut_seed: ['nut_seed'],
  sweetener: ['sweetener'],
  bakery: ['bakery'],
  egg: ['egg'],
  herb: ['herb', 'spice'],
  spice: ['spice', 'herb'],
  sauce: ['sauce'],
  broth: ['broth'],
}

/** Nutriente que se intenta igualar al sustituir, según el tipo de ingrediente. */
function matchNutrient(group: FoodGroup): 'protein' | 'carbs' | 'kcal' | 'grams' {
  if (group.startsWith('protein') || group === 'egg' || group === 'legume') return 'protein'
  if (group.startsWith('carb') || group === 'bakery') return 'carbs'
  if (group === 'fat_oil' || group === 'fat_butter' || group === 'nut_seed') return 'kcal'
  return 'grams'
}

export interface SubstitutionOption {
  food: Food
  grams: number
  /** Diferencia por ración respecto al ingrediente original. */
  delta: { kcal: number; protein: number; carbs: number; fat: number }
  equivalent: boolean
  allergensAdded: Allergen[]
  allergensRemoved: Allergen[]
  notes: string[]
}

const STATE_COMPAT: Record<string, string[]> = {
  raw: ['raw'],
  cooked: ['cooked', 'canned'],
  dry: ['dry'],
  canned: ['canned', 'cooked'],
  prepared: ['prepared', 'canned', 'cooked'],
}

/**
 * Propone sustituciones deterministas para un ingrediente, calculando el efecto
 * nutricional con los datos del catálogo. Excluye alimentos incompatibles con
 * las alergias/dieta del usuario (incluidos los que "pueden contener" el alérgeno).
 */
export function suggestSubstitutes(ing: RecipeIngredient, servings: number, profile: DietaryProfile, limit = 6): SubstitutionOption[] {
  const original = resolveFood(ing.foodKey, ing.inlineFood)
  if (!original) return []
  const g0 = toGrams(ing.quantity, ing.unit, original).grams
  if (!g0) return []
  const groups = COMPATIBLE[original.group] ?? [original.group]
  const target = matchNutrient(original.group)
  const n0 = nutrientsForGrams(original, g0)
  const S = servings > 0 ? servings : 1

  const candidates = FOODS.filter(
    (f) => f.key !== original.key && groups.includes(f.group) && (STATE_COMPAT[original.state] ?? [original.state]).includes(f.state) && isFoodAllowed(f, profile),
  )

  const options = candidates.map((food) => {
    let grams = g0
    const per = food.per100g
    if (target === 'protein' && per.protein && n0.protein) grams = (n0.protein / per.protein) * 100
    else if (target === 'carbs' && per.carbs && n0.carbs) grams = (n0.carbs / per.carbs) * 100
    else if (target === 'kcal' && per.kcal && n0.kcal) grams = (n0.kcal / per.kcal) * 100
    // No proponer cantidades desproporcionadas (más del triple o menos de un tercio).
    const ratio = grams / g0
    const notes: string[] = []
    if (ratio > 3 || ratio < 1 / 3) {
      grams = g0
      notes.push('Se mantiene el mismo peso: igualar el macronutriente exigiría una cantidad poco razonable.')
    }
    grams = grams >= 40 ? Math.round(grams / 5) * 5 : Math.round(grams)
    const n1 = nutrientsForGrams(food, grams)
    const d = (k: 'kcal' | 'protein' | 'carbs' | 'fat') => ((n1[k] ?? 0) - (n0[k] ?? 0)) / S
    const delta = { kcal: Math.round(d('kcal')), protein: Math.round(d('protein') * 10) / 10, carbs: Math.round(d('carbs') * 10) / 10, fat: Math.round(d('fat') * 10) / 10 }
    const kcal0 = (n0.kcal ?? 0) / S
    const equivalent = Math.abs(delta.kcal) <= Math.max(25, kcal0 * 0.1) && Math.abs(delta.protein) <= 3 && Math.abs(delta.carbs) <= 5 && Math.abs(delta.fat) <= 3
    const allergensAdded = food.allergens.filter((a) => !original.allergens.includes(a))
    const allergensRemoved = original.allergens.filter((a) => !food.allergens.includes(a))
    if (allergensAdded.length) notes.push(`Añade alérgenos: ${allergensAdded.map((a) => ALLERGEN_LABELS[a]).join(', ')}.`)
    if (allergensRemoved.length) notes.push(`Elimina: ${allergensRemoved.map((a) => ALLERGEN_LABELS[a]).join(', ')}.`)
    if (food.state !== original.state) notes.push('Cambia el estado del ingrediente (p. ej. cocido/en conserva): revisa el tiempo de cocción.')
    if (food.group !== original.group) notes.push('Cambia el tipo de ingrediente: el sabor y la textura serán distintos.')
    return { food, grams, delta, equivalent, allergensAdded, allergensRemoved, notes }
  })

  // Primero el mismo grupo, luego las más parecidas nutricionalmente.
  return options
    .sort((a, b) => {
      const ga = a.food.group === original.group ? 0 : 1
      const gb = b.food.group === original.group ? 0 : 1
      if (ga !== gb) return ga - gb
      const da = Math.abs(a.delta.kcal) + Math.abs(a.delta.protein) * 4
      const db = Math.abs(b.delta.kcal) + Math.abs(b.delta.protein) * 4
      return da - db
    })
    .slice(0, limit)
}

/** Aplica una sustitución a la lista de ingredientes (en gramos). */
export function applySubstitution(ingredients: RecipeIngredient[], ingredientId: string, option: Pick<SubstitutionOption, 'food' | 'grams'>): RecipeIngredient[] {
  return ingredients.map((i) =>
    i.id === ingredientId ? { ...i, foodKey: option.food.key, name: option.food.name, quantity: option.grams, unit: 'g', inlineFood: option.food.source === 'usda_sr_legacy' ? null : option.food, minG: null, maxG: null } : i,
  )
}
