import data from '@/data/foods.generated.json'
import type { Food, FoodGroup } from './types'

const BRAND_VARIABLE_GROUPS: FoodGroup[] = ['sauce', 'protein_powder', 'bakery', 'broth']

type RawFood = Omit<Food, 'source' | 'brandVariable'>

export const CATALOG_SOURCE = {
  name: data.source,
  url: data.sourceUrl,
  generatedAt: data.generatedAt,
}

export const FOODS: Food[] = (data.foods as unknown as RawFood[]).map((f) => ({
  ...f,
  source: 'usda_sr_legacy' as const,
  brandVariable: BRAND_VARIABLE_GROUPS.includes(f.group) || (f.state === 'prepared' && f.mayContain.length > 0),
}))

const BY_KEY = new Map(FOODS.map((f) => [f.key, f]))

export function getFood(key: string | null | undefined): Food | undefined {
  if (!key) return undefined
  return BY_KEY.get(key)
}

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ% ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

interface IndexEntry {
  food: Food
  terms: string[]
}
const INDEX: IndexEntry[] = FOODS.map((food) => ({
  food,
  terms: [food.name, ...food.aliases, food.key.replace(/_/g, ' ')].map(normalize),
}))

/**
 * Búsqueda textual sencilla sobre el catálogo curado. Devuelve coincidencias
 * ordenadas por relevancia. No "adivina": si no hay coincidencias, devuelve [].
 */
export function searchFoods(query: string, limit = 12): Food[] {
  const q = normalize(query)
  if (!q) return []
  const words = q.split(' ')
  const scored: { food: Food; score: number }[] = []
  for (const { food, terms } of INDEX) {
    let score = 0
    for (const t of terms) {
      if (t === q) score = Math.max(score, 100)
      else if (t.startsWith(q)) score = Math.max(score, 80)
      else if (t.includes(q)) score = Math.max(score, 60)
      else if (words.every((w) => t.includes(w))) score = Math.max(score, 40)
    }
    if (score > 0) {
      // Prioriza el alias exacto principal (primer alias) y estados crudos/secos,
      // que son la referencia habitual al pesar ingredientes.
      if (food.aliases[0] && normalize(food.aliases[0]) === q) score += 10
      if (food.state === 'raw' || food.state === 'dry') score += 2
      scored.push({ food, score })
    }
  }
  return scored
    .sort((a, b) => b.score - a.score || a.food.name.localeCompare(b.food.name))
    .slice(0, limit)
    .map((s) => s.food)
}

/** Lista compacta para incluir en el prompt de la IA (clave + nombre + estado). */
export function catalogForPrompt(): string {
  return FOODS.map((f) => `${f.key}: ${f.name}`).join('\n')
}

export function resolveFood(key: string | null | undefined, inline?: Food | null): Food | undefined {
  if (inline && (!key || inline.key === key)) return inline
  return getFood(key)
}
