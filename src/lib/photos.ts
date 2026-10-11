import 'server-only'
import { serverEnv } from '@/lib/env'

// Foto de referencia de Unsplash (opcional). Se muestra como "foto de referencia",
// nunca como foto del plato cocinado por el usuario, y siempre con atribución.
// Directrices de la API: enlazar la imagen desde Unsplash (hotlink) y notificar la descarga.
export async function findReferencePhoto(query: string): Promise<{ url: string; credit: string } | null> {
  const key = serverEnv().unsplashKey
  if (!key || !query.trim()) return null
  try {
    const url = new URL('https://api.unsplash.com/search/photos')
    url.searchParams.set('query', `${query} food`)
    url.searchParams.set('per_page', '1')
    url.searchParams.set('orientation', 'landscape')
    url.searchParams.set('content_filter', 'high')
    const res = await fetch(url, { headers: { Authorization: `Client-ID ${key}`, 'Accept-Version': 'v1' }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const json = (await res.json()) as { results?: { urls: { regular: string }; user: { name: string }; links: { download_location: string } }[] }
    const p = json.results?.[0]
    if (!p || !p.urls.regular.startsWith('https://images.unsplash.com/')) return null
    fetch(p.links.download_location, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(5000) }).catch(() => {})
    return { url: p.urls.regular, credit: `Foto de referencia: ${p.user.name} / Unsplash` }
  } catch {
    return null
  }
}
