'use client'
import { Check, Crown } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { api, listPlans } from '@/lib/client-data'
import type { PlanRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { Badge, Button, cx, ErrorBox, LinkButton, PageHeader, Skeleton, useToast } from '@/components/ui'

const FALLBACK: PlanRow[] = [
  { id: 'free', name: 'Gratis', description: 'Para cocinar mejor cada día', price_cents: 0, currency: 'eur', billing_interval: null, stripe_price_id: null, limits: { scan: 5, generate: 10, adapt: 10, saved_recipes: 30 }, features: ['5 escaneos al mes', '10 generaciones y 10 adaptaciones de recetas al mes', 'Cálculo nutricional completo', '30 recetas guardadas', 'Planificador y lista de la compra'], sort: 1 },
  { id: 'premium', name: 'Premium', description: 'Para quien cocina con objetivos', price_cents: 499, currency: 'eur', billing_interval: 'month', stripe_price_id: null, limits: { scan: 60, generate: 150, adapt: 150, saved_recipes: 2000 }, features: ['60 escaneos al mes', '150 generaciones y 150 adaptaciones al mes', 'Ajuste avanzado a calorías y macros', 'Hasta 2.000 recetas guardadas', 'Historial completo y colecciones'], sort: 2 },
]

function Inner() {
  const params = useSearchParams()
  const router = useRouter()
  const toast = useToast()
  const { user, isGuest, configured } = useSession()
  const [plans, setPlans] = useState<PlanRow[] | null>(null)
  const [billing, setBilling] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const estado = params.get('estado')

  useEffect(() => {
    if (!configured) return setPlans(FALLBACK)
    listPlans().then((r) => setPlans(r.ok ? r.data.filter((p) => p.id !== 'guest') : FALLBACK))
    api<{ stripe: boolean }>('/api/status').then((r) => setBilling(r.ok ? r.data.stripe : false))
  }, [configured])

  async function subscribe(planId: string) {
    if (!user) return router.push('/entrar?siguiente=/planes')
    if (isGuest) return toast('Crea una cuenta con tu email antes de suscribirte.', 'info')
    setBusy(true)
    const r = await api<{ url: string }>('/api/stripe/checkout', { method: 'POST', json: { planId } })
    setBusy(false)
    if (!r.ok) return toast(r.error, 'error')
    window.location.assign(r.data.url)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Planes" title="Elige cómo cocinas" subtitle="La versión gratuita incluye todo lo esencial. Premium amplía los límites de IA y las funciones avanzadas." />
      {estado === 'ok' && <p className="rounded-2xl bg-ok/10 p-4 text-sm font-medium">Pago recibido. Tu plan se activará en cuanto Stripe nos confirme la suscripción (normalmente unos segundos).</p>}
      {estado === 'cancelado' && <p className="rounded-2xl bg-sunken p-4 text-sm">Has cancelado el pago. No se ha cobrado nada.</p>}
      {billing === false && <ErrorBox title="Pagos aún no activados" message="Los pagos todavía no están configurados en este servidor. Puedes usar el plan gratuito con normalidad." />}
      {!plans ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.map((p) => {
            const premium = p.id === 'premium'
            return (
              <section key={p.id} aria-labelledby={`plan-${p.id}`} className={cx('flex flex-col gap-4 rounded-3xl border p-5', premium ? 'border-brand bg-brand text-white' : 'border-line bg-surface')}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${p.id}`} className="flex items-center gap-2 font-display text-xl font-semibold">
                    {premium && <Crown className="h-5 w-5 text-saffron" aria-hidden />}
                    {p.name}
                  </h2>
                  {premium && <Badge className="!bg-saffron !text-on-saffron">Más completo</Badge>}
                </div>
                <p className={cx('text-sm', premium ? 'text-white/80' : 'text-muted')}>{p.description}</p>
                <p className="num font-display text-3xl font-bold">
                  {p.price_cents === 0 ? '0 €' : `${(p.price_cents / 100).toFixed(2).replace('.', ',')} €`}
                  {p.billing_interval && <span className="text-base font-medium opacity-80"> / {p.billing_interval === 'month' ? 'mes' : 'año'}</span>}
                </p>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className={cx('mt-0.5 h-4 w-4 shrink-0', premium ? 'text-saffron' : 'text-ok')} aria-hidden />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto">
                  {premium ? (
                    <Button variant="primary" block size="lg" onClick={() => subscribe(p.id)} loading={busy} disabled={billing === false || !p.stripe_price_id}>
                      {billing === false || !p.stripe_price_id ? 'Disponible próximamente' : 'Hacerme Premium'}
                    </Button>
                  ) : (
                    <LinkButton href="/crear" block size="lg">
                      Empezar gratis
                    </LinkButton>
                  )}
                </div>
              </section>
            )
          })}
        </div>
      )}
      <div className="text-xs leading-relaxed text-muted">
        <p>Precios con IVA incluido cuando se activen los pagos. Puedes cancelar en cualquier momento desde tu perfil; mantendrás Premium hasta el final del periodo pagado.</p>
        <p className="mt-1">Los límites existen para mantener la app sostenible: cada escaneo y cada receta usan un modelo de IA con coste real por uso.</p>
      </div>
    </div>
  )
}

export default function PlansPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
