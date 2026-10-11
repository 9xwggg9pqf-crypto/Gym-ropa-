'use client'
import { Check, Scale, Target, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { optimizeAlternatives, NUTRIENT_LABEL, type OptimizationResult } from '@/lib/nutrition/optimize'
import { getFood } from '@/lib/nutrition/catalog'
import { isFoodAllowed, type DietaryProfile } from '@/lib/nutrition/restrictions'
import type { MealTargets, OptimizationPriority, Recipe, RecipeIngredient } from '@/lib/nutrition/types'
import { hasTargets } from '@/lib/recipes/enrich'
import { Badge, Button, cx, Tabs } from '@/components/ui'
import { MacroPills } from './NutritionLabel'
import { TargetsForm } from './TargetsForm'

const PRIORITY_LABEL: Record<OptimizationPriority, string> = { balanced: 'Equilibrio', calories: 'Priorizar calorías', protein: 'Priorizar proteína' }
const KIND = { approx: '≈', min: '≥', max: '≤' }
const UNIT = { kcal: 'kcal', protein: 'g', carbs: 'g', fat: 'g' }
const fmt = (v: number | null) => (v === null ? '—' : new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(v))

export function TargetPanel({ recipe, targets, onTargets, onApply, profile }: { recipe: Recipe; targets: MealTargets; onTargets: (t: MealTargets) => void; onApply: (ings: RecipeIngredient[], note: string) => void; profile: DietaryProfile }) {
  const [editing, setEditing] = useState(!hasTargets(targets))
  const [result, setResult] = useState<ReturnType<typeof optimizeAlternatives> | null>(null)
  const [tab, setTab] = useState<OptimizationPriority>('balanced')

  function run() {
    if (!hasTargets(targets)) return
    const r = optimizeAlternatives(recipe.ingredients, recipe.servings, targets, { isAllowed: (f) => isFoodAllowed(f, profile) })
    setResult(r)
    setTab('balanced')
    setEditing(false)
  }

  const current: OptimizationResult | null = result ? result[tab] : null

  return (
    <section aria-labelledby="objetivos" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="objetivos" className="flex items-center gap-2 font-display text-[15px] font-semibold">
          <Target className="h-5 w-5 text-brand-ink" aria-hidden /> Objetivos de esta comida
        </h3>
        {!editing && (
          <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
            {hasTargets(targets) ? 'Cambiar objetivos' : 'Poner objetivos'}
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <TargetsForm value={targets} onChange={onTargets} />
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Scale className="h-4 w-4" aria-hidden />} onClick={run} disabled={!hasTargets(targets)}>
              Ajustar cantidades
            </Button>
            {hasTargets(targets) && (
              <Button variant="ghost" onClick={() => onTargets({})}>
                Quitar objetivos
              </Button>
            )}
          </div>
        </>
      ) : hasTargets(targets) ? (
        <div className="flex flex-wrap items-center gap-2">
          {(Object.keys(UNIT) as (keyof MealTargets)[]).map((k) =>
            targets[k] ? (
              <Badge key={k} tone="brand">
                {NUTRIENT_LABEL[k]} {KIND[targets[k]!.kind]} {targets[k]!.value} {UNIT[k]}
                {targets[k]!.strict ? ' (estricto)' : ''}
              </Badge>
            ) : null,
          )}
          <Button size="sm" variant="outline" icon={<Scale className="h-4 w-4" aria-hidden />} onClick={run}>
            Ajustar cantidades
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted">Sin objetivos: la receta se muestra tal cual. Puedes fijar calorías, proteína o cualquier combinación.</p>
      )}

      {result && current && (
        <div className="flex flex-col gap-3 border-t border-line pt-4">
          {result.distinct ? (
            <Tabs label="Estrategia de ajuste" value={tab} onChange={setTab} items={(['balanced', 'calories', 'protein'] as const).map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))} />
          ) : (
            <p className="text-xs text-muted">Las tres estrategias (equilibrio, calorías, proteína) dan el mismo resultado.</p>
          )}
          <div className={cx('flex items-start gap-2 rounded-xl p-3 text-sm', current.status === 'met' ? 'bg-ok/10' : 'bg-warn/10')}>
            {current.status === 'met' ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warn" aria-hidden />}
            <div className="flex flex-col gap-1">
              <p className="font-semibold">{current.status === 'met' ? 'Objetivos alcanzados (valores estimados)' : current.status === 'partial' ? 'Se acerca, pero no cumple todo a la vez' : 'No se puede cumplir de forma razonable'}</p>
              {current.messages.map((m) => (
                <p key={m} className="text-muted">
                  {m}
                </p>
              ))}
            </div>
          </div>
          <table className="num w-full text-sm">
            <caption className="sr-only">Objetivo frente a resultado, por ración</caption>
            <thead>
              <tr className="text-left text-xs text-muted">
                <th className="py-1 font-medium">Por ración</th>
                <th className="py-1 font-medium">Objetivo</th>
                <th className="py-1 font-medium">Resultado</th>
                <th className="py-1 font-medium">
                  <span className="sr-only">Estado</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {current.reports.map((r) => (
                <tr key={r.nutrient} className="border-t border-line">
                  <td className="py-1.5 capitalize">{NUTRIENT_LABEL[r.nutrient]}</td>
                  <td className="py-1.5">
                    {KIND[r.target.kind]} {r.target.value} {UNIT[r.nutrient]}
                  </td>
                  <td className="py-1.5 font-semibold">
                    {fmt(r.achieved)} {UNIT[r.nutrient]}
                  </td>
                  <td className="py-1.5">{r.met ? <Badge tone="ok">cumple</Badge> : <Badge tone="warn">no cumple</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {current.changes.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p className="label-caps text-muted">Cambios propuestos (receta completa)</p>
              <ul className="num flex flex-col gap-0.5 text-sm">
                {current.changes.map((c) => (
                  <li key={c.id}>
                    <span className="font-medium">{c.name}</span>: {c.fromG} g → <span className="font-semibold">{c.toG} g</span>{' '}
                    <span className={c.toG > c.fromG ? 'text-ok' : 'text-protein'}>
                      ({c.toG > c.fromG ? '+' : ''}
                      {c.toG - c.fromG} g)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-muted">No hace falta cambiar cantidades.</p>
          )}
          {current.suggestions.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="label-caps text-muted">Para llegar, podrías añadir</p>
              {current.suggestions.map((s) => (
                <div key={s.foodKey} className="flex items-center justify-between gap-2 rounded-xl bg-sunken px-3 py-2 text-sm">
                  <span>
                    <span className="font-semibold">{s.name}</span> <span className="text-xs text-muted">({s.reason})</span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const f = getFood(s.foodKey)
                      if (!f) return
                      onApply([...recipe.ingredients, { id: `ing_${Date.now().toString(36)}`, foodKey: f.key, name: f.name, quantity: 50, unit: 'g', role: 'protein', adjustable: true, minG: 0, maxG: 400 }], `Añadido: ${f.name}. Vuelve a ajustar para recalcular.`)
                      setResult(null)
                    }}
                  >
                    Añadir
                  </Button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1 rounded-xl bg-sunken p-3">
            <p className="text-xs text-muted">Resultado por ración con estas cantidades:</p>
            <MacroPills n={current.nutrition.perServing} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                onApply(current.ingredients, `Cantidades ajustadas (${PRIORITY_LABEL[tab].toLowerCase()})`)
                setResult(null)
              }}
              disabled={current.changes.length === 0}
            >
              Aplicar estas cantidades
            </Button>
            <Button variant="ghost" onClick={() => setResult(null)}>
              Descartar
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
