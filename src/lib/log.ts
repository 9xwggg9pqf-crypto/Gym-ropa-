// Registro técnico mínimo y sin datos personales: sólo códigos de evento y
// metadatos técnicos (nunca textos de usuario, imágenes, correos ni recetas).
// Para monitorización en producción, este punto único puede enviarse a un
// servicio externo (p. ej. Sentry) una vez configurado.

type Level = 'info' | 'warn' | 'error'
const SAFE_KEYS = new Set(['kind', 'code', 'status', 'message', 'route', 'plan', 'event', 'durationMs'])

export function logEvent(level: Level, event: string, meta: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(meta)) {
    if (SAFE_KEYS.has(k) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      safe[k] = typeof v === 'string' ? v.slice(0, 200) : v
    }
  }
  const line = JSON.stringify({ t: new Date().toISOString(), level, event, ...safe })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}
