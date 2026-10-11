import { describe, expect, it } from 'vitest'
import { getFood, searchFoods } from './catalog'
import { computeNutrition, scaleIngredients } from './compute'
import { optimizeAlternatives, optimizeRecipe } from './optimize'
import { checkIngredients, isFoodAllowed, recipeAllergens, EMPTY_PROFILE } from './restrictions'
import { suggestSubstitutes } from './substitutions'
import { toGrams } from './units'
import type { IngredientRole, RecipeIngredient, Unit } from './types'

let n = 0
function ing(foodKey: string | null, quantity: number, unit: Unit = 'g', role: IngredientRole = 'other', adjustable = false, name?: string): RecipeIngredient {
  n++
  return { id: `i${n}`, foodKey, name: name ?? getFood(foodKey)?.name ?? foodKey ?? 'x', quantity, unit, role, adjustable }
}

describe('catálogo USDA', () => {
  it('contiene los valores oficiales de SR Legacy (pechuga de pollo cruda, FDC 171077)', () => {
    const f = getFood('pechuga_pollo_cruda')!
    expect(f.fdcId).toBe(171077)
    expect(f.per100g.kcal).toBe(120)
    expect(f.per100g.protein).toBe(22.5)
    expect(f.usdaDescription).toMatch(/breast, skinless, boneless, meat only, raw/)
  })
  it('distingue arroz crudo y cocido (valores distintos, no intercambiables)', () => {
    const raw = getFood('arroz_blanco_crudo')!
    const cooked = getFood('arroz_blanco_cocido')!
    expect(raw.state).toBe('dry')
    expect(cooked.state).toBe('cooked')
    expect(raw.per100g.kcal).toBe(365)
    expect(cooked.per100g.kcal).toBe(130)
  })
  it('búsqueda por alias en español', () => {
    expect(searchFoods('pollo')[0].key).toBe('pechuga_pollo_cruda')
    expect(searchFoods('espaguetis')[0].key).toBe('pasta_seca')
    expect(searchFoods('xyz-no-existe')).toEqual([])
  })
  it('ningún alimento tiene nutrientes principales inventados (todos con dato)', async () => {
    const { FOODS } = await import('./catalog')
    for (const f of FOODS) {
      expect(f.per100g.kcal, f.key).not.toBeNull()
      expect(f.per100g.protein, f.key).not.toBeNull()
    }
  })
})

describe('conversión de unidades', () => {
  it('usa pesos de porción de USDA', () => {
    expect(toGrams(2, 'unidad', getFood('huevo')).grams).toBe(100) // 1 huevo L = 50 g
    expect(toGrams(1, 'cda', getFood('aceite_oliva')).grams).toBe(13.5)
    expect(toGrams(250, 'ml', getFood('leche_entera')).grams).toBeCloseTo(257.75, 1)
  })
  it('marca las unidades como aproximadas y no inventa pesos desconocidos', () => {
    expect(toGrams(1, 'unidad', getFood('huevo')).approximate).toBe(true)
    expect(toGrams(1, 'unidad', getFood('brocoli')).grams).toBeNull()
  })
})

describe('Caso D: cambio de cantidades', () => {
  it('100 g → 150 g de pollo recalcula calorías y proteína con datos USDA', () => {
    const a = computeNutrition([ing('pechuga_pollo_cruda', 100)], 1)
    const b = computeNutrition([ing('pechuga_pollo_cruda', 150)], 1)
    expect(a.perServing.kcal).toBe(120)
    expect(a.perServing.protein).toBe(22.5)
    expect(b.perServing.kcal).toBe(180)
    expect(b.perServing.protein).toBeCloseTo(33.75, 5)
    expect(b.precision).toBe('alta')
  })
  it('no suma ingredientes sin datos y lo indica', () => {
    const r = computeNutrition([ing('pechuga_pollo_cruda', 100), ing(null, 50, 'g', 'other', false, 'Salsa misteriosa')], 1)
    expect(r.perServing.kcal).toBe(120)
    expect(r.missing).toHaveLength(1)
    expect(r.precision).toBe('baja')
  })
})

