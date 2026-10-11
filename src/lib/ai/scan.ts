import 'server-only'
import { getFood, searchFoods } from '@/lib/nutrition/catalog'
import { AIError, callStructured } from './client'
import { SCAN_SYSTEM } from './prompts'
import { ScanOutput } from './schemas'

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export type ImageType = (typeof ALLOWED_IMAGE_TYPES)[number]
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export interface DetectedItem {
  name: string
  foodKey: string | null
  foodName: string | null
  confidence: 'alta' | 'media' | 'baja'
  state: 'crudo' | 'cocinado' | 'congelado' | 'conserva' | 'desconocido'
  count: number | null
  packaging: string | null
  note: string | null
  /** true si hace falta que el usuario confirme explícitamente qué es. */
  needsConfirmation: boolean
}

export interface ScanResult {
  items: DetectedItem[]
  unidentified: { description: string; possibilities: string[] }[]
  imageQuality: 'buena' | 'regular' | 'mala'
  notFood: boolean
}

/** Post-procesado determinista: valida claves de catálogo y marca lo que requiere confirmación. */
export function normalizeScan(raw: ScanOutput): ScanResult {
  const items: DetectedItem[] = raw.items.map((it) => {
    let food = getFood(it.catalogKey)
    // Si la IA dio una clave inexistente, no se usa; se intenta por nombre y se pide confirmación.
    const keyWasInvalid = it.catalogKey !== null && !food
    if (!food) food = searchFoods(it.name, 1)[0]
    return {
      name: it.name,
      foodKey: food?.key ?? null,
      foodName: food?.name ?? null,
      confidence: it.confidence,
      state: it.state,
      count: it.count !== null && it.count > 0 && it.count < 100 ? Math.round(it.count) : null,
      packaging: it.packaging,
      note: it.note,
      needsConfirmation: it.confidence !== 'alta' || keyWasInvalid || !food,
    }
  })
  return { items, unidentified: raw.unidentified, imageQuality: raw.imageQuality, notFood: raw.notFood }
}

export async function analyzeFoodImage(base64: string, mediaType: ImageType) {
  if (!ALLOWED_IMAGE_TYPES.includes(mediaType)) throw new AIError('bad_request', 'Formato de imagen no admitido. Usa JPG, PNG, WEBP o GIF.', false, 400)
  const result = await callStructured({
    system: [{ type: 'text', text: SCAN_SYSTEM, cache_control: { type: 'ephemeral' } }],
    content: [
      { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
      { type: 'text', text: 'Enumera los alimentos visibles en esta imagen siguiendo las reglas.' },
    ],
    schema: ScanOutput,
    effort: 'low',
    maxTokens: 6000,
  })
  return { ...result, data: normalizeScan(result.data) }
}
