// Rutas /api/* de la app, ejecutadas en el navegador para la versión de prueba.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { GenerateInput, generateRecipes } from '@/lib/ai/recipes'
import { normalizeScan } from '@/lib/ai/scan'
import { SCAN_SYSTEM } from '@/lib/ai/prompts'
import { ScanOutput } from '@/lib/ai/schemas'
import { SaveRecipeInput } from '@/lib/recipes/schema'
import { toDietaryProfileClient } from '@/lib/profile'
import type { ProfileRow, PantryRow, RecipeRow } from '@/lib/api-types'
import type { Recipe } from '@/lib/nutrition/types'
import { AIError, callStructured } from './ai-client'
import { cap } from './runtime'
import { listAll, profileDoc, removeOne } from './store'

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const err = (status: number, code: string, message: string, extra: Record<string, unknown> = {}) => json(status, { error: { code, message, ...extra } })

async function profile(): Promise<ProfileRow | null> {
  const ref = await profileDoc()
  if (!ref) return null
  const s = await ref.get().catch(() => null)
  return s?.exists ? (s.data() as ProfileRow) : null
}

function aiError(e: unknown) {
  if (e instanceof AIError) return err(e.httpStatus, e.code, e.message, { retryable: e.retryable })
  return err(500, 'internal', 'Ha ocurrido un error inesperado. Inténtalo de nuevo.', { retryable: true })
}

async function blobToBase64(b: Blob): Promise<string> {
  const buf = new Uint8Array(await b.arrayBuffer())
  let s = ''
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(s)
}

export async function handleApi(url: string, method: string, body?: unknown, rawBody?: unknown): Promise<Response> {
  const path = url.split('?')[0]
  const cd = await import('./client-data')
  try {
    if (path === '/api/status') return json(200, { supabase: true, serviceRole: true, ai: true, fdc: false, stripe: false, photos: false })

    if (path === '/api/recipes/generate' && method === 'POST') {
      const parsed = GenerateInput.safeParse(body)
      if (!parsed.success) return err(400, 'bad_request', 'Datos de la petición no válidos.')
      const input = parsed.data
      const [p, pantryRows, recipes] = await Promise.all([profile(), listAll<PantryRow>('pantry').catch(() => []), listAll<RecipeRow>('recipes').catch(() => [])])
      const favoriteRecipes = p?.personalization_consent ? recipes.filter((r) => r.is_favorite).slice(0, 10).map((r) => r.title.slice(0, 80)) : []
      try {
        const r = await generateRecipes(
          input,
          {
            profile: toDietaryProfileClient(p),
            pantry: pantryRows.map((x) => ({ foodKey: x.food_key, name: x.name, quantity: x.quantity === null ? null : Number(x.quantity), unit: x.unit, status: x.status })),
            locale: p?.locale ?? 'es',
            cookingLevel: p?.cooking_level,
            budget: p?.budget,
            usualMinutes: p?.usual_minutes,
            defaultServings: p?.default_servings,
            favorites: p?.favorites,
            favoriteRecipes,
          },
          callStructured as never,
        )
        if (input.request.trim()) await cd.addHistory(input.request.trim(), input.mode === 'plato_concreto' ? 'dish' : 'ingredients')
        const { usage: _u, ...result } = r
        void _u
        return json(200, { ...result, quota: { plan: 'prueba', used: 0, limit: 0 } })
      } catch (e) {
        return aiError(e)
      }
    }

    if (path === '/api/scan' && method === 'POST') {
      const form = rawBody instanceof FormData ? rawBody : null
      const file = form?.get('image')
      if (!(file instanceof Blob)) return err(400, 'bad_request', 'Falta la imagen.')
      if (file.size > 5 * 1024 * 1024) return err(413, 'too_large', 'La imagen supera los 5 MB.')
      try {
        const r = await callStructured({
          system: [{ type: 'text', text: SCAN_SYSTEM }],
          content: [
            { type: 'image', source: { type: 'base64', media_type: file.type || 'image/jpeg', data: await blobToBase64(file) } },
            { type: 'text', text: 'Enumera los alimentos visibles en esta imagen siguiendo las reglas.' },
          ],
          schema: ScanOutput,
          effort: 'low',
          maxTokens: 6000,
        })
        const data = normalizeScan(r.data)
        await cd.addHistory(`Escaneo: ${data.items.map((i) => i.name).slice(0, 8).join(', ') || 'sin resultados'}`, 'scan')
        return json(200, { ...data, quota: { plan: 'prueba', used: 0, limit: 0 } })
      } catch (e) {
        return aiError(e)
      }
    }

    if (path === '/api/recipes' && method === 'POST') {
      const parsed = SaveRecipeInput.safeParse(body)
      if (!parsed.success) return err(400, 'bad_request', 'La receta no es válida.')
      const row = await cd.insertRecipe({ recipe: parsed.data.recipe as Recipe, targets: parsed.data.targets as never, source: parsed.data.source, parentId: parsed.data.parentId ?? null })
      return json(200, { id: row.id })
    }

    if (path === '/api/account/delete' && method === 'POST') {
      if ((body as any)?.confirm !== 'ELIMINAR') return err(400, 'confirmation_required', 'Escribe ELIMINAR para confirmar.')
      for (const c of ['recipes', 'collections', 'pantry', 'shopping', 'plan', 'history', 'foods']) {
        for (const d of await listAll<{ id: string }>(c)) await removeOne(c, d.id)
      }
      const ref = await profileDoc()
      await ref?.delete()
      return json(200, { deleted: true })
    }

    if (path === '/api/foods/fdc') return err(503, 'not_configured', 'La búsqueda ampliada en USDA no está disponible en la versión de prueba.')
    if (path.startsWith('/api/stripe/')) return err(503, 'billing_not_configured', 'Los pagos no están activos en la versión de prueba.')
    return err(404, 'not_found', 'Ruta no disponible en la versión de prueba.')
  } catch (e: any) {
    if (e?.message === 'not_configured') return err(503, 'not_configured', 'Abre la app desde claude.ai con tu sesión iniciada.')
    return err(500, 'internal', 'Ha ocurrido un error inesperado. Inténtalo de nuevo.', { retryable: true })
  }
}

/** Exporta todos tus datos de la versión de prueba como JSON (con confirmación del visor). */
export async function exportData() {
  const downloads = await cap<any>('downloads')
  if (!downloads) return false
  const out: Record<string, unknown> = { exportedAt: new Date().toISOString(), profile: await profile() }
  for (const c of ['recipes', 'collections', 'pantry', 'shopping', 'plan', 'history', 'foods']) out[c] = await listAll(c).catch(() => [])
  await downloads.save({ filename: `snackeats-datos-${new Date().toISOString().slice(0, 10)}.json`, data: JSON.stringify(out, null, 2) })
  return true
}
