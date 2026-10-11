import { CheckCircle2, CircleDashed } from 'lucide-react'
import { integrationStatus } from '@/lib/env'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Estado de la configuración' }

const ITEMS = [
  { key: 'supabase', name: 'Supabase (base de datos y cuentas)', env: 'NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY', need: 'Imprescindible para guardar datos, iniciar sesión y usar la IA (las cuotas se guardan en la base de datos).' },
  { key: 'serviceRole', name: 'Clave de servicio de Supabase', env: 'SUPABASE_SERVICE_ROLE_KEY', need: 'Necesaria para borrar cuentas, procesar pagos y devolver cuota si la IA falla. Sólo en el servidor.' },
  { key: 'ai', name: 'IA (Anthropic Claude)', env: 'ANTHROPIC_API_KEY (opcional: ANTHROPIC_MODEL)', need: 'Necesaria para el escáner de fotos y la generación de recetas.' },
  { key: 'stripe', name: 'Pagos (Stripe)', env: 'STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET y stripe_price_id en la tabla plans', need: 'Sólo para cobrar Premium. Sin ella, la app funciona en modo gratuito.' },
  { key: 'fdc', name: 'Búsqueda ampliada USDA', env: 'FDC_API_KEY', need: 'Opcional: buscar alimentos que no están en el catálogo curado.' },
  { key: 'photos', name: 'Fotos de recetas (Unsplash)', env: 'UNSPLASH_ACCESS_KEY', need: 'Opcional: añade una foto de referencia (con atribución) al guardar una receta. Sin ella se usan portadas ilustradas.' },
] as const

export default function ConfigPage() {
  const s = integrationStatus()
  return (
    <div className="flex flex-col gap-5">
      <header>
        <p className="label-caps text-brand-ink">Para el equipo</p>
        <h1 className="font-display text-2xl font-semibold">Estado de la configuración</h1>
        <p className="mt-1 max-w-prose text-[15px] text-muted">Qué integraciones están conectadas en este servidor. Nunca se muestran los valores de las claves. Instrucciones completas en el README del proyecto.</p>
      </header>
      <ul className="flex flex-col gap-3">
        {ITEMS.map((it) => {
          const ok = s[it.key]
          return (
            <li key={it.key} className="flex gap-3 rounded-2xl border border-line bg-surface p-4">
              {ok ? <CheckCircle2 className="h-6 w-6 shrink-0 text-ok" aria-label="Configurado" /> : <CircleDashed className="h-6 w-6 shrink-0 text-muted" aria-label="Pendiente" />}
              <div className="min-w-0">
                <p className="font-semibold">{it.name}</p>
                <p className="text-sm text-muted">{it.need}</p>
                <p className="mt-1 break-words font-mono text-xs text-muted">{it.env}</p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
