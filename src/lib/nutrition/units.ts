import type { Food, Unit } from './types'

export const ML_PER_TBSP = 14.787
export const ML_PER_TSP = 4.929
export const ML_PER_CUP = 236.588

/** Grupos para los que asumir ~1 g/ml es razonable si USDA no da densidad. */
const WATERY_GROUPS = new Set(['dairy_liquid', 'broth', 'sauce', 'condiment'])

export interface GramConversion {
  grams: number | null
  /** true si la conversión usa una aproximación (no un peso medido por USDA). */
  approximate: boolean
  basis: string
}

/**
 * Convierte una cantidad a gramos usando, por orden de preferencia:
 * 1) unidades de masa; 2) pesos por porción medidos por USDA; 3) densidad USDA;
 * 4) aproximaciones explícitamente marcadas. Si no hay forma fiable, grams = null
 * y la interfaz debe pedir el peso al usuario.
 */
export function toGrams(quantity: number, unit: Unit, food: Food | undefined): GramConversion {
  if (!Number.isFinite(quantity) || quantity < 0) return { grams: null, approximate: false, basis: 'cantidad no válida' }
  switch (unit) {
    case 'g':
      return { grams: quantity, approximate: false, basis: 'peso' }
    case 'kg':
      return { grams: quantity * 1000, approximate: false, basis: 'peso' }
    case 'ml':
    case 'l': {
      const ml = unit === 'l' ? quantity * 1000 : quantity
      if (!food) return { grams: null, approximate: false, basis: 'sin alimento' }
      if (food.portions.densityGPerMl) return { grams: ml * food.portions.densityGPerMl, approximate: false, basis: 'densidad USDA' }
      if (WATERY_GROUPS.has(food.group)) return { grams: ml, approximate: true, basis: '≈1 g/ml (aproximación)' }
      return { grams: null, approximate: false, basis: 'sin densidad conocida' }
    }
    case 'cda': {
      if (!food) return { grams: null, approximate: false, basis: 'sin alimento' }
      if (food.portions.tbspG) return { grams: quantity * food.portions.tbspG, approximate: false, basis: 'cucharada USDA' }
      if (food.portions.densityGPerMl) return { grams: quantity * ML_PER_TBSP * food.portions.densityGPerMl, approximate: false, basis: 'densidad USDA' }
      if (food.portions.tspG) return { grams: quantity * food.portions.tspG * 3, approximate: false, basis: 'cucharadita USDA ×3' }
      return { grams: quantity * ML_PER_TBSP, approximate: true, basis: '≈15 g por cucharada (aproximación)' }
    }
    case 'cdta': {
      if (!food) return { grams: null, approximate: false, basis: 'sin alimento' }
      if (food.portions.tspG) return { grams: quantity * food.portions.tspG, approximate: false, basis: 'cucharadita USDA' }
      if (food.portions.tbspG) return { grams: (quantity * food.portions.tbspG) / 3, approximate: false, basis: 'cucharada USDA ÷3' }
      if (food.portions.densityGPerMl) return { grams: quantity * ML_PER_TSP * food.portions.densityGPerMl, approximate: false, basis: 'densidad USDA' }
      return { grams: quantity * ML_PER_TSP, approximate: true, basis: '≈5 g por cucharadita (aproximación)' }
    }
    case 'taza': {
      if (!food) return { grams: null, approximate: false, basis: 'sin alimento' }
      if (food.portions.cupG) return { grams: quantity * food.portions.cupG, approximate: false, basis: 'taza USDA' }
      if (food.portions.densityGPerMl) return { grams: quantity * ML_PER_CUP * food.portions.densityGPerMl, approximate: false, basis: 'densidad USDA' }
      return { grams: null, approximate: false, basis: 'sin peso por taza' }
    }
    case 'unidad': {
      if (!food) return { grams: null, approximate: false, basis: 'sin alimento' }
      const g = food.portions.unit?.grams
      if (g) return { grams: quantity * g, approximate: true, basis: `${food.portions.unit!.name} ≈ ${g} g (USDA; el tamaño real varía)` }
      return { grams: null, approximate: false, basis: 'peso por unidad desconocido' }
    }
    case 'pizca': {
      const tsp = food?.portions.tspG ?? (food?.portions.tbspG ? food.portions.tbspG / 3 : null)
      return { grams: quantity * (tsp ? tsp / 16 : 0.3), approximate: true, basis: 'pizca ≈ 1/16 cucharadita (aproximación)' }
    }
  }
}

/** Convierte gramos de vuelta a la unidad indicada (para mostrar cantidades optimizadas). */
export function fromGrams(grams: number, unit: Unit, food: Food | undefined): number | null {
  const one = toGrams(1, unit, food).grams
  if (!one) return null
  return grams / one
}

export const UNIT_LABELS: Record<Unit, { one: string; many: string }> = {
  g: { one: 'g', many: 'g' },
  kg: { one: 'kg', many: 'kg' },
  ml: { one: 'ml', many: 'ml' },
  l: { one: 'l', many: 'l' },
  unidad: { one: 'unidad', many: 'unidades' },
  cda: { one: 'cucharada', many: 'cucharadas' },
  cdta: { one: 'cucharadita', many: 'cucharaditas' },
  taza: { one: 'taza', many: 'tazas' },
  pizca: { one: 'pizca', many: 'pizcas' },
}

export function formatQuantity(q: number): string {
  if (!Number.isFinite(q)) return '—'
  if (q >= 100) return String(Math.round(q))
  if (q >= 10) return String(Math.round(q * 2) / 2).replace('.', ',')
  const fractions: [number, string][] = [
    [0.25, '¼'],
    [0.33, '⅓'],
    [0.5, '½'],
    [0.66, '⅔'],
    [0.75, '¾'],
  ]
  const whole = Math.floor(q)
  const rest = q - whole
  for (const [v, s] of fractions) if (Math.abs(rest - v) < 0.04) return whole ? `${whole} ${s}` : s
  return String(Math.round(q * 10) / 10).replace('.', ',')
}

export function formatIngredientAmount(quantity: number, unit: Unit, foodUnitName?: string | null): string {
  const label = unit === 'unidad' && foodUnitName ? foodUnitName : quantity === 1 ? UNIT_LABELS[unit].one : UNIT_LABELS[unit].many
  return `${formatQuantity(quantity)} ${label}`
}