describe('Caso E: cambio de raciones', () => {
  it('2 → 4 raciones duplica cantidades y conserva los valores por ración', () => {
    const base = [ing('pechuga_pollo_cruda', 300), ing('arroz_blanco_crudo', 160), ing('aceite_oliva', 20)]
    const scaled = scaleIngredients(base, 2, 4)
    expect(scaled.map((i) => i.quantity)).toEqual([600, 320, 40])
    const a = computeNutrition(base, 2)
    const b = computeNutrition(scaled, 4)
    expect(b.perServing.kcal).toBeCloseTo(a.perServing.kcal!, 5)
    expect(b.total.kcal).toBeCloseTo(a.total.kcal! * 2, 5)
  })
})

describe('Caso B: objetivo de calorías y proteína', () => {
  const pollo = () => [
    ing('pechuga_pollo_cruda', 150, 'g', 'protein', true),
    ing('arroz_blanco_crudo', 80, 'g', 'carb', true),
    ing('aceite_oliva', 10, 'g', 'fat', true),
    ing('tomate', 100, 'g', 'vegetable', true),
    ing('queso_mozzarella', 30, 'g', 'dairy', true),
    ing('sal', 1, 'g', 'seasoning', false),
  ]
  it('650 kcal y ≥55 g de proteína: ajusta cantidades y cumple con valores recalculados', () => {
    const r = optimizeRecipe(pollo(), 1, { kcal: { value: 650, kind: 'approx' }, protein: { value: 55, kind: 'min' } })
    expect(r.status).toBe('met')
    const kcal = r.nutrition.perServing.kcal!
    const prot = r.nutrition.perServing.protein!
    expect(Math.abs(kcal - 650)).toBeLessThanOrEqual(32.5)
    expect(prot).toBeGreaterThanOrEqual(54)
    // Ha subido el pollo y lo explica
    const chicken = r.changes.find((c) => c.name.includes('pollo'))
    expect(chicken && chicken.toG > chicken.fromG).toBe(true)
    // El resultado es coherente: recalcular desde cero da lo mismo
    const again = computeNutrition(r.ingredients, 1)
    expect(again.perServing.kcal).toBeCloseTo(kcal, 5)
  })
  it('si los ingredientes no permiten la proteína pedida, lo dice y sugiere alternativas', () => {
    const r = optimizeRecipe(
      [ing('arroz_blanco_crudo', 100, 'g', 'carb', true), ing('tomate', 150, 'g', 'vegetable', true), ing('aceite_oliva', 10, 'g', 'fat', true)],
      1,
      { kcal: { value: 650, kind: 'approx' }, protein: { value: 40, kind: 'min' } },
    )
    expect(r.status).toBe('unreachable')
    expect(r.messages.join(' ')).toMatch(/no se alcanzan/i)
    expect(r.suggestions.length).toBeGreaterThan(0)
  })
  it('ofrece tres alternativas (calorías, proteína, equilibrio)', () => {
    const alt = optimizeAlternatives(pollo(), 1, { kcal: { value: 550, kind: 'approx' }, protein: { value: 60, kind: 'min' } })
    expect(alt.calories.priority).toBe('calories')
    expect(alt.protein.priority).toBe('protein')
    const kc = Math.abs(alt.calories.nutrition.perServing.kcal! - 550)
    const kp = Math.abs(alt.protein.nutrition.perServing.kcal! - 550)
    expect(kc).toBeLessThanOrEqual(kp + 1)
    expect(alt.protein.nutrition.perServing.protein!).toBeGreaterThanOrEqual(alt.calories.nutrition.perServing.protein! - 0.5)
  })
})

