import { requireUser, withQuota, jsonError } from '@/lib/api'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, analyzeFoodImage, type ImageType } from '@/lib/ai/scan'

export const runtime = 'nodejs'
export const maxDuration = 60

// La imagen se procesa en memoria y se envía a la IA; NO se almacena.
export async function POST(request: Request) {
  const auth = await requireUser()
  if (auth instanceof Response) return auth
  // Rechaza cuerpos demasiado grandes antes de leerlos en memoria.
  const length = Number(request.headers.get('content-length') ?? 0)
  if (length > MAX_IMAGE_BYTES + 64 * 1024) return jsonError(413, 'too_large', 'La imagen supera los 5 MB. Prueba con una foto más pequeña.')
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return jsonError(400, 'bad_request', 'Envía la imagen como formulario (campo "image").')
  }
  const file = form.get('image')
  if (!(file instanceof File)) return jsonError(400, 'bad_request', 'Falta la imagen.')
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as ImageType)) return jsonError(415, 'unsupported_type', 'Formato no admitido. Usa JPG, PNG, WEBP o GIF.')
  if (file.size > MAX_IMAGE_BYTES) return jsonError(413, 'too_large', 'La imagen supera los 5 MB. Prueba con una foto más pequeña.')
  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')

  return withQuota(auth, 'scan', async () => {
    const r = await analyzeFoodImage(base64, file.type as ImageType)
    await auth.supabase.from('search_history').insert({ query: `Escaneo: ${r.data.items.map((i) => i.name).slice(0, 8).join(', ') || 'sin resultados'}`.slice(0, 500), kind: 'scan' })
    return { result: r.data, usage: { model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens } }
  })
}
