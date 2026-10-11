// Punto de entrada de la versión de prueba de SNACKEATS (artefacto privado en claude.ai).
// Reutiliza las pantallas reales de la app; sólo cambian el enrutado, los datos y la IA.
import { Component, useEffect, type ComponentType, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from '@/app/providers'
import HomePage from '@/app/page'
import ScanPage from '@/app/escanear/page'
import CreatePage from '@/app/crear/page'
import DraftRecipePage from '@/app/receta/page'
import DraftCookPage from '@/app/receta/cocinar/page'
import RecipesPage from '@/app/recetas/page'
import SavedRecipePage from '@/app/recetas/[id]/page'
import SavedCookPage from '@/app/recetas/[id]/cocinar/page'
import VersionsPage from '@/app/recetas/[id]/versiones/page'
import PlanPage from '@/app/plan/page'
import ShoppingPage from '@/app/compra/page'
import PantryPage from '@/app/despensa/page'
import ProfilePage from '@/app/perfil/page'
import PlansPage from '@/app/planes/page'
import PrivacyPage from '@/app/privacidad/page'
import TermsPage from '@/app/terminos/page'
import NotFound from '@/app/not-found'
import { ErrorBox } from '@/components/ui'
import { navigate, ParamsContext, usePathname } from './shims/next-navigation'
import { exportData, handleApi } from './shims/api-handlers'
import { cap } from './shims/runtime'

function AboutPage() {
  return (
    <article className="flex max-w-prose flex-col gap-4 text-[15px] leading-relaxed">
      <p className="label-caps text-brand-ink">Versión de prueba</p>
      <h1 className="font-display text-2xl font-semibold">Así funciona esta versión</h1>
      <ul className="flex list-disc flex-col gap-2 pl-5">
        <li>Es privada: sólo la puedes abrir tú desde tu cuenta de claude.ai, salvo que decidas compartirla.</li>
        <li>Tus datos (perfil, recetas, despensa, plan y lista) se guardan en el almacén privado de este artefacto, separado de cualquier otra persona.</li>
        <li>El escáner y la generación de recetas usan tu propia cuenta de Claude: la primera vez te pedirá permiso.</li>
        <li>El cálculo nutricional es el mismo motor que la app completa, con datos de USDA.</li>
        <li>No incluye pagos, cuotas, búsqueda ampliada en USDA ni fotos de referencia.</li>
      </ul>
    </article>
  )
}

const ROUTES: [RegExp, ComponentType][] = [
  [/^\/$/, HomePage],
  [/^\/escanear$/, ScanPage],
  [/^\/crear$/, CreatePage],
  [/^\/receta$/, DraftRecipePage],
  [/^\/receta\/cocinar$/, DraftCookPage],
  [/^\/recetas$/, RecipesPage],
  [/^\/recetas\/(?<id>[^/]+)$/, SavedRecipePage],
  [/^\/recetas\/(?<id>[^/]+)\/cocinar$/, SavedCookPage],
  [/^\/recetas\/(?<id>[^/]+)\/versiones$/, VersionsPage],
  [/^\/plan$/, PlanPage],
  [/^\/compra$/, ShoppingPage],
  [/^\/despensa$/, PantryPage],
  [/^\/perfil$/, ProfilePage],
  [/^\/planes$/, PlansPage],
  [/^\/privacidad$/, PrivacyPage],
  [/^\/terminos$/, TermsPage],
  [/^\/(configuracion|entrar|acerca)$/, AboutPage],
]

class Boundary extends Component<{ children: ReactNode; path: string }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidUpdate(prev: { path: string }) {
    if (prev.path !== this.props.path && this.state.failed) this.setState({ failed: false })
  }
  render() {
    return this.state.failed ? <ErrorBox title="Algo ha fallado al mostrar esta pantalla" message="Vuelve al inicio o recarga la página." onRetry={() => this.setState({ failed: false })} /> : this.props.children
  }
}

function Router() {
  const path = usePathname()
  useEffect(() => window.scrollTo(0, 0), [path])
  for (const [re, Page] of ROUTES) {
    const m = path.match(re)
    if (m) {
      return (
        <ParamsContext.Provider value={{ ...(m.groups ?? {}) }}>
          <Boundary path={path}>
            <Page />
          </Boundary>
        </ParamsContext.Provider>
      )
    }
  }
  return <NotFound />
}

// ── Adaptaciones al visor de claude.ai ──────────────────────────────────────

// Las rutas /api/* se atienden en el navegador.
const realFetch = window.fetch.bind(window)
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('/api/')) return handleApi(url, init?.method ?? 'GET', init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined, init?.body)
  return realFetch(input, init)
}

// Los enlaces internos normales navegan por hash; la exportación usa el guardado del visor.
document.addEventListener(
  'click',
  (e) => {
    const a = (e.target as HTMLElement | null)?.closest?.('a')
    if (!a) return
    const href = a.getAttribute('href') ?? ''
    if (href.startsWith('/api/account/export')) {
      e.preventDefault()
      void exportData()
    } else if (href.startsWith('/') && !href.startsWith('//')) {
      e.preventDefault()
      navigate(href)
    }
  },
  true,
)

// Descargas generadas con <a download> → guardado con confirmación del visor.
const blobs = new Map<string, Blob>()
const realCreate = URL.createObjectURL.bind(URL)
URL.createObjectURL = (obj: Blob | MediaSource) => {
  const u = realCreate(obj)
  if (obj instanceof Blob) blobs.set(u, obj)
  return u
}
const realClick = HTMLAnchorElement.prototype.click
HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
  const blob = blobs.get(this.href)
  if (this.download && blob) {
    void cap('downloads').then((d: { save(r: { filename: string; data: Blob }): Promise<unknown> } | null) => d?.save({ filename: this.download, data: blob }).catch(() => {}))
    return
  }
  realClick.call(this)
}

// Compartir del sistema no está disponible dentro del visor: se usa el portapapeles.
try {
  Object.defineProperty(navigator, 'share', { value: undefined, configurable: true })
} catch {
  /* sin cambios */
}

createRoot(document.getElementById('snackeats-root')!).render(
  <Providers>
    <Router />
  </Providers>,
)
