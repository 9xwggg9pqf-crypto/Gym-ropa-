'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { drafts } from '@/lib/drafts'
import type { Recipe } from '@/lib/nutrition/types'
import { CookMode } from '@/components/cook/CookMode'
import { EmptyState, LinkButton } from '@/components/ui'
import { ChefHat } from 'lucide-react'

function Inner() {
  const i = Number(useSearchParams().get('i') ?? 0)
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined)
  useEffect(() => setRecipe(drafts.getResults()?.recipes[i]?.recipe ?? null), [i])
  if (recipe === undefined) return null
  if (!recipe) return <EmptyState icon={<ChefHat className="h-6 w-6" aria-hidden />} title="Receta no disponible" action={<LinkButton href="/crear">Crear receta</LinkButton>} />
  return <CookMode recipe={recipe} exitHref={`/receta?i=${i}`} />
}

export default function DraftCookPage() {
  return (
    <Suspense>
      <Inner />
    </Suspense>
  )
}
