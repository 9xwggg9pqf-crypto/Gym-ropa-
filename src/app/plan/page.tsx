'use client'
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, ShoppingBasket, Trash2, Wand2 } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { deletePlan, deleteShopping, insertPlan, insertShopping, listPantry, listPlan, listRecipes, listShopping, updatePlan, updateShopping } from '@/lib/client-data'
import type { MealPlanRow, RecipeRow } from '@/lib/api-types'
import { computeNutrition } from '@/lib/nutrition/compute'
import { checkIngredients } from '@/lib/nutrition/restrictions'
import { toDietaryProfileClient } from '@/lib/profile'
import { aggregateShopping, mergeShoppingList } from '@/lib/shopping/aggregate'
import { useSession } from '@/lib/session'
import { Button, Chip, cx, EmptyState, ErrorBox, IconButton, Input, LinkButton, PageHeader, Sheet, Skeleton, Stepper, useToast } from '@/components/ui'

const SLOTS: { value: MealPlanRow['slot']; label: string }[] = [
  { value: 'desayuno', label: 'Desayuno' },
  { value: 'media_manana', label: 'Media mañana' },
  { value: 'comida', label: 'Comida' },
  { value: 'merienda', label: 'Merienda' },
  { value: 'cena', label: 'Cena' },
  { value: 'snack', label: 'Snack' },
]
const SLOT_PREF_KEY = 'snackeats-plan-slots'

function iso(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
function mondayOf(d: Date) {
  const x = new Date(d)
  x.setHours(12, 0, 0, 0)
  const day = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - day)
  return x
}

