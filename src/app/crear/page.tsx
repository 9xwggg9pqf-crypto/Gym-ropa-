'use client'
import { ChevronDown, Package, Plus, Sparkles, Target, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { api, listHistory, listPantry } from '@/lib/client-data'
import { drafts, type ConfirmedIngredient, type GenerationResult } from '@/lib/drafts'
import { enrichRecipe, hasTargets } from '@/lib/recipes/enrich'
import { toDietaryProfileClient } from '@/lib/profile'
import { exactFood } from '@/lib/nutrition/catalog'
import type { MealTargets } from '@/lib/nutrition/types'
import type { PantryRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { FoodPicker } from '@/components/recipe/FoodPicker'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { TargetsForm } from '@/components/recipe/TargetsForm'
import { Badge, Button, cx, ErrorBox, Input, PageHeader, Select, Stepper, Tabs, Textarea } from '@/components/ui'

type Mode = 'solo_lo_que_tengo' | 'pequenas_compras' | 'plato_concreto'
const MODES: { value: Mode; label: string }[] = [
  { value: 'solo_lo_que_tengo', label: 'Solo lo que tengo' },
  { value: 'pequenas_compras', label: 'Pequeñas compras' },
  { value: 'plato_concreto', label: 'Plato concreto' },
]
const LOADING_STEPS = ['Leyendo tu petición…', 'Pensando combinaciones que funcionen…', 'Escribiendo los pasos…', 'Revisando alergias y seguridad…', 'Casi listo…']

function CreateInner() {
  const router = useRouter()
  const params = useSearchParams()
  const { user, profile, ensureSession } = useSession()
  const initialMode = (params.get('modo') as Mode) || 'solo_lo_que_tengo'
  const [mode, setMode] = useState<Mode>(MODES.some((m) => m.value === initialMode) ? initialMode : 'solo_lo_que_tengo')
  const [request, setRequest] = useState(params.get('q') ?? '')
  const [ingredients, setIngredients] = useState<ConfirmedIngredient[]>([])
  const [freeText, setFreeText] = useState('')
  const [usePantry, setUsePantry] = useState(params.get('despensa') === '1')
  const [pantry, setPantry] = useState<PantryRow[]>([])
  const [servings, setServings] = useState<number>(1)
  const [maxMinutes, setMaxMinutes] = useState<string>('')
  const [targets, setTargets] = useState<MealTargets>({})
  const [showTargets, setShowTargets] = useState(false)
  const [picker, setPicker] = useState(false)
  const [phase, setPhase] = useState<'form' | 'loading' | 'results' | 'error'>('form')
  const [step, setStep] = useState(0)
  const [error, setError] = useState<{ message: string; retryable: boolean; code?: string } | null>(null)
  const [result, setResult] = useState<GenerationResult | null>(null)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    if (params.get('desde') === 'escaner') setIngredients(drafts.getIngredients())
    const prev = drafts.getResults()
    if (params.get('ver') === '1' && prev) {
      setResult(prev)
      setPhase('results')
    }
  }, [params])
  useEffect(() => {
    if (!user) return
    listPantry().then((r) => r.ok && setPantry(r.data.filter((p) => p.status === 'disponible')))
    listHistory().then((r) => r.ok && setHistory([...new Set(r.data.filter((h) => h.kind !== 'scan').map((h) => h.query))].slice(0, 5)))
  }, [user])
  useEffect(() => {
    if (profile) {
      setServings(profile.default_servings || 1)
      if (profile.default_targets && hasTargets(profile.default_targets)) setTargets(profile.default_targets)
    }
  }, [profile])
  useEffect(() => {
    if (phase !== 'loading') return
    const t = setInterval(() => setStep((s) => Math.min(LOADING_STEPS.length - 1, s + 1)), 4000)
    return () => clearInterval(t)
  }, [phase])

  function addFree() {
    const names = freeText.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean)
    if (!names.length) return
    setIngredients((list) => [...list, ...names.map((n) => ({ name: n, foodKey: exactFood(n)?.key ?? null, quantity: null, unit: 'g' as const, state: 'desconocido' as const, useFirst: false }))])
    setFreeText('')
  }

  async function generate() {
    setError(null)
    const s = await ensureSession()
    if (!s.ok) {
      setPhase('error')
      setError({ message: s.reason, retryable: false, code: 'auth' })
      return
    }
    setPhase('loading')
    setStep(0)
    const r = await api<Omit<GenerationResult, 'createdAt'>>('/api/recipes/generate', {
      method: 'POST',
      json: {
        mode,
        request,
        ingredients: ingredients.map((i) => ({ name: i.name, foodKey: i.foodKey, quantity: i.quantity, unit: i.unit, state: i.state, useFirst: i.useFirst })),
        usePantry,
        servings,
        targets: hasTargets(targets) ? targets : null,
        maxMinutes: maxMinutes ? Number(maxMinutes) : null,
        count: 3,
      },
    })
    if (!r.ok) {
      setPhase('error')
      setError({ message: r.error, retryable: Boolean(r.retryable), code: r.code })
      return
    }
    const res: GenerationResult = { ...r.data, createdAt: Date.now() }
    drafts.setResults(res)
    setResult(res)
    setPhase('results')
  }

  const dietary = useMemo(() => toDietaryProfileClient(profile), [profile])
  const enriched = useMemo(() => result?.recipes.map((d) => enrichRecipe(d.recipe, { profile: dietary, pantry: [], targets: d.targets })) ?? [], [result, dietary])
  const canGenerate = mode === 'plato_concreto' ? request.trim().length > 2 : ingredients.length > 0 || (usePantry && pantry.length > 0)

  if (phase === 'loading') {
    return (
      <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-6 text-center" role="status" aria-live="polite">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 animate-ping rounded-full bg-saffron/30" />
          <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brand text-saffron">
            <Sparkles className="h-10 w-10" aria-hidden />
          </div>
        </div>
        <div>
          <p className="font-display text-xl font-semibold">{LOADING_STEPS[step]}</p>
          <p className="mt-1 text-sm text-muted">La IA escribe la receta; después calculamos la nutrición con datos de USDA.</p>
        </div>
      </div>
    )
  }

  if (phase === 'results' && result) {
    return (
      <div className="flex flex-col gap-5">
        <PageHeader eyebrow="Propuestas" title={mode === 'plato_concreto' ? 'Tu receta' : 'Puedes cocinar…'} subtitle={result.interpretation.summary} action={<Button variant="ghost" onClick={() => setPhase('form')}>Cambiar petición</Button>} />
        {result.targets && hasTargets(result.targets) && (
          <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <Target className="h-4 w-4" aria-hidden /> Objetivos por ración aplicados al abrir cada receta.
          </p>
        )}
        {result.infeasible && <ErrorBox title="Lo que pides no encaja del todo" message={result.infeasible} />}
        {result.interpretation.questions.length > 0 && (
          <div className="rounded-2xl border border-warn/40 bg-warn/5 p-4 text-sm">
            <p className="font-semibold">Antes de cocinar, confirma:</p>
            <ul className="mt-1 list-disc pl-5 text-muted">
              {result.interpretation.questions.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
        )}
        {result.removed > 0 && <p className="text-sm text-muted">Se han descartado {result.removed} propuesta(s) por no ser compatibles con tus alergias o tu dieta.</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.recipes.map((d, i) => {
            const e = enriched[i]
            const n = e?.nutrition.perServing
            return (
              <div key={i} className="flex flex-col gap-2">
                <RecipeCard recipe={e?.recipe ?? d.recipe} kcal={n?.kcal ?? null} protein={n?.protein ?? null} onClick={() => router.push(`/receta?i=${i}`)} badge={e?.optimization ? (e.optimization.balanced.status === 'met' ? 'Cumple tus objetivos' : 'Se aproxima a tus objetivos') : undefined} />
                {e && e.issues.some((x) => x.severity !== 'aviso') && <Badge tone="warn">Revisa avisos</Badge>}
              </div>
            )
          })}
        </div>
        <Button variant="outline" onClick={generate} icon={<Sparkles className="h-4 w-4" aria-hidden />} className="self-start">
          Otras propuestas
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Crear" title="¿Qué te apetece?" subtitle="Elige cómo quieres cocinar. Los objetivos nutricionales son opcionales." />
      <Tabs label="Modo de creación" value={mode} onChange={setMode} items={MODES} />

      {phase === 'error' && error && (
        <ErrorBox
          message={error.message}
          onRetry={error.retryable ? generate : undefined}
          action={
            error.code === 'quota_exceeded' ? (
              <Button size="sm" variant="primary" onClick={() => router.push('/planes')}>
                Ver planes
              </Button>
            ) : error.code === 'auth' || error.code === 'unauthenticated' ? (
              <Button size="sm" variant="primary" onClick={() => router.push('/entrar')}>
                Entrar
              </Button>
            ) : undefined
          }
        />
      )}

      <section className="flex flex-col gap-2">
        <label htmlFor="req" className="text-sm font-semibold">
          {mode === 'plato_concreto' ? '¿Qué plato quieres?' : 'Algo más que debamos saber (opcional)'}
        </label>
        <Textarea id="req" value={request} maxLength={600} onChange={(e) => setRequest(e.target.value)} placeholder={mode === 'plato_concreto' ? 'Espaguetis a la boloñesa de unas 700 kcal con al menos 35 g de proteína, con la carne que tengo' : 'Algo rápido, sin horno, para llevar…'} />
        {history.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {history.map((h) => (
              <button key={h} type="button" onClick={() => setRequest(h)} className="max-w-full truncate rounded-full bg-sunken px-3 py-1 text-xs text-muted hover:text-ink">
                {h}
              </button>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="ings" className="flex flex-col gap-3">
        <h2 id="ings" className="text-sm font-semibold">
          {mode === 'plato_concreto' ? 'Ingredientes que quieres aprovechar (opcional)' : 'Ingredientes disponibles'}
        </h2>
        <div className="flex flex-wrap gap-2">
          {ingredients.map((i, k) => (
            <span key={`${i.name}-${k}`} className={cx('inline-flex items-center gap-1.5 rounded-full border py-1.5 pl-3 pr-1.5 text-sm', i.useFirst ? 'border-saffron bg-saffron/15' : 'border-line bg-surface')}>
              {i.name}
              {i.quantity ? <span className="num text-xs text-muted">{i.quantity} {i.unit}</span> : null}
              <button type="button" aria-label={`Quitar ${i.name}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-sunken" onClick={() => setIngredients((l) => l.filter((_, x) => x !== k))}>
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          ))}
          {ingredients.length === 0 && <span className="text-sm text-muted">Aún no hay ingredientes.</span>}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            addFree()
          }}
        >
          <Input aria-label="Escribe ingredientes separados por comas" placeholder="pollo, arroz, tomate…" value={freeText} onChange={(e) => setFreeText(e.target.value)} />
          <Button type="submit" variant="outline" icon={<Plus className="h-4 w-4" aria-hidden />}>
            Añadir
          </Button>
        </form>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setPicker(true)}>
            Buscar en el catálogo (con cantidades)
          </Button>
          <Button size="sm" variant="ghost" onClick={() => router.push('/escanear')}>
            Escanear una foto
          </Button>
        </div>
        {user && (
          <label className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 text-sm">
            <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--brand))]" checked={usePantry} onChange={(e) => setUsePantry(e.target.checked)} />
            <Package className="h-5 w-5 text-brand-ink" aria-hidden />
            <span>
              Usar mi despensa <span className="text-muted">({pantry.length} productos disponibles)</span>
            </span>
          </label>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
          <span className="text-sm font-semibold">Raciones</span>
          <Stepper label="raciones" value={servings} min={1} max={20} onChange={(v) => setServings(Math.round(v))} />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-3">
          <label htmlFor="maxmin" className="text-sm font-semibold">
            Tiempo máximo
          </label>
          <Select id="maxmin" value={maxMinutes} onChange={(e) => setMaxMinutes(e.target.value)} className="w-40">
            <option value="">Sin límite</option>
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hora</option>
          </Select>
        </div>
      </section>

      <section className="rounded-2xl border border-line bg-surface">
        <button type="button" className="flex w-full items-center justify-between gap-2 p-4 text-left" aria-expanded={showTargets} onClick={() => setShowTargets((s) => !s)}>
          <span className="flex items-center gap-2 font-semibold">
            <Target className="h-5 w-5 text-brand-ink" aria-hidden /> Objetivos nutricionales <span className="font-normal text-muted">(opcional, por ración)</span>
          </span>
          <ChevronDown className={cx('h-5 w-5 transition', showTargets && 'rotate-180')} aria-hidden />
        </button>
        {showTargets && (
          <div className="border-t border-line p-4">
            <TargetsForm value={targets} onChange={setTargets} />
          </div>
        )}
      </section>

      <div className="sticky bottom-24 z-10 lg:bottom-4">
        <Button variant="primary" size="lg" block icon={<Sparkles className="h-5 w-5" aria-hidden />} onClick={generate} disabled={!canGenerate}>
          {mode === 'plato_concreto' ? 'Crear mi receta' : 'Ver recetas'}
        </Button>
        {!canGenerate && <p className="mt-1 text-center text-xs text-muted">{mode === 'plato_concreto' ? 'Escribe el plato que quieres.' : 'Añade ingredientes o usa tu despensa.'}</p>}
      </div>

      <FoodPicker open={picker} onClose={() => setPicker(false)} onPick={({ food, quantity, unit }) => setIngredients((l) => [...l, { name: food.name, foodKey: food.key, quantity, unit: unit === 'ml' || unit === 'unidad' ? unit : 'g', state: 'desconocido', useFirst: false }])} />
    </div>
  )
}

export default function CreatePage() {
  return (
    <Suspense>
      <CreateInner />
    </Suspense>
  )
}
