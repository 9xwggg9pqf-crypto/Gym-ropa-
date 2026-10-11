'use client'
import { Camera, CircleHelp, ImagePlus, Package, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import type { ScanResult } from '@/lib/ai/scan'
import { drafts, type ConfirmedIngredient } from '@/lib/drafts'
import { insertPantry } from '@/lib/client-data'
import { searchFoods } from '@/lib/nutrition/catalog'
import { useSession } from '@/lib/session'
import { FoodPicker } from '@/components/recipe/FoodPicker'
import { Badge, Button, cx, ErrorBox, IconButton, Input, PageHeader, Select, useToast } from '@/components/ui'

type Row = ConfirmedIngredient & { id: string; include: boolean; confidence: 'alta' | 'media' | 'baja' | 'manual'; detectedAs?: string }

/** Reduce la foto en el navegador antes de enviarla (máx. 1568 px, JPEG): menos datos, misma utilidad. */
async function prepareImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file).catch(() => null)
  if (!bitmap) throw new Error('No se ha podido leer la imagen. Prueba con una foto JPG o PNG.')
  const scale = Math.min(1, 1568 / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.85))
  if (!blob) throw new Error('No se ha podido procesar la imagen.')
  return blob
}

export default function ScanPage() {
  const router = useRouter()
  const toast = useToast()
  const { ensureSession } = useSession()
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'review' | 'error'>('idle')
  const [error, setError] = useState<{ message: string; retryable: boolean; code?: string } | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [unidentified, setUnidentified] = useState<ScanResult['unidentified']>([])
  const [quality, setQuality] = useState<ScanResult['imageQuality'] | null>(null)
  const [picker, setPicker] = useState<{ rowId: string | null; query: string } | null>(null)
  const [location, setLocation] = useState<'nevera' | 'congelador' | 'despensa'>('nevera')
  const [saving, setSaving] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const b = await prepareImage(file)
      setBlob(b)
      setPreview(URL.createObjectURL(b))
      await analyze(b)
    } catch (e) {
      setPhase('error')
      setError({ message: e instanceof Error ? e.message : 'No se ha podido leer la imagen.', retryable: false })
    }
  }

  async function analyze(b: Blob | null = blob) {
    if (!b) return
    const s = await ensureSession()
    if (!s.ok) {
      setPhase('error')
      setError({ message: s.reason, retryable: false, code: 'auth' })
      return
    }
    setPhase('analyzing')
    const form = new FormData()
    form.append('image', b, 'foto.jpg')
    try {
      const res = await fetch('/api/scan', { method: 'POST', body: form })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setPhase('error')
        setError({ message: body?.error?.message ?? 'No se ha podido analizar la imagen.', retryable: body?.error?.retryable ?? res.status >= 500, code: body?.error?.code })
        return
      }
      const r = body as ScanResult
      setQuality(r.imageQuality)
      setUnidentified(r.unidentified)
      setRows(
        r.items.map((it, i) => ({
          id: `r${i}`,
          name: it.foodName ?? it.name,
          detectedAs: it.name,
          foodKey: it.foodKey,
          quantity: it.count,
          unit: it.count ? 'unidad' : 'g',
          state: it.state,
          useFirst: false,
          include: !it.needsConfirmation,
          confidence: it.confidence,
        })),
      )
      setPhase('review')
      if (r.notFood) toast('No parece que haya alimentos en la foto.', 'info')
    } catch {
      setPhase('error')
      setError({ message: 'No hay conexión con el servidor. Revisa tu conexión e inténtalo de nuevo.', retryable: true })
    }
  }

  const update = (id: string, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  const confirmed = rows.filter((r) => r.include)

  function toRecipes(mode: 'solo_lo_que_tengo' | 'pequenas_compras') {
    if (confirmed.length === 0) return toast('Marca al menos un ingrediente.', 'error')
    drafts.setIngredients(confirmed.map(({ name, foodKey, quantity, unit, state, useFirst }) => ({ name, foodKey, quantity, unit, state, useFirst })))
    router.push(`/crear?modo=${mode}&desde=escaner`)
  }

  async function toPantry() {
    if (confirmed.length === 0) return toast('Marca al menos un ingrediente.', 'error')
    const s = await ensureSession()
    if (!s.ok) return toast(s.reason, 'error')
    setSaving(true)
    const stateMap = { crudo: 'crudo', cocinado: 'cocinado', congelado: 'congelado', conserva: 'conserva', desconocido: null } as const
    const r = await insertPantry(confirmed.map((c) => ({ name: c.name, food_key: c.foodKey, quantity: c.quantity, unit: c.unit, location, food_state: stateMap[c.state], use_first: c.useFirst, status: 'disponible' as const })))
    setSaving(false)
    if (!r.ok) return toast(r.error, 'error')
    toast(`${r.data.length} producto(s) guardados en tu despensa`)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Escáner" title="¿Qué tienes a mano?" subtitle="Haz una foto a tu nevera, despensa o encimera. Revisarás la lista antes de usarla: una foto no siempre permite identificarlo todo." />

      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <input ref={galleryRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />

      {phase === 'idle' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl bg-brand p-6 text-white shadow-lift">
            <Camera className="h-10 w-10 text-saffron" aria-hidden />
            <span className="font-display text-lg font-semibold">Hacer una foto</span>
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="flex min-h-[160px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-line bg-surface p-6">
            <ImagePlus className="h-10 w-10 text-brand-ink" aria-hidden />
            <span className="font-display text-lg font-semibold">Elegir de la galería</span>
          </button>
          <div className="flex flex-col gap-1 text-sm text-muted sm:col-span-2">
            <p>Consejos: buena luz, puertas abiertas del todo y etiquetas hacia la cámara.</p>
            <p>La foto se envía cifrada para analizarla y no se guarda en SNACKEATS.</p>
            <button type="button" className="self-start font-semibold text-brand-ink underline" onClick={() => setPhase('review')}>
              Prefiero escribir los ingredientes
            </button>
          </div>
        </div>
      )}

      {preview && phase !== 'idle' && (
        <div className="relative mx-auto w-full max-w-md overflow-hidden rounded-3xl border border-line bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Foto que estás analizando" className="max-h-72 w-full object-cover" />
          {phase === 'analyzing' && (
            <div className="absolute inset-0 bg-brand/30" aria-hidden>
              <div className="h-1/2 w-full animate-scanline border-b-2 border-saffron bg-gradient-to-b from-transparent to-saffron/30" />
            </div>
          )}
        </div>
      )}

      {phase === 'analyzing' && (
        <p role="status" className="text-center text-sm font-medium text-muted">
          Identificando alimentos… suele tardar unos segundos.
        </p>
      )}

      {phase === 'error' && error && (
        <ErrorBox
          message={error.message}
          onRetry={error.retryable && blob ? () => analyze() : undefined}
          action={
            <>
              <Button size="sm" variant="ghost" onClick={() => { setPhase('idle'); setPreview(null) }}>
                Usar otra foto
              </Button>
              {error.code === 'quota_exceeded' && (
                <Button size="sm" variant="primary" onClick={() => router.push('/planes')}>
                  Ver planes
                </Button>
              )}
              {error.code === 'auth' && (
                <Button size="sm" variant="primary" onClick={() => router.push('/entrar')}>
                  Entrar
                </Button>
              )}
            </>
          }
        />
      )}

      {phase === 'review' && (
        <section aria-labelledby="revisa" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="revisa" className="font-display text-lg font-semibold">
              Revisa los ingredientes
            </h2>
            {quality && quality !== 'buena' && <Badge tone="warn">Calidad de imagen {quality}: revisa con más cuidado</Badge>}
          </div>
          <p className="text-sm text-muted">Marca lo que es correcto, corrige nombres y añade lo que falte. Los pesos y fechas no se pueden saber por una foto: indícalos si los conoces.</p>

          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className={cx('flex flex-col gap-3 rounded-2xl border p-3', r.include ? 'border-brand/40 bg-surface' : 'border-line bg-surface/60')}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[rgb(var(--brand))]" checked={r.include} onChange={(e) => update(r.id, { include: e.target.checked })} aria-label={`Incluir ${r.name}`} />
                  <div className="min-w-0 flex-1">
                    <button type="button" className="text-left font-semibold underline decoration-line decoration-2 underline-offset-4 hover:decoration-brand" onClick={() => setPicker({ rowId: r.id, query: r.detectedAs ?? r.name })}>
                      {r.name}
                    </button>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      {r.confidence !== 'manual' && <Badge tone={r.confidence === 'alta' ? 'ok' : r.confidence === 'media' ? 'warn' : 'danger'}>Confianza {r.confidence} (estimada por la IA)</Badge>}
                      {r.detectedAs && r.detectedAs !== r.name && <span>Detectado como «{r.detectedAs}»</span>}
                      {!r.foodKey && <span className="text-warn">Sin datos nutricionales: toca el nombre para elegir el alimento</span>}
                    </div>
                  </div>
                  <IconButton label={`Eliminar ${r.name}`} onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                    <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                  </IconButton>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Input aria-label={`Cantidad de ${r.name}`} inputMode="decimal" placeholder="Cantidad" value={r.quantity ?? ''} onChange={(e) => update(r.id, { quantity: e.target.value ? Number(e.target.value.replace(',', '.')) || null : null })} />
                  <Select aria-label={`Unidad de ${r.name}`} value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value as Row['unit'] })}>
                    <option value="g">gramos</option>
                    <option value="ml">ml</option>
                    <option value="unidad">unidades</option>
                  </Select>
                  <Select aria-label={`Estado de ${r.name}`} value={r.state} onChange={(e) => update(r.id, { state: e.target.value as Row['state'] })}>
                    <option value="desconocido">Estado…</option>
                    <option value="crudo">Crudo/fresco</option>
                    <option value="cocinado">Cocinado</option>
                    <option value="congelado">Congelado</option>
                    <option value="conserva">En conserva</option>
                  </Select>
                  <label className="flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm">
                    <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--saffron))]" checked={r.useFirst} onChange={(e) => update(r.id, { useFirst: e.target.checked })} />
                    Gastar primero
                  </label>
                </div>
              </li>
            ))}
          </ul>

          {unidentified.length > 0 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-warn/40 bg-warn/5 p-4">
              <p className="flex items-center gap-2 font-semibold">
                <CircleHelp className="h-5 w-5 text-warn" aria-hidden /> No hemos podido identificar
              </p>
              {unidentified.map((u, i) => (
                <div key={i} className="flex flex-col gap-1.5 text-sm">
                  <p className="text-muted">{u.description}</p>
                  <div className="flex flex-wrap gap-2">
                    {u.possibilities.map((p) => (
                      <button
                        key={p}
                        type="button"
                        className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm hover:border-brand/50"
                        onClick={() => {
                          const food = searchFoods(p, 1)[0]
                          setRows((rs) => [...rs, { id: `u${Date.now()}`, name: food?.name ?? p, foodKey: food?.key ?? null, quantity: null, unit: 'g', state: 'desconocido', useFirst: false, include: true, confidence: 'manual' }])
                          setUnidentified((us) => us.filter((_, k) => k !== i))
                        }}
                      >
                        Es {p.toLowerCase()}
                      </button>
                    ))}
                    <button type="button" className="rounded-full px-3 py-1.5 text-sm text-muted underline" onClick={() => setUnidentified((us) => us.filter((_, k) => k !== i))}>
                      Ignorar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Button variant="ghost" icon={<Plus className="h-4 w-4" aria-hidden />} className="self-start" onClick={() => setPicker({ rowId: null, query: '' })}>
            Añadir un ingrediente
          </Button>

          <div className="sticky bottom-24 z-10 flex flex-col gap-2 rounded-2xl border border-line bg-surface/95 p-3 shadow-lift backdrop-blur lg:bottom-4">
            <p className="text-sm text-muted">
              <span className="num font-semibold text-ink">{confirmed.length}</span> ingrediente(s) confirmados
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <Button variant="primary" icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={() => toRecipes('solo_lo_que_tengo')}>
                Recetas con esto
              </Button>
              <Button variant="outline" onClick={() => toRecipes('pequenas_compras')}>
                Con pequeñas compras
              </Button>
              <div className="flex gap-2">
                <Select aria-label="Ubicación en la despensa" value={location} onChange={(e) => setLocation(e.target.value as typeof location)} className="w-[8.5rem]">
                  <option value="nevera">Nevera</option>
                  <option value="congelador">Congelador</option>
                  <option value="despensa">Despensa</option>
                </Select>
                <Button variant="outline" icon={<Package className="h-4 w-4" aria-hidden />} onClick={toPantry} loading={saving} className="flex-1">
                  Guardar
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}

      <FoodPicker
        open={Boolean(picker)}
        initialQuery={picker?.query ?? ''}
        title={picker?.rowId ? 'Corregir ingrediente' : 'Añadir ingrediente'}
        onClose={() => setPicker(null)}
        onPick={({ food, quantity, unit }) => {
          const u = unit === 'unidad' || unit === 'ml' ? unit : 'g'
          if (picker?.rowId) update(picker.rowId, { name: food.name, foodKey: food.key, include: true, quantity, unit: u })
          else setRows((rs) => [...rs, { id: `m${Date.now()}`, name: food.name, foodKey: food.key, quantity, unit: u, state: 'desconocido', useFirst: false, include: true, confidence: 'manual' }])
        }}
      />
    </div>
  )
}
