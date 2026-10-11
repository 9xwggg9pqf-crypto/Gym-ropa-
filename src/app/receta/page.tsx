'use client'
import { ArrowLeft, Scale } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useMemo, useState, useEffect } from 'react'
import { drafts, type GenerationResult } from '@/lib/drafts'
import { optimizeAlternatives } from '@/lib/nutrition/optimize'
import { isFoodAllowed } from '@/lib/nutrition/restrictions'
import { toDietaryProfileClient } from '@/lib/profile'
import { hasTargets } from '@/lib/recipes/enrich'
import type { MealTargets, Recipe } from '@/lib/nutrition/types'
import { useSession } from '@/lib/session'
import { RecipeView } from '@/components/recipe/RecipeView'
import { EmptyState, LinkButton, Spinner } from '@/components/ui'

function DraftInner() {
  const params = useSearchParams()
  const i = Number(params.get('i') ?? 0)
  const { profile, loading } = useSession()
  const [result, setResult] = useState<GenerationResult | null | undefined>(undefined)
  useEffect(() => setResult(drafts.getResults()), [])
  const draft = result?.recipes[i]

  // Si hay objetivos, la receta se abre ya ajustada (estrategia de equilibrio) y se explica qué ha cambiado.
  const prepared = useMemo(() => {
    if (!draft) return null
    if ((draft.recipe as Recipe & { _adjusted?: boolean })._adjusted || !hasTargets(draft.targets)) return { recipe: draft.recipe, opt: null }
    const dietary = toDietaryProfileClient(profile)
    const opt = optimizeAlternatives(draft.recipe.ingredients, draft.recipe.servings, draft.targets, { isAllowed: (f) => isFoodAllowed(f, dietary) }).balanced
    return { recipe: { ...draft.recipe, ingredients: opt.ingredients }, opt }
  }, [draft, profile])

  const persist = useCallback(
    (recipe: Recipe, targets: MealTargets) => {
      const r = drafts.getResults()
      if (!r || !r.recipes[i]) return
      r.recipes[i] = { ...r.recipes[i], recipe: { ...recipe, _adjusted: true } as Recipe, targets }
      drafts.setResults(r)
    },
    [i],
  )

  if (result === undefined || loading) return <Spinner />
  if (!draft || !prepared) {
    return (
      <EmptyState icon={<Scale className="h-6 w-6" aria-hidden />} title="Esta receta ya no está disponible" action={<LinkButton href="/crear" variant="primary">Crear una receta</LinkButton>}>
        Las recetas generadas se guardan en esta pestaña hasta que las guardas en tu cuenta.
      </EmptyState>
    )
  }
  const opt = prepared.opt
  return (
    <div className="flex flex-col gap-4">
      <Link href="/crear?ver=1" className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver a las propuestas
      </Link>
      <RecipeView
        initial={prepared.recipe}
        initialTargets={draft.targets}
        unmatched={draft.unmatched}
        cookHref={`/receta/cocinar?i=${i}`}
        onDraftChange={persist}
        notice={
          opt && (
            <div className={opt.status === 'met' ? 'rounded-2xl bg-ok/10 p-4 text-sm' : 'rounded-2xl bg-warn/10 p-4 text-sm'}>
              <p className="font-semibold">{opt.status === 'met' ? 'Cantidades ajustadas a tus objetivos' : 'Hemos ajustado las cantidades, pero no se cumple todo'}</p>
              {opt.changes.length > 0 && (
                <p className="num mt-1 text-muted">
                  {opt.changes.map((c) => `${c.name}: ${c.fromG} → ${c.toG} g`).join(' · ')}
                </p>
              )}
              {opt.messages.map((m) => (
                <p key={m} className="mt-1 text-muted">
                  {m}
                </p>
              ))}
              <p className="mt-1 text-xs text-muted">Puedes probar otras estrategias (priorizar calorías o proteína) en «Objetivos de esta comida».</p>
            </div>
          )
        }
      />
    </div>
  )
}

export default function DraftRecipePage() {
  return (
    <Suspense>
      <DraftInner />
    </Suspense>
  )
}
