'use client'
import { ArrowLeftRight, CircleAlert, Link2, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import type { IngredientNutrition } from '@/lib/nutrition/compute'
import { resolveFood } from '@/lib/nutrition/catalog'
import { suggestSubstitutes, applySubstitution } from '@/lib/nutrition/substitutions'
import type { DietaryProfile } from '@/lib/nutrition/restrictions'
import { ALLERGEN_LABELS } from '@/lib/nutrition/restrictions'
import { formatQuantity, UNIT_LABELS } from '@/lib/nutrition/units'
import type { RecipeIngredient, Recipe } from '@/lib/nutrition/types'
import type { PantryStatus } from '@/lib/recipes/enrich'
import { Badge, Button, cx, IconButton, Sheet, Stepper } from '@/components/ui'
import { FoodPicker } from './FoodPicker'

const PANTRY_BADGE: Record<PantryStatus, { text: string; tone: 'ok' | 'warn' | 'neutral' | 'brand' }> = {
  tienes: { text: 'Lo tienes', tone: 'ok' },
  insuficiente: { text: 'No te llega', tone: 'warn' },
  falta: { text: 'Comprar', tone: 'neutral' },
  basico: { text: 'Básico', tone: 'brand' },
}

function stepFor(ing: RecipeIngredient) {
  if (ing.unit === 'g' || ing.unit === 'ml') return ing.quantity >= 100 ? 10 : 5
  if (ing.unit === 'unidad' || ing.unit === 'cda' || ing.unit === 'cdta') return 0.5
  return 1
}

export function IngredientList({
  recipe,
  lines,
  pantry,
  profile,
  onChange,
  showPantry,
}: {
  recipe: Recipe
  lines: IngredientNutrition[]
  pantry: Record<string, PantryStatus>
  profile: DietaryProfile
  onChange: (ingredients: RecipeIngredient[], note?: string) => void
  showPantry: boolean
}) {
  const [subFor, setSubFor] = useState<RecipeIngredient | null>(null)
  const [linkFor, setLinkFor] = useState<RecipeIngredient | null>(null)
  const [adding, setAdding] = useState(false)
  const byId = new Map(lines.map((l) => [l.id, l]))
  const set = (id: string, patch: Partial<RecipeIngredient>) => onChange(recipe.ingredients.map((i) => (i.id === id ? { ...i, ...patch } : i)))

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
        {recipe.ingredients.map((ing) => {
          const line = byId.get(ing.id)
          const food = resolveFood(ing.foodKey, ing.inlineFood)
          const p = pantry[ing.id]
          return (
            <li key={ing.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="font-semibold text-ink">{ing.name}</span>
                  {ing.optional && <Badge>opcional</Badge>}
                  {showPantry && p && <Badge tone={PANTRY_BADGE[p].tone}>{PANTRY_BADGE[p].text}</Badge>}
                </div>
                <div className="num mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                  {food ? (
                    <>
                      {food.name !== ing.name && <span className="truncate">{food.name}</span>}
                      {line?.grams != null && ing.unit !== 'g' && <span>≈ {Math.round(line.grams)} g</span>}
                      {line?.nutrients && (
                        <span>
                          {Math.round(line.nutrients.kcal ?? 0)} kcal · P {formatQuantity(line.nutrients.protein ?? 0)} g
                        </span>
                      )}
                      {line?.grams === null && <span className="text-warn">{line.quantityBasis}: indica el peso en gramos</span>}
                    </>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-warn">
                      <CircleAlert className="h-3.5 w-3.5" aria-hidden /> Sin datos nutricionales
                    </span>
                  )}
                  {food && food.allergens.length > 0 && <span>Alérgenos: {food.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}</span>}
                </div>
                {ing.note && <p className="mt-0.5 text-xs text-muted">{ing.note}</p>}
              </div>
              <div className="flex items-center gap-1.5">
                <Stepper label={`cantidad de ${ing.name}`} value={ing.quantity} step={stepFor(ing)} min={0} onChange={(v) => set(ing.id, { quantity: v })} suffix={ing.unit === 'g' || ing.unit === 'ml' ? ing.unit : undefined} />
                {ing.unit !== 'g' && ing.unit !== 'ml' && <span className="w-16 text-xs text-muted">{ing.unit === 'unidad' && food?.portions.unit ? food.portions.unit.name : UNIT_LABELS[ing.unit][ing.quantity === 1 ? 'one' : 'many']}</span>}
                {food ? (
                  <IconButton label={`Sustituir ${ing.name}`} onClick={() => setSubFor(ing)}>
                    <ArrowLeftRight className="h-[18px] w-[18px]" aria-hidden />
                  </IconButton>
                ) : (
                  <IconButton label={`Asociar ${ing.name} a un alimento con datos`} onClick={() => setLinkFor(ing)}>
                    <Link2 className="h-[18px] w-[18px]" aria-hidden />
                  </IconButton>
                )}
                <IconButton label={`Quitar ${ing.name}`} onClick={() => onChange(recipe.ingredients.filter((i) => i.id !== ing.id), `Quitado: ${ing.name}`)}>
                  <Trash2 className="h-[18px] w-[18px]" aria-hidden />
                </IconButton>
              </div>
            </li>
          )
        })}
      </ul>
      <Button variant="ghost" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setAdding(true)} className="self-start">
        Añadir ingrediente
      </Button>

      <FoodPicker
        open={adding}
        onClose={() => setAdding(false)}
        onPick={({ food, quantity, unit }) =>
          onChange(
            [
              ...recipe.ingredients,
              {
                id: `ing_${Date.now().toString(36)}`,
                foodKey: food.key,
                name: food.name,
                quantity,
                unit,
                role: food.group.startsWith('protein') || food.group === 'egg' ? 'protein' : food.group.startsWith('carb') ? 'carb' : food.group.startsWith('fat') ? 'fat' : food.group === 'vegetable' ? 'vegetable' : 'other',
                adjustable: true,
                inlineFood: food.source === 'usda_sr_legacy' ? null : food,
              },
            ],
            `Añadido: ${food.name}`,
          )
        }
      />
      <FoodPicker
        open={Boolean(linkFor)}
        title={`Asociar «${linkFor?.name ?? ''}»`}
        initialQuery={linkFor?.name ?? ''}
        onClose={() => setLinkFor(null)}
        onPick={({ food, quantity, unit }) => linkFor && set(linkFor.id, { foodKey: food.key, quantity, unit, inlineFood: food.source === 'usda_sr_legacy' ? null : food, adjustable: true })}
      />
      <SubstitutionSheet ing={subFor} recipe={recipe} profile={profile} onClose={() => setSubFor(null)} onApply={(ings, note) => onChange(ings, note)} />
    </div>
  )
}

