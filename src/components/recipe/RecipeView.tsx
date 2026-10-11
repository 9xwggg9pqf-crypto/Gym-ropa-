'use client'
import { CalendarPlus, ChefHat, Clock, Copy, Flame, GitBranch, Heart, RotateCcw, Save, ShieldAlert, ShoppingBasket, Thermometer, Timer, Users, UtensilsCrossed } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { computeNutrition, scaleIngredients } from '@/lib/nutrition/compute'
import { checkIngredients, recipeAllergens, ALLERGEN_LABELS, EMPTY_PROFILE } from '@/lib/nutrition/restrictions'
import { resolveFood } from '@/lib/nutrition/catalog'
import { toGrams, fromGrams, formatIngredientAmount } from '@/lib/nutrition/units'
import type { MealTargets, Recipe, RecipeIngredient } from '@/lib/nutrition/types'
import { aggregateShopping } from '@/lib/shopping/aggregate'
import { pantryStatus, type PantryEntry } from '@/lib/recipes/enrich'
import { toDietaryProfileClient } from '@/lib/profile'
import { insertPlan, insertShopping, listPantry, listShopping, markCooked, saveRecipe, setFavorite, updatePantry, updateRecipeData, updateShopping } from '@/lib/client-data'
import type { PantryRow, RecipeRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { Badge, Button, cx, Field, LinkButton, Select, Sheet, Stepper, useToast } from '@/components/ui'
import { IngredientList } from './IngredientList'
import { MacroPills, NutritionLabel } from './NutritionLabel'
import { RecipeCover } from './RecipeCover'
import { TargetPanel } from './TargetPanel'

const DIFF = { facil: 'Fácil', media: 'Media', dificil: 'Difícil' }
const SLOTS = [
  ['desayuno', 'Desayuno'],
  ['comida', 'Comida'],
  ['merienda', 'Merienda'],
  ['cena', 'Cena'],
  ['snack', 'Snack'],
] as const

export interface RecipeViewProps {
  initial: Recipe
  initialTargets: MealTargets | null
  saved?: RecipeRow | null
  unmatched?: string[]
  cookHref: string
  onDraftChange?: (recipe: Recipe, targets: MealTargets) => void
  notice?: React.ReactNode
}

export function RecipeView({ initial, initialTargets, saved, unmatched = [], cookHref, onDraftChange, notice }: RecipeViewProps) {
  const router = useRouter()
  const toast = useToast()
  const { user, profile, ensureSession } = useSession()
  const [recipe, setRecipe] = useState<Recipe>(initial)
  const [targets, setTargets] = useState<MealTargets>(initialTargets ?? {})
  const [dirty, setDirty] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [pantryRows, setPantryRows] = useState<PantryRow[]>([])
  const [favorite, setFav] = useState(Boolean(saved?.is_favorite))
  const [saving, setSaving] = useState(false)
  const [planOpen, setPlanOpen] = useState(false)
  const [cookedOpen, setCookedOpen] = useState(false)

  const dietary = useMemo(() => (profile ? toDietaryProfileClient(profile) : EMPTY_PROFILE), [profile])
  useEffect(() => {
    if (user) listPantry().then((r) => r.ok && setPantryRows(r.data))
  }, [user])
  useEffect(() => {
    onDraftChange?.(recipe, targets)
  }, [recipe, targets, onDraftChange])

  const pantry: PantryEntry[] = pantryRows.map((p) => ({ foodKey: p.food_key, name: p.name, quantity: p.quantity === null ? null : Number(p.quantity), unit: p.unit, status: p.status }))
  const nutrition = useMemo(() => computeNutrition(recipe.ingredients, recipe.servings), [recipe])
  const issues = useMemo(() => checkIngredients(recipe.ingredients, dietary), [recipe, dietary])
  const allergens = useMemo(() => recipeAllergens(recipe.ingredients), [recipe])
  const pStatus = useMemo(() => pantryStatus(recipe.ingredients, pantry), [recipe, pantry])
  const blocking = issues.filter((i) => i.severity === 'bloqueo')

  function change(ings: RecipeIngredient[], note?: string) {
    setRecipe((r) => ({ ...r, ingredients: ings }))
    setDirty(true)
    if (note) setHistory((h) => [note, ...h].slice(0, 8))
  }
  function setServings(n: number) {
    const s = Math.max(1, Math.min(50, Math.round(n)))
    setRecipe((r) => ({ ...r, ingredients: scaleIngredients(r.ingredients, r.servings, s), servings: s }))
    setDirty(true)
  }

  async function requireAccount(): Promise<boolean> {
    const r = await ensureSession()
    if (!r.ok) toast(r.reason, 'error')
    return r.ok
  }

  async function save(asVersion = false) {
    if (!(await requireAccount())) return
    setSaving(true)
    const snapshot = { kcal: nutrition.perServing.kcal, protein: nutrition.perServing.protein, carbs: nutrition.perServing.carbs, fat: nutrition.perServing.fat }
    const t = Object.values(targets).some(Boolean) ? targets : null
    if (saved && !asVersion) {
      const r = await updateRecipeData(saved.id, recipe, snapshot, t)
      setSaving(false)
      if (!r.ok) return toast(r.error, 'error')
      setDirty(false)
      toast('Cambios guardados')
      return
    }
    const r = await saveRecipe({ recipe, targets: t, source: saved || dirty || t ? 'adapted' : 'ai', parentId: asVersion && saved ? saved.parent_id ?? saved.id : null })
    setSaving(false)
    if (!r.ok) return toast(r.error, 'error')
    toast(asVersion ? 'Nueva versión guardada' : 'Receta guardada en tu cuenta')
    setDirty(false)
    router.push(`/recetas/${r.data.id}`)
  }

  async function addToShopping() {
    if (!(await requireAccount())) return
    const items = aggregateShopping([{ title: recipe.title, baseServings: recipe.servings, plannedServings: recipe.servings, ingredients: recipe.ingredients }], pantry)
    const need = items.filter((i) => i.toBuy > 0)
    if (need.length === 0) return toast('Ya tienes todo en la despensa', 'info')
    const existing = await listShopping()
    if (!existing.ok) return toast(existing.error, 'error')
    const byKey = new Map(existing.data.filter((r) => !r.checked && r.item_key).map((r) => [r.item_key!, r]))
    const inserts = []
    for (const it of need) {
      const prev = byKey.get(it.key)
      if (prev && prev.unit === it.unit) {
        const r = await updateShopping(prev.id, { quantity: Number(prev.quantity ?? 0) + it.toBuy })
        if (!r.ok) return toast(r.error, 'error')
      } else inserts.push({ item_key: it.key, name: it.name, quantity: it.toBuy, unit: it.unit, category: it.category, source: 'recipe' as const })
    }
    if (inserts.length) {
      const r = await insertShopping(inserts)
      if (!r.ok) return toast(r.error, 'error')
    }
    toast(`${need.length} producto(s) añadidos a la lista de la compra`)
  }

  async function toggleFavorite() {
    if (!saved) return
    const r = await setFavorite(saved.id, !favorite)
    if (!r.ok) return toast(r.error, 'error')
    setFav(!favorite)
  }

  async function share() {
    const text = [`${recipe.title} (${recipe.servings} raciones)`, '', 'Ingredientes:', ...recipe.ingredients.map((i) => `- ${formatIngredientAmount(i.quantity, i.unit, resolveFood(i.foodKey, i.inlineFood)?.portions.unit?.name)} ${i.name}`), '', 'Pasos:', ...recipe.steps.map((s, i) => `${i + 1}. ${s.text}`), '', `≈ ${Math.round(nutrition.perServing.kcal ?? 0)} kcal y ${Math.round(nutrition.perServing.protein ?? 0)} g de proteína por ración (estimación SNACKEATS)`].join('\n')
    try {
      if (navigator.share) await navigator.share({ title: recipe.title, text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Receta copiada al portapapeles')
      }
    } catch {
      /* el usuario canceló */
    }
  }

  const minutes = recipe.prepMinutes + recipe.cookMinutes

  return (
    <article className="flex flex-col gap-6">
      {/* Cabecera */}
      <div className="overflow-hidden rounded-3xl border border-line bg-surface">
        <RecipeCover recipe={recipe} imageUrl={saved?.image_url} imageCredit={saved?.image_credit} size="lg" className="h-44 w-full sm:h-56" />
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {saved && saved.version > 1 && <p className="label-caps text-brand-ink">Versión {saved.version}</p>}
              <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{recipe.title}</h1>
            </div>
            {saved && (
              <button type="button" onClick={toggleFavorite} aria-pressed={favorite} aria-label={favorite ? 'Quitar de favoritas' : 'Añadir a favoritas'} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line hover:bg-sunken">
                <Heart className={cx('h-5 w-5', favorite ? 'fill-protein text-protein' : 'text-muted')} aria-hidden />
              </button>
            )}
          </div>
          {recipe.description && <p className="max-w-prose text-[15px] text-muted">{recipe.description}</p>}
          <div className="num flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4" aria-hidden /> {recipe.prepMinutes} min prep. · {recipe.cookMinutes} min cocción
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ChefHat className="h-4 w-4" aria-hidden /> {DIFF[recipe.difficulty]}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="h-4 w-4" aria-hidden /> {minutes} min en total
            </span>
          </div>
          <MacroPills n={nutrition.perServing} />
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Users className="h-4 w-4 text-muted" aria-hidden /> Raciones
            </span>
            <Stepper label="raciones" value={recipe.servings} min={1} max={50} onChange={setServings} />
          </div>
        </div>
      </div>

      {notice}

      {/* Avisos de seguridad del perfil */}
      {issues.length > 0 && (
        <section aria-labelledby="avisos" className={cx('flex flex-col gap-2 rounded-2xl border p-4', blocking.length ? 'border-danger/40 bg-danger/5' : 'border-warn/40 bg-warn/5')}>
          <h2 id="avisos" className="flex items-center gap-2 font-semibold">
            <ShieldAlert className={cx('h-5 w-5', blocking.length ? 'text-danger' : 'text-warn')} aria-hidden />
            {blocking.length ? 'No es compatible con tu perfil tal como está' : 'Revisa antes de cocinar'}
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {issues.map((i, k) => (
              <li key={k}>
                <span className="font-semibold">{i.ingredientName}:</span> {i.message}
              </li>
            ))}
          </ul>
          {blocking.length > 0 && <p className="text-xs text-muted">Usa el botón de sustituir en el ingrediente afectado o quítalo.</p>}
        </section>
      )}

      {unmatched.length > 0 && (
        <p className="rounded-xl bg-warn/10 p-3 text-sm">
          Sin datos nutricionales para: <span className="font-semibold">{unmatched.join(', ')}</span>. Asócialos a un alimento (icono de enlace) para incluirlos en el cálculo.
        </p>
      )}

      {/* Acciones */}
      <div className="flex flex-wrap gap-2">
        {saved ? (
          <>
            <Button variant="primary" icon={<Save className="h-4 w-4" aria-hidden />} onClick={() => save(false)} loading={saving} disabled={!dirty}>
              {dirty ? 'Guardar cambios' : 'Guardada'}
            </Button>
            <Button variant="outline" icon={<GitBranch className="h-4 w-4" aria-hidden />} onClick={() => save(true)} disabled={!dirty || saving}>
              Guardar como versión
            </Button>
          </>
        ) : (
          <Button variant="primary" icon={<Save className="h-4 w-4" aria-hidden />} onClick={() => save(false)} loading={saving}>
            Guardar receta
          </Button>
        )}
        <LinkButton href={cookHref} variant="brand" icon={<UtensilsCrossed className="h-4 w-4" aria-hidden />}>
          Modo cocina
        </LinkButton>
        <Button variant="outline" icon={<CalendarPlus className="h-4 w-4" aria-hidden />} onClick={async () => (saved ? setPlanOpen(true) : toast('Guarda la receta para añadirla al plan', 'info'))}>
          Al plan
        </Button>
        <Button variant="outline" icon={<ShoppingBasket className="h-4 w-4" aria-hidden />} onClick={addToShopping}>
          A la compra
        </Button>
        {saved && (
          <Button variant="outline" onClick={() => setCookedOpen(true)}>
            La he cocinado
          </Button>
        )}
        <Button variant="ghost" icon={<Copy className="h-4 w-4" aria-hidden />} onClick={share}>
          Compartir
        </Button>
        {dirty && (
          <Button
            variant="ghost"
            icon={<RotateCcw className="h-4 w-4" aria-hidden />}
            onClick={() => {
              setRecipe(saved ? saved.data : initial)
              setTargets(initialTargets ?? {})
              setDirty(false)
              setHistory([])
            }}
          >
            Deshacer cambios
          </Button>
        )}
      </div>
      {history.length > 0 && <p className="text-xs text-muted">Últimos cambios: {history.join(' · ')}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <TargetPanel recipe={recipe} targets={targets} onTargets={(t) => setTargets(t)} onApply={change} profile={dietary} />

          <section aria-labelledby="ingredientes" className="flex flex-col gap-3">
            <div className="flex items-end justify-between gap-2">
              <h2 id="ingredientes" className="font-display text-lg font-semibold">
                Ingredientes
              </h2>
              <span className="text-xs text-muted">Cantidades para {recipe.servings} {recipe.servings === 1 ? 'ración' : 'raciones'}</span>
            </div>
            <IngredientList recipe={recipe} lines={nutrition.lines} pantry={pStatus} profile={dietary} onChange={change} showPantry={Boolean(user)} />
          </section>

          <section aria-labelledby="pasos" className="flex flex-col gap-3">
            <h2 id="pasos" className="font-display text-lg font-semibold">
              Preparación
            </h2>
            {recipe.utensils.length > 0 && <p className="text-sm text-muted">Utensilios: {recipe.utensils.join(', ')}.</p>}
            <ol className="flex flex-col gap-3">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">{i + 1}</span>
                  <div className="flex flex-col gap-1 pt-1">
                    <p className="text-[15px] leading-relaxed">{s.text}</p>
                    <div className="flex flex-wrap gap-2">
                      {s.timerSeconds ? (
                        <Badge tone="saffron">
                          <Timer className="h-3.5 w-3.5" aria-hidden /> {Math.round(s.timerSeconds / 60)} min
                        </Badge>
                      ) : null}
                      {s.temperatureC ? (
                        <Badge tone="saffron">
                          <Thermometer className="h-3.5 w-3.5" aria-hidden /> {s.temperatureC} °C
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {recipe.tips.length > 0 && (
            <section aria-labelledby="consejos" className="flex flex-col gap-2">
              <h2 id="consejos" className="font-display text-lg font-semibold">
                Consejos
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-[15px] text-muted">
                {recipe.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:self-start">
          <NutritionLabel result={nutrition} />
          <section aria-labelledby="alergenos" className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <h2 id="alergenos" className="font-semibold">
              Alérgenos
            </h2>
            {allergens.contains.length === 0 && allergens.mayContain.length === 0 && allergens.unknown.length === 0 ? (
              <p className="text-sm text-muted">No hemos identificado alérgenos de declaración obligatoria en los ingredientes con datos.</p>
            ) : (
              <>
                {allergens.contains.length > 0 && (
                  <p className="text-sm">
                    <span className="font-semibold">Contiene:</span> {allergens.contains.map((a) => ALLERGEN_LABELS[a]).join(', ')}
                  </p>
                )}
                {allergens.mayContain.length > 0 && (
                  <p className="text-sm">
                    <span className="font-semibold">Puede contener (según la marca):</span> {allergens.mayContain.map((a) => ALLERGEN_LABELS[a]).join(', ')}
                  </p>
                )}
                {allergens.unknown.length > 0 && <p className="text-sm text-warn">Sin datos de alérgenos: {allergens.unknown.join(', ')}.</p>}
              </>
            )}
            <p className="text-xs text-muted">Revisa siempre las etiquetas de los productos procesados. No podemos garantizar la ausencia de trazas ni de contaminación cruzada.</p>
          </section>
          {recipe.safetyNotes.length > 0 && (
            <section aria-labelledby="seguridad" className="flex flex-col gap-1.5 rounded-2xl border border-line bg-surface p-4">
              <h2 id="seguridad" className="font-semibold">
                Seguridad alimentaria
              </h2>
              <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-muted">
                {recipe.safetyNotes.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </section>
          )}
          <p className="text-xs leading-relaxed text-muted">SNACKEATS ofrece estimaciones orientativas y no sustituye el consejo de un profesional sanitario o dietista-nutricionista.</p>
        </aside>
      </div>

      {saved && <PlanSheet open={planOpen} onClose={() => setPlanOpen(false)} recipeId={saved.id} defaultServings={1} />}
      {saved && <CookedSheet open={cookedOpen} onClose={() => setCookedOpen(false)} recipe={recipe} recipeId={saved.id} pantryRows={pantryRows} onUpdated={setPantryRows} />}
      {!user && (
        <p className="text-center text-sm text-muted">
          <Link href="/entrar" className="font-semibold text-brand-ink underline">
            Entra
          </Link>{' '}
          para guardar recetas, cruzar con tu despensa y planificar la semana.
        </p>
      )}
    </article>
  )
}

function isoDate(d: Date) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function PlanSheet({ open, onClose, recipeId, defaultServings }: { open: boolean; onClose: () => void; recipeId: string; defaultServings: number }) {
  const toast = useToast()
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })
  const [date, setDate] = useState(isoDate(days[0]))
  const [slot, setSlot] = useState<(typeof SLOTS)[number][0]>('comida')
  const [servings, setServings] = useState(defaultServings)
  const [busy, setBusy] = useState(false)
  async function add() {
    setBusy(true)
    const r = await insertPlan([{ plan_date: date, slot, recipe_id: recipeId, servings }])
    setBusy(false)
    if (!r.ok) return toast(r.error, 'error')
    toast('Añadida al plan semanal')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="Añadir al plan" footer={<Button variant="primary" block onClick={add} loading={busy}>Añadir</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Día" htmlFor="plan-day">
          <Select id="plan-day" value={date} onChange={(e) => setDate(e.target.value)}>
            {days.map((d) => (
              <option key={isoDate(d)} value={isoDate(d)}>
                {d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Comida" htmlFor="plan-slot">
          <Select id="plan-slot" value={slot} onChange={(e) => setSlot(e.target.value as typeof slot)}>
            {SLOTS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Raciones que comerás</span>
          <Stepper label="raciones" value={servings} min={0.5} step={0.5} max={20} onChange={setServings} />
        </div>
      </div>
    </Sheet>
  )
}

/** Descuenta de la despensa lo usado al cocinar (sólo lo que se puede convertir con seguridad). */
function CookedSheet({ open, onClose, recipe, recipeId, pantryRows, onUpdated }: { open: boolean; onClose: () => void; recipe: Recipe; recipeId: string; pantryRows: PantryRow[]; onUpdated: (rows: PantryRow[]) => void }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const plan = recipe.ingredients
    .map((ing) => {
      const food = resolveFood(ing.foodKey, ing.inlineFood)
      const row = pantryRows.find((p) => p.status === 'disponible' && food && p.food_key === food.key && p.quantity !== null)
      if (!row || !food) return null
      const usedG = toGrams(ing.quantity, ing.unit, food).grams
      if (usedG === null) return null
      const usedInRowUnit = fromGrams(usedG, row.unit, food)
      if (usedInRowUnit === null) return null
      const left = Math.max(0, Math.round((Number(row.quantity) - usedInRowUnit) * 100) / 100)
      return { row, ing, left }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))

  async function apply() {
    setBusy(true)
    const updated = [...pantryRows]
    for (const p of plan) {
      const r = await updatePantry(p.row.id, { quantity: p.left, status: p.left <= 0 ? 'agotado' : 'disponible' })
      if (!r.ok) {
        setBusy(false)
        return toast(r.error, 'error')
      }
      const i = updated.findIndex((x) => x.id === p.row.id)
      updated[i] = r.data
    }
    await markCooked(recipeId)
    setBusy(false)
    onUpdated(updated)
    toast('Despensa actualizada')
    onClose()
  }
  return (
    <Sheet open={open} onClose={onClose} title="¿Descontar de la despensa?" footer={<Button variant="primary" block onClick={apply} loading={busy}>{plan.length ? 'Descontar y marcar como cocinada' : 'Marcar como cocinada'}</Button>}>
      {plan.length === 0 ? (
        <p className="text-sm text-muted">Ningún ingrediente de esta receta está en tu despensa con una cantidad conocida.</p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {plan.map((p) => (
            <li key={p.row.id} className="flex justify-between gap-2 rounded-xl bg-sunken px-3 py-2">
              <span>{p.row.name}</span>
              <span className="num text-muted">
                {p.row.quantity} → <span className="font-semibold text-ink">{p.left}</span> {p.row.unit}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  )
}
