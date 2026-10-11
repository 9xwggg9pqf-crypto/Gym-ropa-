import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import type * as z from 'zod/v4'
import { serverEnv } from '@/lib/env'

export type AIErrorCode = 'not_configured' | 'unavailable' | 'rate_limited' | 'refused' | 'invalid_output' | 'bad_request'

/** Error de IA con mensaje apto para el usuario. Nunca se sustituye por resultados inventados. */
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

let client: Anthropic | null = null
function getClient(): Anthropic {
  const { anthropicKey } = serverEnv()
  if (!anthropicKey) throw new AIError('not_configured', 'La inteligencia artificial no está configurada todavía (falta ANTHROPIC_API_KEY).', false, 503)
  if (!client) client = new Anthropic({ apiKey: anthropicKey, maxRetries: 2, timeout: 110_000 })
  return client
}

export interface StructuredCall<T extends z.ZodType> {
  system: Anthropic.Beta.BetaTextBlockParam[]
  content: Anthropic.Beta.BetaContentBlockParam[]
  schema: T
  effort: 'low' | 'medium' | 'high'
  maxTokens: number
}

export interface StructuredResult<T> {
  data: T
  model: string
  inputTokens: number
  outputTokens: number
}

/**
 * Llama a Claude con salida estructurada validada contra un esquema Zod.
 * Usa el modelo configurado (por defecto claude-opus-5-5) con el mecanismo de
 * respaldo del servidor ante rechazos por seguridad (`fallbacks: "default"`).
 */
export async function callStructured<T extends z.ZodType>(call: StructuredCall<T>): Promise<StructuredResult<z.infer<T>>> {
  const anthropic = getClient()
  const model = serverEnv().anthropicModel
  let response
  try {
    response = await anthropic.beta.messages.parse({
      model,
      max_tokens: call.maxTokens,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: call.effort, format: betaZodOutputFormat(call.schema) },
      system: call.system,
      messages: [{ role: 'user', content: call.content }],
    })
  } catch (error) {
    throw mapError(error)
  }

  if (response.stop_reason === 'refusal') {
    throw new AIError('refused', 'La IA no ha podido atender esta petición. Prueba a reformularla.', false, 422)
  }
  if (response.stop_reason === 'max_tokens') {
    throw new AIError('invalid_output', 'La respuesta de la IA quedó incompleta. Inténtalo de nuevo.', true, 502)
  }
  const parsed = response.parsed_output as z.infer<T> | null | undefined
  if (!parsed) {
    throw new AIError('invalid_output', 'La IA devolvió una respuesta que no se pudo validar. Inténtalo de nuevo.', true, 502)
  }
  return {
    data: parsed,
    model: response.model,
    inputTokens: response.usage.input_tokens + (response.usage.cache_read_input_tokens ?? 0) + (response.usage.cache_creation_input_tokens ?? 0),
    outputTokens: response.usage.output_tokens,
  }
}

function mapError(error: unknown): AIError {
  if (error instanceof AIError) return error
  if (error instanceof Anthropic.RateLimitError) return new AIError('rate_limited', 'El servicio de IA está saturado. Espera unos segundos y vuelve a intentarlo.', true, 503)
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new AIError('not_configured', 'La clave de la API de IA no es válida o no tiene permisos.', false, 503)
  }
  if (error instanceof Anthropic.BadRequestError) return new AIError('bad_request', 'La petición a la IA no es válida (por ejemplo, una imagen demasiado grande o en un formato no admitido).', false, 400)
  if (error instanceof Anthropic.APIConnectionError) return new AIError('unavailable', 'No se ha podido conectar con el servicio de IA. Comprueba la conexión y vuelve a intentarlo.', true, 503)
  if (error instanceof Anthropic.APIError) return new AIError('unavailable', 'El servicio de IA no responde en este momento. Vuelve a intentarlo en unos minutos.', true, 503)
  return new AIError('unavailable', 'Error inesperado al contactar con la IA. Vuelve a intentarlo.', true, 503)
}
