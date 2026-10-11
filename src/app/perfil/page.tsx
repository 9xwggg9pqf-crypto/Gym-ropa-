'use client'
import { Download, LogOut, Moon, Monitor, ShieldCheck, Sun, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { api, deleteCustomFood, getSubscription, listCustomFoods, updateProfile, usageSummary } from '@/lib/client-data'
import type { CustomFoodRow, ProfileRow } from '@/lib/api-types'
import { ALLERGEN_LABELS, DIET_LABELS, DIETS, INTOLERANCES } from '@/lib/nutrition/restrictions'
import { ALLERGENS, type MealTargets } from '@/lib/nutrition/types'
import { useSession } from '@/lib/session'
import { TargetsForm } from '@/components/recipe/TargetsForm'
import { Badge, Button, Chip, cx, EmptyState, Field, IconButton, Input, LinkButton, PageHeader, Select, Sheet, Skeleton, useToast } from '@/components/ui'
import { UserRound } from 'lucide-react'

const PROFILE_TYPES: [ProfileRow['profile_type'], string][] = [
  ['cotidiana', 'Cocina cotidiana'],
  ['equilibrada', 'Alimentación equilibrada'],
  ['deporte', 'Entrenamiento y deporte'],
  ['batch', 'Preparar comidas para varios días'],
  ['economica', 'Cocina económica'],
  ['rapida', 'Recetas rápidas'],
]

function TagInput({ id, label, values, onChange, placeholder }: { id: string; label: string; values: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [t, setT] = useState('')
  return (
    <Field label={label} htmlFor={id}>
      <div className="flex flex-wrap gap-1.5">
        {values.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-full bg-sunken py-1 pl-3 pr-1 text-sm">
            {v}
            <button type="button" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-line" aria-label={`Quitar ${v}`} onClick={() => onChange(values.filter((x) => x !== v))}>
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </span>
        ))}
      </div>
      <Input
        id={id}
        value={t}
        placeholder={placeholder}
        onChange={(e) => setT(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            const v = t.trim().toLowerCase()
            if (v && !values.includes(v) && values.length < 100) onChange([...values, v.slice(0, 60)])
            setT('')
          }
        }}
      />
    </Field>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const toast = useToast()
  const { user, profile, isGuest, loading, configured, refreshProfile, signOut } = useSession()
  const [v, setV] = useState<ProfileRow | null>(null)
  const [saving, setSaving] = useState(false)
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')
  const [usage, setUsage] = useState<{ plan: string; limits: Record<string, number>; used: Record<string, number>; saved_recipes: number } | null>(null)
  const [sub, setSub] = useState<{ plan_id: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null>(null)
  const [foods, setFoods] = useState<CustomFoodRow[]>([])
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => setV(profile), [profile])
  useEffect(() => {
    try {
      const t = localStorage.getItem('snackeats-theme')
      if (t === 'light' || t === 'dark') setTheme(t)
    } catch {
      /* sin almacenamiento */
    }
  }, [])
  useEffect(() => {
    if (!user) return
    usageSummary().then((r) => r.ok && setUsage(r.data))
    getSubscription().then((r) => r.ok && setSub(r.data))
    listCustomFoods().then((r) => r.ok && setFoods(r.data))
  }, [user])

  function applyTheme(t: typeof theme) {
    setTheme(t)
    try {
      if (t === 'system') localStorage.removeItem('snackeats-theme')
      else localStorage.setItem('snackeats-theme', t)
    } catch {
      /* sin almacenamiento */
    }
    if (t === 'system') document.documentElement.removeAttribute('data-theme')
    else document.documentElement.setAttribute('data-theme', t)
  }

  async function save() {
    if (!v || !user) return
    setSaving(true)
    const r = await updateProfile(user.id, {
      display_name: v.display_name?.trim() || null,
      locale: v.locale,
      region: v.region,
      profile_type: v.profile_type,
      cooking_level: v.cooking_level,
      usual_minutes: v.usual_minutes,
      budget: v.budget,
      default_servings: v.default_servings,
      allergies: v.allergies,
      intolerances: v.intolerances,
      diets: v.diets,
      dislikes: v.dislikes,
      favorites: v.favorites,
      default_targets: v.default_targets && Object.values(v.default_targets).some(Boolean) ? v.default_targets : null,
      personalization_consent: v.personalization_consent,
    })
    setSaving(false)
    if (!r.ok) return toast(r.error, 'error')
    await refreshProfile()
    toast('Perfil guardado')
  }

  async function portal() {
    const r = await api<{ url: string }>('/api/stripe/portal', { method: 'POST' })
    if (!r.ok) return toast(r.error, 'error')
    window.location.assign(r.data.url)
  }

  async function deleteAccount() {
    setDeleting(true)
    const r = await api<{ deleted: boolean }>('/api/account/delete', { method: 'POST', json: { confirm: delText } })
    setDeleting(false)
    if (!r.ok) return toast(r.error, 'error')
    await signOut()
    toast('Tu cuenta y tus datos se han eliminado')
    router.push('/')
  }

  if (!loading && (!configured || !user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Perfil" />
        <EmptyState icon={<UserRound className="h-6 w-6" aria-hidden />} title="Tu perfil es opcional" action={<LinkButton href="/entrar" variant="primary">Entrar o crear cuenta</LinkButton>}>
          Sirve para respetar tus alergias y preferencias en todas las recetas.
        </EmptyState>
        <ThemePicker theme={theme} onChange={applyTheme} />
      </div>
    )
  }
  if (!v) return <Skeleton className="h-96" />
  const toggle = (key: 'allergies' | 'intolerances' | 'diets', val: string) => setV({ ...v, [key]: v[key].includes(val) ? v[key].filter((x) => x !== val) : [...v[key], val] })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Perfil y objetivos" subtitle="Todo es opcional. Sólo pedimos lo que mejora tus recetas." />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <p className="font-semibold">{isGuest ? 'Cuenta de invitado' : user?.email}</p>
          <p className="text-sm text-muted">{isGuest ? 'Crea una cuenta para no perder tus datos si cambias de dispositivo.' : 'Sesión iniciada'}</p>
        </div>
        <div className="flex gap-2">
          {isGuest && <LinkButton href="/entrar?convertir=1" variant="primary">Crear cuenta</LinkButton>}
          <Button variant="ghost" icon={<LogOut className="h-4 w-4" aria-hidden />} onClick={async () => { await signOut(); router.push('/') }}>
            Cerrar sesión
          </Button>
        </div>
      </section>

      <section aria-labelledby="sec-basico" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <h2 id="sec-basico" className="font-display text-base font-semibold">
          Sobre ti
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre o alias" htmlFor="pf-name">
            <Input id="pf-name" maxLength={60} value={v.display_name ?? ''} onChange={(e) => setV({ ...v, display_name: e.target.value })} />
          </Field>
          <Field label="Idioma" htmlFor="pf-locale" hint="El inglés está en preparación: por ahora traduce la navegación y los textos comunes.">
            <Select id="pf-locale" value={v.locale} onChange={(e) => setV({ ...v, locale: e.target.value as ProfileRow['locale'] })}>
              <option value="es">Español</option>
              <option value="en">English (beta)</option>
            </Select>
          </Field>
          <Field label="País o región" htmlFor="pf-region">
            <Select id="pf-region" value={v.region} onChange={(e) => setV({ ...v, region: e.target.value })}>
              {['ES', 'MX', 'AR', 'CO', 'CL', 'PE', 'US', 'GB', 'FR', 'OTRO'].map((c) => (
                <option key={c} value={c}>
                  {{ ES: 'España', MX: 'México', AR: 'Argentina', CO: 'Colombia', CL: 'Chile', PE: 'Perú', US: 'Estados Unidos', GB: 'Reino Unido', FR: 'Francia', OTRO: 'Otro' }[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Enfoque" htmlFor="pf-type">
            <Select id="pf-type" value={v.profile_type} onChange={(e) => setV({ ...v, profile_type: e.target.value as ProfileRow['profile_type'] })}>
              {PROFILE_TYPES.map(([val, l]) => (
                <option key={val} value={val}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nivel en la cocina" htmlFor="pf-level">
            <Select id="pf-level" value={v.cooking_level} onChange={(e) => setV({ ...v, cooking_level: e.target.value as ProfileRow['cooking_level'] })}>
              <option value="principiante">Principiante</option>
              <option value="basico">Básico</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </Select>
          </Field>
          <Field label="Tiempo habitual para cocinar" htmlFor="pf-min">
            <Select id="pf-min" value={v.usual_minutes ?? ''} onChange={(e) => setV({ ...v, usual_minutes: e.target.value ? Number(e.target.value) : null })}>
              <option value="">Sin indicar</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">1 hora o más</option>
            </Select>
          </Field>
          <Field label="Presupuesto" htmlFor="pf-budget">
            <Select id="pf-budget" value={v.budget ?? ''} onChange={(e) => setV({ ...v, budget: (e.target.value || null) as ProfileRow['budget'] })}>
              <option value="">Sin indicar</option>
              <option value="bajo">Ajustado</option>
              <option value="medio">Medio</option>
              <option value="alto">Holgado</option>
            </Select>
          </Field>
          <Field label="Raciones habituales" htmlFor="pf-serv">
            <Select id="pf-serv" value={v.default_servings} onChange={(e) => setV({ ...v, default_servings: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 8, 10].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section aria-labelledby="sec-alergias" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <h2 id="sec-alergias" className="flex items-center gap-2 font-display text-base font-semibold">
          <ShieldCheck className="h-5 w-5 text-brand-ink" aria-hidden /> Alergias, intolerancias y dieta
        </h2>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Alergias (se excluyen siempre)</p>
          <div className="flex flex-wrap gap-2">
            {ALLERGENS.map((a) => (
              <Chip key={a} tone="danger" active={v.allergies.includes(a)} onClick={() => toggle('allergies', a)}>
                {ALLERGEN_LABELS[a]}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-muted">Los 14 alérgenos de declaración obligatoria en la UE. Revisaremos ingredientes y sustituciones, y te avisaremos cuando debas comprobar una etiqueta. SNACKEATS no puede garantizar la ausencia de trazas.</p>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Intolerancias (aviso y preferencia por alternativas)</p>
          <div className="flex flex-wrap gap-2">
            {INTOLERANCES.map((a) => (
              <Chip key={a} active={v.intolerances.includes(a)} onClick={() => toggle('intolerances', a)}>
                {a[0].toUpperCase() + a.slice(1)}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold">Dieta</p>
          <div className="flex flex-wrap gap-2">
            {DIETS.map((d) => (
              <Chip key={d} active={v.diets.includes(d)} onClick={() => toggle('diets', d)}>
                {DIET_LABELS[d]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TagInput id="pf-dislikes" label="No me gusta" values={v.dislikes} onChange={(dislikes) => setV({ ...v, dislikes })} placeholder="Escribe y pulsa Intro (p. ej. cilantro)" />
          <TagInput id="pf-favs" label="Me encanta" values={v.favorites} onChange={(favorites) => setV({ ...v, favorites })} placeholder="p. ej. pollo, picante, pasta" />
        </div>
      </section>

      <section aria-labelledby="sec-obj" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
        <h2 id="sec-obj" className="font-display text-base font-semibold">
          Objetivos por defecto (opcional)
        </h2>
        <p className="text-sm text-muted">Se proponen al crear una receta; puedes cambiarlos en cada comida.</p>
        <TargetsForm value={(v.default_targets ?? {}) as MealTargets} onChange={(t) => setV({ ...v, default_targets: t })} />
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[rgb(var(--brand))]" checked={v.personalization_consent} onChange={(e) => setV({ ...v, personalization_consent: e.target.checked })} />
          <span>
            <span className="font-semibold">Personalizar con mis recetas favoritas</span>
            <br />
            <span className="text-muted">Si lo activas, los títulos de tus recetas favoritas se envían a la IA como inspiración al generar nuevas recetas. Puedes desactivarlo cuando quieras.</span>
          </span>
        </label>
      </section>

      <div className="sticky bottom-24 z-10 lg:bottom-4">
        <Button variant="primary" size="lg" block onClick={save} loading={saving}>
          Guardar perfil
        </Button>
      </div>

      <ThemePicker theme={theme} onChange={applyTheme} />

      <section aria-labelledby="sec-plan" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="sec-plan" className="font-display text-base font-semibold">
            Plan y uso este mes
          </h2>
          {usage && <Badge tone={usage.plan === 'premium' ? 'saffron' : 'neutral'}>{{ guest: 'Invitado', free: 'Gratis', premium: 'Premium' }[usage.plan] ?? usage.plan}</Badge>}
        </div>
        {usage ? (
          <div className="flex flex-col gap-2">
            {[
              ['scan', 'Escaneos'],
              ['generate', 'Recetas generadas'],
              ['adapt', 'Platos adaptados'],
            ].map(([k, l]) => {
              const used = usage.used[k] ?? 0
              const lim = usage.limits[k] ?? 0
              return (
                <div key={k} className="flex flex-col gap-1">
                  <div className="num flex justify-between text-sm">
                    <span>{l}</span>
                    <span className="text-muted">
                      {used} / {lim}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-sunken">
                    <div className={cx('h-full', used >= lim ? 'bg-danger' : 'bg-brand')} style={{ width: `${Math.min(100, lim ? (used / lim) * 100 : 0)}%` }} />
                  </div>
                </div>
              )
            })}
            <p className="num text-sm text-muted">
              Recetas guardadas: {usage.saved_recipes} / {usage.limits.saved_recipes}
            </p>
          </div>
        ) : (
          <Skeleton className="h-20" />
        )}
        {sub && (
          <p className="text-sm text-muted">
            Suscripción: {sub.status}
            {sub.current_period_end && ` · ${sub.cancel_at_period_end ? 'termina' : 'se renueva'} el ${new Date(sub.current_period_end).toLocaleDateString('es-ES')}`}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <LinkButton href="/planes" variant="outline">
            Ver planes
          </LinkButton>
          {sub && (
            <Button variant="ghost" onClick={portal}>
              Gestionar suscripción
            </Button>
          )}
        </div>
      </section>

      <section aria-labelledby="sec-foods" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="sec-foods" className="font-display text-base font-semibold">
          Mis alimentos (de etiqueta)
        </h2>
        {foods.length === 0 ? (
          <p className="text-sm text-muted">Puedes crear alimentos con los datos de su etiqueta desde el buscador de ingredientes.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {foods.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{f.name}</span>
                  <span className="num text-xs text-muted">
                    {f.kcal} kcal · P {f.protein} · H {f.carbs} · G {f.fat} g / 100 g
                  </span>
                </span>
                <IconButton
                  label={`Eliminar ${f.name}`}
                  onClick={async () => {
                    const r = await deleteCustomFood(f.id)
                    if (!r.ok) return toast(r.error, 'error')
                    setFoods((x) => x.filter((y) => y.id !== f.id))
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </IconButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="sec-priv" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
        <h2 id="sec-priv" className="font-display text-base font-semibold">
          Tus datos
        </h2>
        <p className="text-sm text-muted">
          Guardamos tu perfil, recetas, despensa, plan, lista y el texto de tus búsquedas. Las fotos del escáner no se guardan. Más detalles en la{' '}
          <Link href="/privacidad" className="font-semibold text-brand-ink underline">
            política de privacidad
          </Link>
          .
        </p>
        <div className="flex flex-wrap gap-2">
          <a href="/api/account/export" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-[15px] font-semibold hover:border-brand/40">
            <Download className="h-4 w-4" aria-hidden /> Exportar mis datos (JSON)
          </a>
          <Button variant="ghost" className="text-danger" icon={<Trash2 className="h-4 w-4" aria-hidden />} onClick={() => setDelOpen(true)}>
            Eliminar mi cuenta
          </Button>
        </div>
      </section>

      <Sheet
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title="Eliminar la cuenta"
        footer={
          <Button variant="danger" block disabled={delText !== 'ELIMINAR'} loading={deleting} onClick={deleteAccount}>
            Eliminar definitivamente
          </Button>
        }
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>Se borrarán de forma permanente tu cuenta, perfil, recetas, colecciones, despensa, plan, lista de la compra, historial y alimentos propios. Si tienes una suscripción activa, se cancelará.</p>
          <p className="text-muted">Esta acción no se puede deshacer. Si quieres conservar algo, exporta antes tus datos.</p>
          <Field label="Escribe ELIMINAR para confirmar" htmlFor="del-confirm">
            <Input id="del-confirm" value={delText} onChange={(e) => setDelText(e.target.value)} autoComplete="off" />
          </Field>
        </div>
      </Sheet>
    </div>
  )
}

function ThemePicker({ theme, onChange }: { theme: 'system' | 'light' | 'dark'; onChange: (t: 'system' | 'light' | 'dark') => void }) {
  const opts = [
    { v: 'system' as const, l: 'Sistema', i: Monitor },
    { v: 'light' as const, l: 'Claro', i: Sun },
    { v: 'dark' as const, l: 'Oscuro', i: Moon },
  ]
  return (
    <section aria-labelledby="sec-tema" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
      <h2 id="sec-tema" className="font-display text-base font-semibold">
        Apariencia
      </h2>
      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
        {opts.map((o) => (
          <button key={o.v} type="button" role="radio" aria-checked={theme === o.v} onClick={() => onChange(o.v)} className={cx('flex flex-col items-center gap-1.5 rounded-xl border p-3 text-sm font-semibold', theme === o.v ? 'border-brand bg-brand/10 text-brand-ink' : 'border-line')}>
            <o.i className="h-5 w-5" aria-hidden />
            {o.l}
          </button>
        ))}
      </div>
    </section>
  )
}
