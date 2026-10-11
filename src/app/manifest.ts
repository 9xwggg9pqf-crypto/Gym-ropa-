import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SNACKEATS — cocina inteligente',
    short_name: 'SNACKEATS',
    description: 'Lo que tienes. Lo que te apetece. Lo que necesitas. Recetas con IA y nutrición calculada con datos de USDA.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F5FA',
    theme_color: '#4A2160',
    lang: 'es',
    orientation: 'portrait',
    categories: ['food', 'health', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  }
}
