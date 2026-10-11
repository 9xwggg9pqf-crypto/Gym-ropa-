import { normalize, resolveFood } from '@/lib/nutrition/catalog'
import { scaleIngredients } from '@/lib/nutrition/compute'
import { toGrams } from '@/lib/nutrition/units'
import type { RecipeIngredient, ShoppingCategory, Unit } from '@/lib/nutrition/types'

export interface PlannedRecipe {
  title: string
  baseServings: number
  plannedServings: number
  ingredients: RecipeIngredient[]
}

export interface PantryStock {
  foodKey: string | null
  name: string
  quantity: number | null
  unit: Unit
  status: 'disponible' | 'agotado' | 'revisar'
}

export interface AggregatedItem {
  /** Clave estable para fusionar listas (foodKey o nombre normalizado + unidad). */
  key: string
  foodKey: string | null
  name: string
  category: ShoppingCategory
  /** Necesidad total en gramos (si todas las cantidades se pudieron convertir). */
  neededG: number | null
  /** Si no se pudo convertir a gramos, cantidad en la unidad original. */
  neededQty: number | null
  unit: Unit
  pantryG: number
  /** Cantidad a comprar (g o unidad original). 0 = ya lo tienes. */
  toBuy: number
  sources: string[]
}

const SKIP = new Set(['agua', 'agua del grifo', 'hielo'])

export function aggregateShopping(recipes: PlannedRecipe[], pantry: PantryStock[]): AggregatedItem[] {
  const map = new Map<string, AggregatedItem>()

  for (const r of recipes) {
    const scaled = scaleIngredients(r.ingredients, r.baseServings, r.plannedServings)
    for (const ing of scaled) {
      if (SKIP.has(normalize(ing.name))) continue
      const food = resolveFood(ing.foodKey, ing.inlineFood)
      const g = toGrams(ing.quantity, ing.unit, food).grams
      const key = food ? `f:${food.key}` : g !== null ? `n:${normalize(ing.name)}` : `n:${normalize(ing.name)}:${ing.unit}`
      const existing = map.get(key)
      if (existing) {
        if (g !== null && existing.neededG !== null) existing.neededG += g
        else if (g === null && existing.neededQty !== null) existing.neededQty += ing.quantity
        if (!existing.sources.includes(r.title)) existing.sources.push(r.title)
      } else {
        map.set(key, {
          key,
          foodKey: food?.key ?? null,
          name: food?.name ?? ing.name,
          category: food?.category ?? 'otros',
          neededG: g,
          neededQty: g === null ? ing.quantity : null,
          unit: g === null ? ing.unit : 'g',
          pantryG: 0,
          toBuy: 0,
          sources: [r.title],
        })
      }
    }
  }

  // Resta lo que hay en la despensa (sólo cuando ambas cantidades se pueden expresar en gramos).
  for (const item of map.values()) {
    if (item.neededG !== null && item.foodKey) {
      const food = resolveFood(item.foodKey)
      const stock = pantry
        .filter((p) => p.status === 'disponible' && p.foodKey === item.foodKey && p.quantity !== null)
        .reduce((s, p) => s + (toGrams(p.quantity!, p.unit, food).grams ?? 0), 0)
      item.pantryG = stock
      item.toBuy = Math.max(0, Math.ceil(item.neededG - stock))
    } else if (item.neededG !== null) {
      item.toBuy = Math.ceil(item.neededG)
    } else {
      item.toBuy = item.neededQty ?? 0
    }
  }

  return [...map.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))
}

export interface ShoppingRow {
  id?: string
  item_key: string | null
  name: string
  quantity: number | null
  unit: string
  category: string
  checked: boolean
  source: 'manual' | 'plan' | 'recipe'
}

/**
 * Fusiona la lista generada con la existente: conserva SIEMPRE los productos
 * añadidos a mano, mantiene la marca de "comprado" de los que siguen siendo
 * necesarios y sustituye el resto de productos generados.
 */
export function mergeShoppingList(existing: ShoppingRow[], generated: AggregatedItem[], source: 'plan' | 'recipe' = 'plan'): { keep: ShoppingRow[]; upsert: ShoppingRow[]; remove: ShoppingRow[] } {
  const manual = existing.filter((r) => r.source === 'manual')
  const generatedRows = existing.filter((r) => r.source !== 'manual')
  const byKey = new Map(generatedRows.map((r) => [r.item_key, r]))
  const upsert: ShoppingRow[] = []
  const seen = new Set<string>()
  for (const g of generated) {
    if (g.toBuy <= 0) continue
    const prev = byKey.get(g.key)
    seen.add(g.key)
    upsert.push({
      id: prev?.id,
      item_key: g.key,
      name: g.name,
      quantity: g.toBuy,
      unit: g.unit,
      category: g.category,
      checked: prev ? prev.checked && (prev.quantity ?? 0) >= g.toBuy : false,
      source,
    })
  }
  const remove = generatedRows.filter((r) => !r.item_key || !seen.has(r.item_key))
  return { keep: manual, upsert, remove }
}

export const CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  carnes: 'Carnes',
  pescados: 'Pescados y mariscos',
  huevos_lacteos: 'Huevos y lácteos',
  bebidas_vegetales: 'Bebidas vegetales',
  frutas_verduras: 'Frutas y verduras',
  cereales_legumbres: 'Cereales y legumbres',
  panaderia: 'Panadería',
  despensa: 'Despensa',
  salsas: 'Salsas y condimentos',
  especias: 'Especias',
  frutos_secos: 'Frutos secos y semillas',
  congelados: 'Congelados',
  otros: 'Otros',
}