function SubstitutionSheet({ ing, recipe, profile, onClose, onApply }: { ing: RecipeIngredient | null; recipe: Recipe; profile: DietaryProfile; onClose: () => void; onApply: (ings: RecipeIngredient[], note: string) => void }) {
  const options = ing ? suggestSubstitutes(ing, recipe.servings, profile, 8) : []
  const aiIdeas = ing ? recipe.substitutions.find((s) => s.ingredientId === ing.id)?.options ?? [] : []
  const sign = (n: number) => (n > 0 ? `+${n}` : String(n))
  return (
    <Sheet open={Boolean(ing)} onClose={onClose} title={`Sustituir ${ing?.name ?? ''}`}>
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted">Calculado con datos de USDA. La cantidad se ajusta para aproximar {ing && /protein|egg|legume/.test(resolveFood(ing.foodKey, ing.inlineFood)?.group ?? '') ? 'la proteína' : 'el aporte principal'}. Se excluyen alimentos incompatibles con tus alergias y dieta.</p>
        {options.length === 0 && <p className="rounded-xl bg-sunken p-3 text-sm">No hay sustitutos compatibles en el catálogo para este ingrediente.</p>}
        {options.map((o) => (
          <button
            key={o.food.key}
            type="button"
            className="flex flex-col gap-1.5 rounded-2xl border border-line p-3 text-left hover:border-brand/50"
            onClick={() => {
              if (!ing) return
              onApply(applySubstitution(recipe.ingredients, ing.id, o), `${ing.name} → ${o.food.name}`)
              onClose()
            }}
          >
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold">{o.food.name}</span>
              <span className="num text-sm font-semibold">{o.grams} g</span>
            </span>
            <span className={cx('num text-xs', o.equivalent ? 'text-ok' : 'text-muted')}>
              {o.equivalent ? 'Nutricionalmente parecido · ' : 'No equivalente · '}
              {sign(o.delta.kcal)} kcal · {sign(o.delta.protein)} g prot. · {sign(o.delta.carbs)} g hidr. · {sign(o.delta.fat)} g grasa por ración
            </span>
            {o.notes.map((n) => (
              <span key={n} className="text-xs text-muted">
                {n}
              </span>
            ))}
          </button>
        ))}
        {aiIdeas.length > 0 && (
          <div className="flex flex-col gap-1 border-t border-line pt-3">
            <p className="label-caps text-muted">Ideas del chef (IA)</p>
            {aiIdeas.map((o) => (
              <p key={o.name} className="text-sm">
                <span className="font-semibold">{o.name}</span> — {o.note}
              </p>
            ))}
            <p className="text-xs text-muted">Estas ideas no incluyen cálculo; si eliges una, añádela con «Añadir ingrediente» para recalcular.</p>
          </div>
        )}
      </div>
    </Sheet>
  )
}
