import { getFood } from './catalog'
import { computeNutrition, ingredientGrams, type NutritionResult } from './compute'
import { fromGrams } from './units'
import type { Food, IngredientRole, MacroTarget, MealTargets, OptimizationPriority, RecipeIngredient } from './types'

/**
 * Optimizador determinista de cantidades.
 *
 * Ajusta los gramos de los ingredientes "ajustables" (dentro de unos límites que
 * conservan la identidad del plato) para acercar los valores POR RACIÓN a los
 * objetivos del usuario. Minimiza una suma ponderada de desviaciones relativas
 * más una penalización por alejarse de la receta original (para no generar
 * proporciones absurdas). Es un problema cuadrático con restricciones de caja,
 * resuelto con descenso de gradiente proyectado.
 *
 * Los valores nutricionales usados son SIEMPRE los del alimento asociado; la IA
 * no interviene en este cálculo.
 */

type TargetNutrient = 'kcal' | 'protein' | 'carbs' | 'fat'
const TARGET_NUTRIENTS: TargetNutrient[] = ['kcal', 'protein', 'carbs', 'fat']

export const NUTRIENT_LABEL: Record<TargetNutrient, string> = {
  kcal: 'calorías',
  protein: 'proteína',
  carbs: 'carbohidratos',
  fat: 'grasas',
}
const fmt = (v: number | null) => (v === null ? '—' : String(Math.round(v * 10) / 10).replace('.', ','))
const UNIT_SUFFIX: Record<TargetNutrient, string> = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' }

/** Límites por defecto (multiplicadores de la cantidad original) según el papel del ingrediente. */
const DEFAULT_BOUNDS: Record<IngredientRole, [number, number] | null> = {
  protein: [0.5, 2.5],
  carb: [0.3, 2.5],
  fat: [0, 2],
  vegetable: [0.5, 2.5],
  dairy: [0.3, 2],
  sauce: [0.5, 1.6],
  fruit: [0.5, 2],
  seasoning: null,
  other: null,
}

export interface TargetReport {
  nutrient: TargetNutrient
  target: MacroTarget
  achieved: number | null
  met: boolean
  /** Rango alcanzable por ración moviendo sólo ese nutriente (ignora los demás objetivos). */
  reachable: [number, number] | null
}

export interface IngredientChange {
  id: string
  name: string
  fromG: number
  toG: number
}

export type OptimizationStatus = 'no_targets' | 'met' | 'partial' | 'unreachable'

export interface OptimizationResult {
  priority: OptimizationPriority
  ingredients: RecipeIngredient[]
  nutrition: NutritionResult
  status: OptimizationStatus
  reports: TargetReport[]
  changes: IngredientChange[]
  messages: string[]
  suggestions: { foodKey: string; name: string; reason: string }[]
}

export interface OptimizeOptions {
  priority?: OptimizationPriority
  /** Filtro de alimentos permitidos (alergias, dieta) para las sugerencias. */
  isAllowed?: (food: Food) => boolean
}

interface Var {
  index: number
  id: string
  name: string
  g0: number
  lo: number
  hi: number
  scale: number
  coef: Record<TargetNutrient, number>
  ing: RecipeIngredient
  food: Food
}

function tolerance(n: TargetNutrient, t: MacroTarget): number {
  if (t.kind === 'approx') return n === 'kcal' ? Math.max(0.05 * t.value, 25) : Math.max(0.1 * t.value, 3)
  return n === 'kcal' ? 10 : 1
}

export function isTargetMet(n: TargetNutrient, t: MacroTarget, achieved: number | null): boolean {
  if (achieved === null) return false
  const tol = tolerance(n, t)
  if (t.kind === 'approx') return Math.abs(achieved - t.value) <= tol
  if (t.kind === 'min') return achieved >= t.value - tol
  return achieved <= t.value + tol
}

function activeTargets(targets: MealTargets): [TargetNutrient, MacroTarget][] {
  return TARGET_NUTRIENTS.filter((n) => targets[n] && targets[n]!.value > 0).map((n) => [n, targets[n]!] as [TargetNutrient, MacroTarget])
}

function weightsFor(priority: OptimizationPriority, n: TargetNutrient, t: MacroTarget): number {
  let w = 1
  if (priority === 'calories' && n === 'kcal') w = 8
  if (priority === 'protein' && n === 'protein') w = 8
  if (priority === 'balanced' && (n === 'kcal' || n === 'protein')) w = 3
  if (t.strict) w *= 25
  return w
}

function roundGrams(grams: number, ing: RecipeIngredient, food: Food): number {
  if (ing.unit === 'unidad') {
    const unitG = food.portions.unit?.grams
    if (unitG) {
      const step = food.group === 'egg' ? 1 : 0.5
      return Math.max(0, Math.round(grams / unitG / step) * step) * unitG
    }
  }
  if (ing.unit === 'cda' || ing.unit === 'cdta') {
    const one = fromGrams(1, ing.unit, food)
    if (one) {
      const units = grams * one
      return (Math.max(0, Math.round(units * 2) / 2) / one)
    }
  }
  if (grams >= 40) return Math.round(grams / 5) * 5
  return Math.round(grams)
}

