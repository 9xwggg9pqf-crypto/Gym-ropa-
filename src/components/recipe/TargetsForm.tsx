'use client'
import type { MacroTarget, MealTargets, TargetKind } from '@/lib/nutrition/types'
import { Chip, cx } from '@/components/ui'

const FIELDS: { key: keyof MealTargets; label: string; unit: string; defaultKind: TargetKind; color: string }[] = [
  { key: 'kcal', label: 'Calorías', unit: 'kcal', defaultKind: 'approx', color: 'text-ink' },
  { key: 'protein', label: 'Proteína', unit: 'g', defaultKind: 'min', color: 'text-protein' },
  { key: 'carbs', label: 'Hidratos', unit: 'g', defaultKind: 'approx', color: 'text-carbs' },
  { key: 'fat', label: 'Grasas', unit: 'g', defaultKind: 'max', color: 'text-fat' },
]
const KIND_LABEL: Record<TargetKind, string> = { approx: 'aprox.', min: 'mínimo', max: 'máximo' }
const PRESETS = [500, 650, 800, 1000]

/** Objetivos POR RACIÓN. Todos opcionales: se puede usar sólo uno o cualquier combinación. */
export function TargetsForm({ value, onChange }: { value: MealTargets; onChange: (v: MealTargets) => void }) {
  const set = (key: keyof MealTargets, t: MacroTarget | null) => onChange({ ...value, [key]: t })
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted">Rápido:</span>
        {PRESETS.map((k) => (
          <Chip key={k} active={value.kcal?.value === k} onClick={() => set('kcal', value.kcal?.value === k ? null : { value: k, kind: 'approx' })}>
            ~{k} kcal
          </Chip>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {FIELDS.map((f) => {
          const t = value[f.key]
          const id = `target-${f.key}`
          return (
            <div key={f.key} className={cx('flex flex-col gap-2 rounded-2xl border p-3 transition', t ? 'border-brand/40 bg-brand/5' : 'border-line bg-surface')}>
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className={cx('text-sm font-semibold', f.color)}>
                  {f.label}
                </label>
                <select
                  aria-label={`Tipo de objetivo de ${f.label}`}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium"
                  value={t?.kind ?? f.defaultKind}
                  onChange={(e) => t && set(f.key, { ...t, kind: e.target.value as TargetKind })}
                  disabled={!t}
                >
                  {(Object.keys(KIND_LABEL) as TargetKind[]).map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABEL[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id={id}
                  inputMode="numeric"
                  placeholder="Sin objetivo"
                  className="num h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] font-semibold focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
                  value={t?.value ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(',', '.'))
                    if (!e.target.value) set(f.key, null)
                    else if (Number.isFinite(n) && n > 0 && n <= 10000) set(f.key, { value: n, kind: t?.kind ?? f.defaultKind, strict: t?.strict })
                  }}
                />
                <span className="w-9 text-sm text-muted">{f.unit}</span>
              </div>
              {t && (
                <label className="flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--brand))]" checked={Boolean(t.strict)} onChange={(e) => set(f.key, { ...t, strict: e.target.checked })} />
                  Límite estricto (no flexible)
                </label>
              )}
            </div>
          )
        })}
      </div>
      <p className="text-xs text-muted">Los objetivos son por ración y sirven para esta comida concreta; no son una recomendación de lo que deberías comer.</p>
    </div>
  )
}