export default function PlanPage() {
  const { user, profile, loading, configured } = useSession()
  const toast = useToast()
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()))
  const [entries, setEntries] = useState<MealPlanRow[] | null>(null)
  const [recipes, setRecipes] = useState<RecipeRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [slots, setSlots] = useState<MealPlanRow['slot'][]>(['comida', 'cena'])
  const [picker, setPicker] = useState<{ date: string; slot: MealPlanRow['slot']; replace?: MealPlanRow } | null>(null)
  const [allowRepeats, setAllowRepeats] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SLOT_PREF_KEY) ?? 'null')
      if (Array.isArray(s) && s.length) setSlots(s)
    } catch {
      /* preferencia no disponible */
    }
  }, [])
  function toggleSlot(s: MealPlanRow['slot']) {
    const next = slots.includes(s) ? slots.filter((x) => x !== s) : SLOTS.map((x) => x.value).filter((v) => v === s || slots.includes(v))
    if (next.length === 0) return
    setSlots(next)
    try {
      localStorage.setItem(SLOT_PREF_KEY, JSON.stringify(next))
    } catch {
      /* sin almacenamiento */
    }
  }

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return d
  }), [weekStart])
  const from = iso(days[0])
  const to = iso(days[6])

  const load = useCallback(async () => {
    setError(null)
    const [p, r] = await Promise.all([listPlan(from, to), listRecipes()])
    if (!p.ok) return setError(p.error)
    setEntries(p.data)
    if (r.ok) setRecipes(r.data)
  }, [from, to])
  useEffect(() => {
    if (user) load()
  }, [user, load])

  const byId = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])
  const perServing = useMemo(() => {
    const m = new Map<string, ReturnType<typeof computeNutrition>['perServing']>()
    for (const r of recipes) m.set(r.id, computeNutrition(r.data.ingredients, r.data.servings).perServing)
    return m
  }, [recipes])
  const dietary = useMemo(() => toDietaryProfileClient(profile), [profile])

  async function add(date: string, slot: MealPlanRow['slot'], recipe: RecipeRow, replace?: MealPlanRow) {
    if (replace) {
      const r = await updatePlan(replace.id, { recipe_id: recipe.id })
      if (!r.ok) return toast(r.error, 'error')
    } else {
      const r = await insertPlan([{ plan_date: date, slot, recipe_id: recipe.id, servings: 1 }])
      if (!r.ok) return toast(r.error, 'error')
    }
    setPicker(null)
    load()
  }

  /** Rellena los huecos vacíos con recetas guardadas (favoritas primero), evitando repetir y respetando alergias. */
  async function autofill() {
    if (!entries) return
    const safe = recipes.filter((r) => !checkIngredients(r.data.ingredients, dietary).some((i) => i.severity === 'bloqueo'))
    const pool = [...safe.filter((r) => r.is_favorite), ...safe.filter((r) => !r.is_favorite)]
    if (pool.length === 0) return toast('Guarda alguna receta compatible con tu perfil para rellenar el plan.', 'info')
    const used = new Set(entries.map((e) => e.recipe_id))
    const rows: Omit<MealPlanRow, 'id' | 'position'>[] = []
    let k = 0
    for (const d of days) {
      for (const s of slots) {
        if (entries.some((e) => e.plan_date === iso(d) && e.slot === s)) continue
        let pick = pool.find((r) => !used.has(r.id))
        if (!pick && allowRepeats) pick = pool[k++ % pool.length]
        if (!pick) continue
        used.add(pick.id)
        rows.push({ plan_date: iso(d), slot: s, recipe_id: pick.id, servings: 1 })
      }
    }
    if (rows.length === 0) return toast(allowRepeats ? 'No hay huecos libres.' : 'No quedan recetas sin repetir. Activa «Repetir platos» o guarda más recetas.', 'info')
    setBusy(true)
    const r = await insertPlan(rows)
    setBusy(false)
    if (!r.ok) return toast(r.error, 'error')
    toast(`${rows.length} comida(s) añadidas`)
    load()
  }

  async function buildShopping() {
    if (!entries?.length) return toast('El plan de esta semana está vacío.', 'info')
    setBusy(true)
    const [pantry, existing] = await Promise.all([listPantry(), listShopping()])
    if (!pantry.ok || !existing.ok) {
      setBusy(false)
      return toast('No se ha podido leer tu despensa o tu lista.', 'error')
    }
    const planned = entries
      .map((e) => {
        const r = byId.get(e.recipe_id)
        return r ? { title: r.title, baseServings: r.data.servings, plannedServings: Number(e.servings), ingredients: r.data.ingredients } : null
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
    const items = aggregateShopping(
      planned,
      pantry.data.map((p) => ({ foodKey: p.food_key, name: p.name, quantity: p.quantity === null ? null : Number(p.quantity), unit: p.unit, status: p.status })),
    )
    const merge = mergeShoppingList(existing.data.map((r) => ({ ...r, quantity: r.quantity === null ? null : Number(r.quantity) })), items, 'plan')
    // Los productos que venían de recetas sueltas se conservan; sólo se reemplazan los del plan.
    const removable = merge.remove.filter((r) => r.source === 'plan' && r.id).map((r) => r.id!)
    if (removable.length) {
      const d = await deleteShopping(removable)
      if (!d.ok) {
        setBusy(false)
        return toast(d.error, 'error')
      }
    }
    for (const u of merge.upsert.filter((x) => x.id)) {
      const r = await updateShopping(u.id!, { quantity: u.quantity, checked: u.checked, name: u.name, unit: u.unit })
      if (!r.ok) {
        setBusy(false)
        return toast(r.error, 'error')
      }
    }
    const inserts = merge.upsert.filter((x) => !x.id).map(({ item_key, name, quantity, unit, category, source }) => ({ item_key, name, quantity, unit, category, source }))
    if (inserts.length) {
      const r = await insertShopping(inserts)
      if (!r.ok) {
        setBusy(false)
        return toast(r.error, 'error')
      }
    }
    setBusy(false)
    toast(`Lista actualizada: ${merge.upsert.length} producto(s) del plan; tus productos añadidos a mano se mantienen.`)
  }

  if (!loading && (!configured || !user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Plan semanal" />
        <EmptyState icon={<CalendarDays className="h-6 w-6" aria-hidden />} title="Organiza tu semana" action={<LinkButton href="/entrar" variant="primary">Entrar o crear cuenta</LinkButton>}>
          Planifica comidas con tus recetas guardadas y genera la lista de la compra automáticamente.
        </EmptyState>
      </div>
    )
  }

  const weekLabel = `${days[0].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
  const todayIso = iso(new Date())

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Plan semanal" subtitle="Cambia una comida sin rehacer todo el plan. Los valores son estimaciones por las raciones que planificas." />

      <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-surface p-2">
        <IconButton label="Semana anterior" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return d })}>
          <ChevronLeft className="h-5 w-5" aria-hidden />
        </IconButton>
        <button type="button" className="num font-display text-[15px] font-semibold" onClick={() => setWeekStart(mondayOf(new Date()))}>
          {weekLabel}
        </button>
        <IconButton label="Semana siguiente" onClick={() => setWeekStart((w) => { const d = new Date(w); d.setDate(d.getDate() + 7); return d })}>
          <ChevronRight className="h-5 w-5" aria-hidden />
        </IconButton>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Comidas que planificas cada día</p>
        <div className="flex flex-wrap gap-2">
          {SLOTS.map((s) => (
            <Chip key={s.value} active={slots.includes(s.value)} onClick={() => toggleSlot(s.value)}>
              {s.label}
            </Chip>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" icon={<Wand2 className="h-4 w-4" aria-hidden />} onClick={autofill} loading={busy}>
          Rellenar huecos
        </Button>
        <label className="flex items-center gap-2 px-2 text-sm">
          <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={allowRepeats} onChange={(e) => setAllowRepeats(e.target.checked)} />
          Repetir platos
        </label>
        <Button variant="primary" icon={<ShoppingBasket className="h-4 w-4" aria-hidden />} onClick={buildShopping} loading={busy}>
          Generar lista de la compra
        </Button>
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {entries === null ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {days.map((d) => {
            const date = iso(d)
            const dayEntries = entries.filter((e) => e.plan_date === date)
            const totals = dayEntries.reduce(
              (acc, e) => {
                const n = perServing.get(e.recipe_id)
                if (!n) return acc
                const s = Number(e.servings)
                return { kcal: acc.kcal + (n.kcal ?? 0) * s, protein: acc.protein + (n.protein ?? 0) * s, carbs: acc.carbs + (n.carbs ?? 0) * s, fat: acc.fat + (n.fat ?? 0) * s }
              },
              { kcal: 0, protein: 0, carbs: 0, fat: 0 },
            )
            return (
              <section key={date} aria-label={d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} className={cx('flex flex-col gap-2 rounded-2xl border bg-surface p-3', date === todayIso ? 'border-saffron' : 'border-line')}>
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-[15px] font-semibold capitalize">
                    {d.toLocaleDateString('es-ES', { weekday: 'long' })} <span className="num font-sans text-sm font-normal text-muted">{d.getDate()}</span>
                  </h2>
                  {dayEntries.length > 0 && (
                    <span className="num text-xs text-muted">
                      <span className="font-semibold text-ink">{Math.round(totals.kcal)} kcal</span> · P {Math.round(totals.protein)} · H {Math.round(totals.carbs)} · G {Math.round(totals.fat)} g
                    </span>
                  )}
                </div>
                {slots.map((s) => {
                  const list = dayEntries.filter((e) => e.slot === s)
                  const label = SLOTS.find((x) => x.value === s)!.label
                  return (
                    <div key={s} className="flex flex-col gap-1.5 rounded-xl bg-sunken/70 p-2">
                      <p className="label-caps text-muted">{label}</p>
                      {list.map((e) => {
                        const r = byId.get(e.recipe_id)
                        const n = perServing.get(e.recipe_id)
                        return (
                          <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-surface p-2">
                            <Link href={`/recetas/${e.recipe_id}`} className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold">{r?.title ?? 'Receta eliminada'}</span>
                              {n && (
                                <span className="num text-xs text-muted">
                                  {Math.round((n.kcal ?? 0) * Number(e.servings))} kcal · P {Math.round((n.protein ?? 0) * Number(e.servings))} g
                                </span>
                              )}
                            </Link>
                            <Stepper label={`raciones de ${r?.title ?? 'receta'}`} value={Number(e.servings)} step={0.5} min={0.5} max={20} onChange={async (v) => { const res = await updatePlan(e.id, { servings: v }); if (res.ok) setEntries((x) => x!.map((y) => (y.id === e.id ? { ...y, servings: v } : y))); else toast(res.error, 'error') }} />
                            <IconButton label="Cambiar receta" onClick={() => setPicker({ date, slot: s, replace: e })}>
                              <RefreshCw className="h-4 w-4" aria-hidden />
                            </IconButton>
                            <IconButton label="Quitar del plan" onClick={async () => { const res = await deletePlan(e.id); if (res.ok) setEntries((x) => x!.filter((y) => y.id !== e.id)); else toast(res.error, 'error') }}>
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </IconButton>
                          </div>
                        )
                      })}
                      <button type="button" onClick={() => setPicker({ date, slot: s })} className="inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-sm font-semibold text-brand-ink hover:bg-surface">
                        <Plus className="h-4 w-4" aria-hidden /> Añadir
                      </button>
                    </div>
                  )
                })}
              </section>
            )
          })}
        </div>
      )}

      <RecipePicker open={Boolean(picker)} onClose={() => setPicker(null)} recipes={recipes} title={picker?.replace ? 'Cambiar receta' : 'Elegir receta'} onPick={(r) => picker && add(picker.date, picker.slot, r, picker.replace)} />
    </div>
  )
}

function RecipePicker({ open, onClose, recipes, onPick, title }: { open: boolean; onClose: () => void; recipes: RecipeRow[]; onPick: (r: RecipeRow) => void; title: string }) {
  const [q, setQ] = useState('')
  const list = recipes.filter((r) => r.title.toLowerCase().includes(q.toLowerCase())).sort((a, b) => Number(b.is_favorite) - Number(a.is_favorite))
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <Input aria-label="Buscar receta" className="pl-9" placeholder="Buscar en mis recetas" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {recipes.length === 0 && (
          <p className="text-sm text-muted">
            Aún no tienes recetas guardadas.{' '}
            <Link href="/crear" className="font-semibold text-brand-ink underline">
              Crea una
            </Link>
            .
          </p>
        )}
        <ul className="flex flex-col divide-y divide-line">
          {list.map((r) => (
            <li key={r.id}>
              <button type="button" className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-sunken" onClick={() => onPick(r)}>
                <span className="min-w-0 truncate font-medium">
                  {r.is_favorite ? '♥ ' : ''}
                  {r.title}
                </span>
                <span className="num shrink-0 text-xs text-muted">
                  {r.kcal_per_serving === null ? '—' : Math.round(r.kcal_per_serving)} kcal/ración
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  )
}
