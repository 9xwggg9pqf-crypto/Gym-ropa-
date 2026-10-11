'use client'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getRecipe } from '@/lib/client-data'
import type { Recipe } from '@/lib/nutrition/types'
import { CookMode } from '@/components/cook/CookMode'
import { ErrorBox, Spinner } from '@/components/ui'

export default function SavedCookPage() {
  const { id } = useParams<{ id: string }>()
  const [recipe, setRecipe] = useState<Recipe | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    getRecipe(id).then((r) => (r.ok ? setRecipe(r.data.data) : setError(r.error)))
  }, [id])
  if (error) return <ErrorBox message={error} />
  if (!recipe) return <Spinner />
  return <CookMode recipe={recipe} exitHref={`/recetas/${id}`} />
}
