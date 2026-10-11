import type { Metadata, Viewport } from 'next'
import { Figtree, IBM_Plex_Mono, Unbounded } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const display = Unbounded({ subsets: ['latin'], variable: '--font-display', weight: ['500', '600', '700'], display: 'swap' })
const body = Figtree({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], variable: '--font-mono', weight: ['400', '500', '600'], display: 'swap' })

export const metadata: Metadata = {
  title: { default: 'SNACKEATS — cocina inteligente', template: '%s · SNACKEATS' },
  description: 'Lo que tienes. Lo que te apetece. Lo que necesitas. Escanea tu nevera, crea recetas con IA y ajusta calorías y macros con datos de USDA.',
  applicationName: 'SNACKEATS',
  appleWebApp: { capable: true, title: 'SNACKEATS', statusBarStyle: 'default' },
  icons: { icon: '/icons/icon.svg', apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F7F5FA' },
    { media: '(prefers-color-scheme: dark)', color: '#150F1A' },
  ],
}

// Aplica el tema guardado antes del primer pintado (evita parpadeo).
const themeScript = `try{var t=localStorage.getItem('snackeats-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${display.variable} ${body.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
