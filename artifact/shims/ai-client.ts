// Sustituto de src/lib/ai/client.ts: en la versión de prueba la IA se llama desde
// el navegador con la capacidad `sample` (la cuenta de Claude de quien la usa).
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as z from 'zod/v4'
import { cap } from './runtime'

export type AIErrorCode = 'not_configured' | 'unavailable' | 'rate_limited' | 'refused' | 'invalid_output' | 'bad_request'
export class AIError extends Error {
  constructor(
    public code: AIErrorCode,
    message: string,
    public retryable: boolean,
    public httpStatus: number,
  ) {
    super(message)
  }
}

export interface StructuredCall<T extends z.ZodType> {
  system: { type: 'text'; text: string; cache_control?: unknown }[]
  content: ({ type: 'text'; text: string } | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } })[]
  schema: T
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
}

/** Rellena campos obligatorios ausentes con valores neutros (null/[]/false) según el esquema JSON. */
function fill(value: any, schema: any): any {
  if (!schema) return value
  if (schema.anyOf) {
    if (value === undefined) return schema.anyOf.some((s: any) => s.type === 'null') ? null : value
    const nonNull = schema.anyOf.find((s: any) => s.type !== 'null')
    return value === null ? null : fill(value, nonNull)
  }
  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const out: any = {}
    for (const [k, s] of Object.entries<any>(schema.properties ?? {})) {
      let v = value[k]
      if (v === undefined) {
        if (s.anyOf?.some((x: any) => x.type === 'null')) v = null
        else if (s.type === 'array') v = []
        else if (s.type === 'boolean') v = false
      }
      out[k] = fill(v, s)
    }
    return out
  }
  if (schema.type === 'array' && Array.isArray(value)) return value.map((v) => fill(v, schema.items))
  return value
}

function b64ToBlob(data: string, type: string) {
  const bin = atob(data)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type })
}

export async function callStructured<T extends z.ZodType>(call: StructuredCall<T>): Promise<{ data: z.infer<T>; model: string; inputTokens: number; outputTokens: number }> {
  const sample = await cap<any>('sample')
  if (!sample) throw new AIError('not_configured', 'La IA no está disponible en esta vista. Abre la app desde claude.ai con tu sesión iniciada.', false, 503)
  const jsonSchema = z.toJSONSchema(call.schema)
  const images: Blob[] = []
  const texts: string[] = []
  for (const c of call.content) {
    if (c.type === 'image') images.push(b64ToBlob(c.source.data, c.source.media_type))
    else texts.push(c.text)
  }
  const prompt = [
    ...call.system.map((s) => s.text),
    '---',
    ...texts,
    '---',
    'Responde ÚNICAMENTE con un objeto JSON válido que cumpla exactamente este JSON Schema (incluye todos los campos; usa null cuando no aplique):',
    JSON.stringify(jsonSchema),
  ].join('\n\n')
  let raw: unknown
  try {
    raw = await sample.json(prompt, { images: images.length ? images : undefined, modelTier: call.effort === 'low' ? 'default' : 'complex', cache: false })
  } catch (e: any) {
    const code = e?.code
    if (code === 'not_granted' || code === 'sampling_disabled' || code === 'not_declared') throw new AIError('not_configured', 'Para usar la IA, permite que la app use Claude cuando te lo pregunte (puedes cambiarlo en los permisos del artefacto).', false, 503)
    if (code === 'rate_limited') throw new AIError('rate_limited', 'Has alcanzado un límite de uso de Claude. Espera un poco y vuelve a intentarlo.', true, 429)
    if (code === 'refused') throw new AIError('refused', 'Claude no ha podido atender esta petición. Prueba a reformularla.', false, 422)
    if (code === 'invalid_json') throw new AIError('invalid_output', 'La respuesta de la IA no se pudo leer. Inténtalo de nuevo.', true, 502)
    if (code === 'image_rejected' || code === 'images_unavailable') throw new AIError('bad_request', 'No se ha podido enviar la imagen. Prueba con otra foto (JPG o PNG).', false, 400)
    if (code === 'cancelled') throw new AIError('unavailable', 'Operación cancelada.', true, 499)
    throw new AIError('unavailable', 'El servicio de IA no responde en este momento. Vuelve a intentarlo.', true, 503)
  }
  const parsed = call.schema.safeParse(fill(raw, jsonSchema))
  if (!parsed.success) throw new AIError('invalid_output', 'La IA devolvió una respuesta incompleta. Inténtalo de nuevo.', true, 502)
  return { data: parsed.data, model: 'claude (cuenta del usuario)', inputTokens: 0, outputTokens: 0 }
}