export function optimizeRecipe(
  ingredients: RecipeIngredient[],
  servings: number,
  targets: MealTargets,
  options: OptimizeOptions = {},
): OptimizationResult {
  const priority = options.priority ?? 'balanced'
  const active = activeTargets(targets)
  const base = computeNutrition(ingredients, servings)

  if (active.length === 0) {
    return { priority, ingredients, nutrition: base, status: 'no_targets', reports: [], changes: [], messages: [], suggestions: [] }
  }

  // Constantes (ingredientes fijos) y variables (ajustables), en gramos TOTALES de la receta.
  const constant: Record<TargetNutrient, number> = { kcal: 0, protein: 0, carbs: 0, fat: 0 }
  const vars: Var[] = []
  ingredients.forEach((ing, index) => {
    const { grams, food } = ingredientGrams(ing)
    if (!food || grams === null) return
    const coef = {} as Record<TargetNutrient, number>
    for (const n of TARGET_NUTRIENTS) coef[n] = (food.per100g[n] ?? 0) / 100
    const bounds = DEFAULT_BOUNDS[ing.role]
    if (ing.adjustable && bounds && grams > 0) {
      let lo = ing.minG ?? grams * bounds[0]
      let hi = ing.maxG ?? grams * bounds[1]
      if (ing.role === 'fat') lo = ing.minG ?? Math.min(grams, 5 * servings) // aceite mínimo para cocinar
      lo = Math.max(0, Math.min(lo, grams))
      hi = Math.max(hi, grams)
      vars.push({ index, id: ing.id, name: ing.name, g0: grams, lo, hi, scale: Math.max(grams, 10), coef, ing, food })
    } else {
      for (const n of TARGET_NUTRIENTS) constant[n] += coef[n] * grams
    }
  })

  const S = base.servings
  const totalOf = (x: number[], n: TargetNutrient) => constant[n] + vars.reduce((s, v, i) => s + v.coef[n] * x[i], 0)

  const lambda = 0.02
  // Los mínimos/máximos se apuntan con un pequeño margen para que el redondeo no los deje justo fuera.
  const effective = (t: MacroTarget) => (t.kind === 'min' ? t.value * 1.03 : t.kind === 'max' ? t.value * 0.97 : t.value)
  const objective = (x: number[]) => {
    let f = 0
    for (const [n, t] of active) {
      const T = effective(t) * S
      const N = totalOf(x, n)
      const w = weightsFor(priority, n, t)
      let r = 0
      if (t.kind === 'approx') r = (N - T) / T
      else if (t.kind === 'min') r = Math.max(0, (T - N) / T)
      else r = Math.max(0, (N - T) / T)
      f += w * r * r
    }
    vars.forEach((v, i) => {
      const d = (x[i] - v.g0) / v.scale
      f += lambda * d * d
    })
    return f
  }
  const gradient = (x: number[]) => {
    const g = new Array(vars.length).fill(0)
    for (const [n, t] of active) {
      const T = effective(t) * S
      const N = totalOf(x, n)
      const w = weightsFor(priority, n, t)
      let dr = 0
      if (t.kind === 'approx') dr = (2 * w * (N - T)) / (T * T)
      else if (t.kind === 'min' && N < T) dr = (-2 * w * (T - N)) / (T * T)
      else if (t.kind === 'max' && N > T) dr = (2 * w * (N - T)) / (T * T)
      if (dr !== 0) vars.forEach((v, i) => (g[i] += dr * v.coef[n]))
    }
    vars.forEach((v, i) => (g[i] += (2 * lambda * (x[i] - v.g0)) / (v.scale * v.scale)))
    return g
  }
  const project = (x: number[]) => x.map((xi, i) => Math.min(vars[i].hi, Math.max(vars[i].lo, xi)))

  let x = vars.map((v) => v.g0)
  if (vars.length) {
    let fx = objective(x)
    let step = 1000
    for (let iter = 0; iter < 4000; iter++) {
      const g = gradient(x)
      let improved = false
      while (step > 1e-6) {
        const cand = project(x.map((xi, i) => xi - step * g[i]))
        const fc = objective(cand)
        if (fc < fx - 1e-12) {
          const moved = cand.reduce((s, c, i) => s + Math.abs(c - x[i]), 0)
          x = cand
          fx = fc
          improved = moved > 1e-7
          step *= 1.5
          break
        }
        step /= 2
      }
      if (!improved) break
    }
  }

  // Redondeo a cantidades cocinables y reconstrucción de la receta en sus unidades originales.
  const newIngredients = ingredients.map((ing) => ({ ...ing }))
  const changes: IngredientChange[] = []
  vars.forEach((v, i) => {
    const rounded = Math.min(Math.max(roundGrams(x[i], v.ing, v.food), v.ing.unit === 'unidad' ? 0 : v.lo), v.hi + 5)
    const q = fromGrams(rounded, v.ing.unit, v.food)
    if (q === null) return
    newIngredients[v.index] = { ...newIngredients[v.index], quantity: Math.round(q * 100) / 100 }
    if (Math.abs(rounded - v.g0) >= Math.max(3, v.g0 * 0.04)) changes.push({ id: v.id, name: v.name, fromG: Math.round(v.g0), toG: Math.round(rounded) })
  })

  const nutrition = computeNutrition(newIngredients, servings)

  // Informe por objetivo, con el rango alcanzable de cada nutriente por separado.
  const reports: TargetReport[] = active.map(([n, t]) => {
    const minN = (constant[n] + vars.reduce((s, v) => s + v.coef[n] * v.lo, 0)) / S
    const maxN = (constant[n] + vars.reduce((s, v) => s + v.coef[n] * v.hi, 0)) / S
    const achieved = nutrition.perServing[n]
    return { nutrient: n, target: t, achieved: achieved === null ? null : Math.round(achieved * 10) / 10, met: isTargetMet(n, t, achieved), reachable: [minN, maxN] }
  })

  const messages: string[] = []
  const suggestions: OptimizationResult['suggestions'] = []
  let unreachable = false
  if (base.missing.length) {
    messages.push(`Hay ${base.missing.length} ingrediente(s) sin datos nutricionales; el ajuste no puede tenerlos en cuenta.`)
  }
  for (const r of reports) {
    if (r.met || !r.reachable) continue
    const [lo, hi] = r.reachable
    const label = NUTRIENT_LABEL[r.nutrient]
    const unit = UNIT_SUFFIX[r.nutrient]
    const needsMore = (r.target.kind !== 'max' && hi < r.target.value - tolerance(r.nutrient, r.target))
    const needsLess = (r.target.kind !== 'min' && lo > r.target.value + tolerance(r.nutrient, r.target))
    if (needsMore) {
      unreachable = true
      messages.push(
        `Con estos ingredientes no se alcanzan de forma razonable ${r.target.value} ${unit} de ${label} por ración: el máximo, sin desfigurar el plato, ronda ${Math.round(hi)} ${unit}.`,
      )
      if (r.nutrient === 'protein') suggestions.push(...proteinSuggestions(ingredients, options.isAllowed))
    } else if (needsLess) {
      unreachable = true
      messages.push(
        `La versión mínima razonable de este plato ya aporta unos ${Math.round(lo)} ${unit} de ${label} por ración, por encima de ${r.target.value} ${unit}. Habría que quitar o cambiar algún ingrediente.`,
      )
    } else {
      messages.push(
        `No se pueden cumplir a la vez todos los objetivos: con el reparto elegido, ${label} queda en ${fmt(r.achieved)} ${unit} frente a ${r.target.value} ${unit}.`,
      )
    }
  }

  const allMet = reports.every((r) => r.met)
  const status: OptimizationStatus = allMet ? 'met' : unreachable ? 'unreachable' : 'partial'
  if (allMet && changes.length === 0) messages.push('La receta ya cumplía los objetivos; no ha hecho falta cambiar cantidades.')

  return { priority, ingredients: newIngredients, nutrition, status, reports, changes, messages, suggestions }
}

