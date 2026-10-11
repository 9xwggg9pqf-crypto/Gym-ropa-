import { NextResponse } from 'next/server'
import { jsonError, requireUser } from '@/lib/api'
import { serverEnv } from '@/lib/env'
import type { Food } from '@/lib/nutrition/types'

export const runtime = 'nodejs'

// Búsqueda en USDA FoodData Central (API oficial) para alimentos que no están
// en el catálogo curado. Requiere FDC_API_KEY (gratuita en api.data.gov).
// Los nombres de FDC están en inglés; se muestran tal cual para no traducir mal.
const NUTRIENT_IDS: Record<number, keyof Food['per100g']> = { 1008: 'kcal', 1003: 'protein', 1005: 'carbs', 1004: 'fat', 1079: 'fiber', 2000: 'sugars', 1258: 'satFat', 1093: 'sodiumMg' }

interface FdcFood {
  fdcId: number
  description: string
  dataType: string
  brandOwner?: string
  foodNutrients: { nutrientId: number; value: number; unitName: string }[]
}

export async function GET(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  const key = serverEnv().fdcApiKey
  if (!key) return jsonError(503, 'not_configured', 'La búsqueda ampliada en USDA no está configurada (falta FDC_API_KEY).')
  const q = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (q.length < 2 || q.length > 80) return jsonError(400, 'bad_request', 'Escribe entre 2 y 80 caracteres.')

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search')
  url.searchParams.set('query', q)
  url.searchParams.set('pageSize', '15')
  url.searchParams.set('dataType', 'Foundation,SR Legacy')
  url.searchParams.set('api_key', key)
  let res: Response
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
  } catch {
    return jsonError(503, 'unavailable', 'USDA FoodData Central no responde. Inténtalo más tarde.', { retryable: true })
  }
  if (!res.ok) return jsonError(503, 'unavailable', `USDA FoodData Central devolvió un error (${res.status}).`, { retryable: res.status >= 500 || res.status === 429 })
  const json = (await res.json()) as { foods?: FdcFood[] }
  const foods: Food[] = (json.foods ?? [])
    .map((f) => {
      const per100g = { kcal: null, protein: null, carbs: null, fat: null, fiber: null, sugars: null, satFat: null, sodiumMg: null } as Food['per100g']
      for (const n of f.foodNutrients) {
        const k = NUTRIENT_IDS[n.nutrientId]
        if (!k) continue
        if (k === 'kcal' && n.unitName.toUpperCase() !== 'KCAL') continue
        per100g[k] = n.value
      }
      return {
        key: `fdc:${f.fdcId}`,
        fdcId: f.fdcId,
        name: f.description,
        aliases: [],
        usdaDescription: `${f.description} (${f.dataType})`,
        category: 'otros',
        group: 'other',
        state: 'raw',
        allergens: [],
        mayContain: [],
        animal: null,
        per100g,
        portions: { unit: null, tbspG: null, tspG: null, cupG: null, densityGPerMl: null },
        source: 'usda_fdc_api',
      } satisfies Food
    })
    // Sólo alimentos con los cuatro valores principales (no se rellenan huecos).
    .filter((f) => f.per100g.kcal !== null && f.per100g.protein !== null && f.per100g.carbs !== null && f.per100g.fat !== null)
  return NextResponse.json({ foods, note: 'Datos de USDA FoodData Central. Los alérgenos de estos alimentos no están catalogados: revísalos tú.' })
}
