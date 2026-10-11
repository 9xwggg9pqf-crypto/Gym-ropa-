'use client'
import { Info } from 'lucide-react'
import { useState } from 'react'
import type { NutritionResult } from '@/lib/nutrition/compute'
import type { NutrientKey, Nutrients } from '@/lib/nutrition/types'
import { Badge, cx } from '@/components/ui'

const fmt = (v: number | null, d = 1) => (v === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: d }).format(v))

const ROWS: { key: NutrientKey; label: string; unit: string; indent?: boolean; d?: number }[] = [
  { key: 'fat', label: 'Grasas', unit: 'g' },
  { key: 'satFat', label: 'de las cuales saturadas', unit: 'g', indent: true },
  { key: 'carbs', label: 'Hidratos de carbono', unit: 'g' },
  { key: 'sugars', label: 'de los cuales azúcares', unit: 'g', indent: true },
  { key: 'fiber', label: 'Fibra alimentaria', unit: 'g' },
  { key: 'protein', label: 'Proteínas', unit: 'g' },
  { key: 'sodiumMg', label: 'Sodio', unit: 'mg', d: 0 },
]

/** Reparto de la energía entre macronutrientes (factores 4/9/4), para visualizar proporciones. */
export function MacroBar({ n, className }: { n: Nutrients; className?: string }) {
  const p = (n.protein ?? 0) * 4
  const c = (n.carbs ?? 0) * 4
  const f = (n.fat ?? 0) * 9
  const t = p + c + f
  if (!t) return null
  const seg = [
    { v: p, cls: 'bg-protein', label: 'Proteínas' },
    { v: c, cls: 'bg-carbs', label: 'Hidratos' },
    { v: f, cls: 'bg-fat', label: 'Grasas' },
  ]
  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-sunken" role="img" aria-label={seg.map((s) => `${s.label} ${Math.round((s.v / t) * 100)} %`).join(', ') + ' de la energía'}>
        {seg.map((s) => (
          <div key={s.label} className={s.cls} style={{ width: `${(s.v / t) * 100}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        {seg.map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', s.cls)} aria-hidden />
            {s.label} <span className="num font-semibold text-ink">{Math.round((s.v / t) * 100)} %</span>
          </span>
        ))}
      </div>
    </div>
  )
}

export function MacroPills({ n, compact }: { n: Pick<Nutrients, 'kcal' | 'protein' | 'carbs' | 'fat'>; compact?: boolean }) {
  return (
    <div className={cx('num flex flex-wrap items-center gap-x-3 gap-y-1', compact ? 'text-xs' : 'text-sm')}>
      <span className="font-display font-semibold text-ink">{fmt(n.kcal, 0)} kcal</span>
      <span className="text-protein">P {fmt(n.protein, 0)} g</span>
      <span className="text-carbs">H {fmt(n.carbs, 0)} g</span>
      <span className="text-fat">G {fmt(n.fat, 0)} g</span>
    </div>
  )
}

const PRECISION = {
  alta: { tone: 'ok' as const, text: 'Precisión alta', help: 'Todos los ingredientes tienen datos y se han pesado en g o ml.' },
  media: { tone: 'warn' as const, text: 'Estimación', help: 'Hay cantidades en unidades o cucharadas, o productos comerciales cuya composición varía según la marca.' },
  baja: { tone: 'danger' as const, text: 'Incompleto', help: 'Faltan datos de algún ingrediente: el total no lo incluye.' },
}

/**
 * Ficha nutricional con el formato de la etiqueta europea (por ración y receta completa).
 * Muestra la precisión de la estimación, sus causas y la fuente de los datos.
 */
export function NutritionLabel({ result }: { result: NutritionResult }) {
  const [showNotes, setShowNotes] = useState(false)
  const pr = PRECISION[result.precision]
  return (
    <section aria-labelledby="ficha-nutricional" className="overflow-hidden rounded-2xl border-2 border-ink/80 bg-surface">
      <div className="flex items-center justify-between gap-2 border-b-2 border-ink/80 px-4 py-2.5">
        <h3 id="ficha-nutricional" className="font-display text-[15px] font-bold tracking-tight">
          Información nutricional
        </h3>
        <Badge tone={pr.tone}>{pr.text}</Badge>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 px-4 pt-3">
        <span className="label-caps text-muted">Valores estimados</span>
        <span className="label-caps text-right text-ink">Por ración</span>
        <span className="label-caps text-right text-muted">Receta ({result.servings})</span>
      </div>
      <div className="grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 border-b border-ink/30 px-4 pb-2 pt-1">
        <span className="text-[15px] font-semibold">Valor energético</span>
        <span className="num text-right font-display text-2xl font-bold">
          {fmt(result.perServing.kcal, 0)}
          <span className="ml-0.5 text-sm font-semibold">kcal</span>
        </span>
        <span className="num text-right text-sm text-muted">{fmt(result.total.kcal, 0)} kcal</span>
      </div>
      <dl className="px-4 py-1">
        {ROWS.map((r) => (
          <div key={r.key} className={cx('grid grid-cols-[1fr_auto_auto] items-baseline gap-x-4 border-b border-line py-1.5 last:border-0', r.indent && 'pl-4 text-muted')}>
            <dt className={cx('text-sm', !r.indent && 'font-medium')}>{r.label}</dt>
            <dd className="num w-20 text-right text-sm font-semibold">
              {fmt(result.perServing[r.key], r.d ?? 1)} {result.perServing[r.key] === null ? '' : r.unit}
            </dd>
            <dd className="num w-20 text-right text-xs text-muted">
              {fmt(result.total[r.key], r.d ?? 0)} {result.total[r.key] === null ? '' : r.unit}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2 border-t border-line bg-sunken/60 px-4 py-3">
        <MacroBar n={result.perServing} />
        <button type="button" className="inline-flex items-center gap-1.5 self-start text-xs font-semibold text-brand-ink hover:underline" aria-expanded={showNotes} onClick={() => setShowNotes((s) => !s)}>
          <Info className="h-3.5 w-3.5" aria-hidden />
          {showNotes ? 'Ocultar detalles del cálculo' : '¿Cómo se ha calculado?'}
        </button>
        {showNotes && (
          <div className="flex flex-col gap-1.5 text-xs leading-relaxed text-muted">
            <p>{pr.help}</p>
            {result.notes.map((n) => (
              <p key={n}>• {n}</p>
            ))}
            {result.missing.length > 0 && <p>• Sin datos: {result.missing.map((m) => m.name).join(', ')}.</p>}
            {result.incompleteNutrients.filter((k) => !['kcal', 'protein', 'carbs', 'fat'].includes(k)).length > 0 && (
              <p>• Algunos ingredientes no tienen dato de fibra, azúcares, saturadas o sodio en la fuente; esos totales pueden quedarse cortos.</p>
            )}
            <p>
              Fuente: {result.sources.join(' · ') || 'USDA FoodData Central'}. Cálculo determinista a partir del peso de cada ingrediente; la IA no interviene en estas cifras. Es una estimación orientativa, no un análisis de laboratorio.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
