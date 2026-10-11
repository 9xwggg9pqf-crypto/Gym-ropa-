'use client'
import type { MealTargets, Recipe } from '@/lib/nutrition/types'

// Borradores locales (en esta pestaña) de recetas generadas aún no guardadas e
// ingredientes confirmados del escáner. No sustituyen al guardado en la cuenta.

export interface DraftRecipe {
  recipe: Recipe
  targets: MealTargets | null
  unmatched: string[]
}
export interface GenerationResult {
  createdAt: number
  interpretation: { summary: string; dish: string | null; questions: string[] }
  targets: MealTargets | null
  infeasible: string | null
  recipes: DraftRecipe[]
  removed: number
}
export interface ConfirmedIngredient {
  name: string
  foodKey: string | null
  quantity: number | null
  unit: 'g' | 'ml' | 'unidad'
  state: 'crudo' | 'cocinado' | 'congelado' | 'conserva' | 'desconocido'
  useFirst: boolean
}

function read<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}
function write(key: string, value: unknown) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* almacenamiento no disponible: el flujo sigue en memoria */
  }
}

export const drafts = {
  getResults: () => read<GenerationResult>('se:results'),
  setResults: (r: GenerationResult) => write('se:results', r),
  getIngredients: () => read<ConfirmedIngredient[]>('se:ingredients') ?? [],
  setIngredients: (i: ConfirmedIngredient[]) => write('se:ingredients', i),
}