const PROTEIN_SUGGESTIONS = ['clara_huevo', 'pechuga_pollo_cruda', 'yogur_griego_desnatado', 'atun_lata_agua', 'queso_cottage', 'tofu_firme', 'lentejas_cocidas']

function proteinSuggestions(ingredients: RecipeIngredient[], isAllowed?: (f: Food) => boolean) {
  const present = new Set(ingredients.map((i) => i.foodKey))
  return PROTEIN_SUGGESTIONS.map((k) => getFood(k))
    .filter((f): f is Food => !!f && !present.has(f.key) && (!isAllowed || isAllowed(f)))
    .slice(0, 3)
    .map((f) => ({ foodKey: f.key, name: f.name, reason: `${f.per100g.protein} g de proteína y ${f.per100g.kcal} kcal por 100 g (USDA)` }))
}

/** Ejecuta las tres estrategias (priorizar calorías, proteína o equilibrio). */
export function optimizeAlternatives(ingredients: RecipeIngredient[], servings: number, targets: MealTargets, options: Omit<OptimizeOptions, 'priority'> = {}) {
  const priorities: OptimizationPriority[] = ['balanced', 'calories', 'protein']
  const results = priorities.map((p) => optimizeRecipe(ingredients, servings, targets, { ...options, priority: p }))
  const signature = (r: OptimizationResult) => r.ingredients.map((i) => i.quantity).join('|')
  const distinct = new Set(results.map(signature)).size > 1
  return { balanced: results[0], calories: results[1], protein: results[2], distinct }
}
