'use client'
import { ArrowRight, CalendarDays, Camera, Package, ShoppingBasket, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { listPantry, listRecipes } from '@/lib/client-data'
import type { PantryRow, RecipeRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { Badge, Button, SectionTitle } from '@/components/ui'

const EXAMPLES = ['Espaguetis a la boloñesa de 700 kcal con 35 g de proteína', 'Pollo con arroz, unas 650 kcal y 40 g de proteína', 'Tortitas de avena con plátano', 'Hamburguesa casera', 'Un plato vegetariano rápido']

function daysUntil(date: string) {
  const d = new Date(date + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400000)
}

export default function HomePage() {
  const router = useRouter()
  const { user, profile } = useSession()
  const [q, setQ] = useState('')
  const [recent, setRecent] = useState<RecipeRow[]>([])
  const [useFirst, setUseFirst] = useState<PantryRow[]>([])

  useEffect(() => {
    if (!user) return
    listRecipes().then((r) => r.ok && setRecent(r.data.slice(0, 4)))
    listPantry().then((r) => {
      if (!r.ok) return
      const soon = r.data
        .filter((p) => p.status === 'disponible' && (p.use_first || (p.expires_on && daysUntil(p.expires_on) <= 3)))
        .sort((a, b) => (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999'))
      setUseFirst(soon.slice(0, 6))
    })
  }, [user])

  function goDish(text: string) {
    const v = text.trim()
    router.push(v ? `/crear?modo=plato_concreto&q=${encodeURIComponent(v)}` : '/crear?modo=plato_concreto')
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-5">
        <div>
          <p className="label-caps text-brand-ink">{profile?.display_name ? `Hola, ${profile.display_name}` : 'Cocina con lo que tienes'}</p>
          <h1 className="mt-1 font-display text-[28px] font-semibold leading-[1.1] tracking-tight sm:text-4xl">
            ¿Qué cocinamos hoy?
          </h1>
          <p className="mt-2 max-w-prose text-[15px] text-muted">Lo que tienes. Lo que te apetece. Lo que necesitas.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Acción A */}
          <Link href="/escanear" className="group relative flex min-h-[176px] flex-col justify-between overflow-hidden rounded-3xl bg-brand p-5 text-white shadow-lift">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-saffron/90" aria-hidden />
            <div className="pointer-events-none absolute -right-2 top-16 h-16 w-16 rounded-full bg-brand" aria-hidden />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
              <Camera className="h-6 w-6" aria-hidden />
            </span>
            <span className="relative flex flex-col gap-1">
              <span className="font-display text-xl font-semibold">¿Qué puedo cocinar?</span>
              <span className="text-sm text-white/80">Haz una foto a tu nevera o despensa y te propongo recetas con lo que hay.</span>
              <span className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-saffron">
                Escanear ingredientes <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
              </span>
            </span>
          </Link>

          {/* Acción B */}
          <form
            className="flex min-h-[176px] flex-col justify-between gap-3 rounded-3xl border border-line bg-surface p-5"
            onSubmit={(e) => {
              e.preventDefault()
              goDish(q)
            }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-saffron/25 text-ink">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <div className="flex flex-col gap-2">
              <label htmlFor="home-dish" className="font-display text-xl font-semibold">
                Quiero cocinar…
              </label>
              <div className="flex gap-2">
                <input id="home-dish" value={q} onChange={(e) => setQ(e.target.value)} placeholder="p. ej. pasta con pollo de 650 kcal" className="h-12 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3.5 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                <Button type="submit" variant="primary" size="lg" className="h-12 px-4" aria-label="Crear receta">
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Button>
              </div>
            </div>
          </form>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Ejemplos de peticiones">
          {EXAMPLES.map((ex) => (
            <button key={ex} type="button" onClick={() => goDish(ex)} className="shrink-0 rounded-full border border-line bg-surface px-3.5 py-2 text-sm text-ink hover:border-brand/50">
              {ex}
            </button>
          ))}
        </div>
      </section>

      {useFirst.length > 0 && (
        <section aria-labelledby="gastar" className="flex flex-col gap-3">
          <SectionTitle id="gastar" action={<Link href="/crear?modo=solo_lo_que_tengo&despensa=1" className="text-sm font-semibold text-brand-ink hover:underline">Cocinar con esto</Link>}>
            Gasta primero
          </SectionTitle>
          <div className="flex flex-wrap gap-2">
            {useFirst.map((p) => {
              const d = p.expires_on ? daysUntil(p.expires_on) : null
              return (
                <span key={p.id} className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                  {p.name}
                  {d !== null && (
                    <Badge tone={d < 0 ? 'danger' : d <= 1 ? 'warn' : 'neutral'}>
                      {d < 0 ? `${p.date_kind === 'consumo_preferente' ? 'cons. pref.' : 'caducó'} hace ${-d} d` : d === 0 ? 'hoy' : `${d} d`}
                    </Badge>
                  )}
                </span>
              )
            })}
          </div>
          <p className="text-xs text-muted">Fechas introducidas por ti. Una fecha de consumo preferente pasada no significa que el alimento no sea seguro, pero una de caducidad sí: en caso de duda, no lo consumas.</p>
        </section>
      )}

      <section aria-labelledby="organiza" className="grid grid-cols-3 gap-3">
        <h2 id="organiza" className="sr-only">
          Organiza tu semana
        </h2>
        {[
          { href: '/plan', icon: CalendarDays, label: 'Plan semanal' },
          { href: '/compra', icon: ShoppingBasket, label: 'Lista de la compra' },
          { href: '/despensa', icon: Package, label: 'Despensa' },
        ].map((t) => (
          <Link key={t.href} href={t.href} className="flex flex-col items-start gap-2 rounded-2xl border border-line bg-surface p-3.5 text-sm font-semibold hover:border-brand/40">
            <t.icon className="h-5 w-5 text-brand-ink" aria-hidden />
            {t.label}
          </Link>
        ))}
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="recientes" className="flex flex-col gap-3">
          <SectionTitle id="recientes" action={<Link href="/recetas" className="text-sm font-semibold text-brand-ink hover:underline">Ver todas</Link>}>
            Tus últimas recetas
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {recent.map((r) => (
              <RecipeCard key={r.id} href={`/recetas/${r.id}`} recipe={r.data} kcal={r.kcal_per_serving} protein={r.protein_per_serving} favorite={r.is_favorite} imageUrl={r.image_url} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-3xl border border-line bg-surface p-5">
        <h2 className="font-display text-base font-semibold">Cómo calculamos</h2>
        <p className="mt-1 max-w-prose text-sm text-muted">
          La IA propone la receta; las calorías y los macros los calcula un motor propio con datos públicos de USDA FoodData Central, a partir del peso de cada ingrediente. Siempre verás si un valor es una estimación y por qué.
        </p>
      </section>
    </div>
  )
}