describe('Caso C: plato concreto (espaguetis a la boloñesa)', () => {
  it('750 kcal y ≥40 g de proteína manteniendo un plato razonable', () => {
    const recipe = [
      ing('pasta_seca', 100, 'g', 'carb', true),
      ing('ternera_picada_90_cruda', 120, 'g', 'protein', true),
      ing('salsa_marinara', 150, 'g', 'sauce', true),
      ing('cebolla', 50, 'g', 'vegetable', true),
      ing('aceite_oliva', 10, 'g', 'fat', true),
      ing('queso_parmesano', 10, 'g', 'dairy', true),
    ]
    const r = optimizeRecipe(recipe, 1, { kcal: { value: 750, kind: 'approx' }, protein: { value: 40, kind: 'min' } })
    expect(r.status).toBe('met')
    const pasta = r.ingredients[0].quantity
    expect(pasta).toBeGreaterThanOrEqual(30) // conserva la identidad del plato
    expect(pasta).toBeLessThanOrEqual(250)
    expect(r.nutrition.perServing.protein!).toBeGreaterThanOrEqual(39)
  })
  it('respeta límites estrictos de grasa', () => {
    const recipe = [ing('pasta_seca', 100, 'g', 'carb', true), ing('ternera_picada_80_cruda', 150, 'g', 'protein', true), ing('aceite_oliva', 15, 'g', 'fat', true)]
    const r = optimizeRecipe(recipe, 1, { fat: { value: 20, kind: 'max', strict: true } })
    expect(r.nutrition.perServing.fat!).toBeLessThanOrEqual(21)
  })
})

describe('Caso G: alergias', () => {
  const profile = { ...EMPTY_PROFILE, allergies: ['leche' as const] }
  it('bloquea ingredientes con el alérgeno declarado', () => {
    const issues = checkIngredients([ing('queso_mozzarella', 30), ing('pechuga_pollo_cruda', 100)], profile)
    expect(issues.some((i) => i.severity === 'bloqueo' && i.allergen === 'leche')).toBe(true)
    expect(issues.filter((i) => i.ingredientName.includes('pollo'))).toHaveLength(0)
  })
  it('avisa de "puede contener" en productos procesados (revisar etiqueta)', () => {
    const issues = checkIngredients([ing('chorizo', 50)], { ...EMPTY_PROFILE, allergies: ['gluten'] })
    expect(issues[0].message).toMatch(/etiqueta/)
  })
  it('no sustituye un alérgeno por otro con riesgo equivalente', () => {
    const subs = suggestSubstitutes(ing('queso_mozzarella', 30, 'g', 'dairy'), 1, profile)
    expect(subs.every((s) => !s.food.allergens.includes('leche') && !s.food.mayContain.includes('leche'))).toBe(true)
    expect(subs).toHaveLength(0) // todos los quesos del catálogo contienen leche
  })
  it('las sustituciones de pollo excluyen pescado si hay alergia al pescado', () => {
    const subs = suggestSubstitutes(ing('pechuga_pollo_cruda', 150, 'g', 'protein'), 1, { ...EMPTY_PROFILE, allergies: ['pescado', 'crustaceos', 'moluscos'] })
    expect(subs.length).toBeGreaterThan(0)
    expect(subs.every((s) => s.food.animal !== 'fish')).toBe(true)
  })
  it('detecta alérgenos por nombre en ingredientes sin datos y pide revisarlos', () => {
    const issues = checkIngredients([ing(null, 20, 'g', 'other', false, 'Queso manchego curado')], profile)
    expect(issues.some((i) => i.severity === 'bloqueo')).toBe(true)
    expect(issues.some((i) => i.severity === 'revisar')).toBe(true)
  })
  it('dieta vegana excluye productos animales', () => {
    const vegan = { ...EMPTY_PROFILE, diets: ['vegana' as const] }
    expect(isFoodAllowed(getFood('miel')!, vegan)).toBe(false)
    expect(isFoodAllowed(getFood('tofu_firme')!, vegan)).toBe(true)
  })
  it('lista los alérgenos de la receta', () => {
    const a = recipeAllergens([ing('pasta_seca', 100), ing('queso_parmesano', 10)])
    expect(a.contains).toEqual(expect.arrayContaining(['gluten', 'leche']))
    expect(a.mayContain).toContain('huevo')
  })
})

describe('sustituciones', () => {
  it('explica el efecto nutricional y si es equivalente', () => {
    const subs = suggestSubstitutes(ing('arroz_blanco_crudo', 80, 'g', 'carb'), 1, EMPTY_PROFILE)
    expect(subs.length).toBeGreaterThan(0)
    for (const s of subs) {
      expect(typeof s.delta.kcal).toBe('number')
      expect(s.food.state).toBe('dry') // crudo ↔ crudo, nunca crudo ↔ cocido
    }
  })
})
