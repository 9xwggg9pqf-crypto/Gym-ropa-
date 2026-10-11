import { Clock, Heart } from 'lucide-react'
import Link from 'next/link'
import type { Recipe } from '@/lib/nutrition/types'
import { RecipeCover } from './RecipeCover'
import { cx } from '@/components/ui'

export function RecipeCard({ href, recipe, kcal, protein, favorite, imageUrl, badge, onClick }: { href?: string; recipe: Recipe; kcal: number | null; protein: number | null; favorite?: boolean; imageUrl?: string | null; badge?: string; onClick?: () => void }) {
  const minutes = recipe.prepMinutes + recipe.cookMinutes
  const body = (
    <>
      <RecipeCover recipe={recipe} imageUrl={imageUrl} className="aspect-[16/10] w-full" />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-2 font-semibold leading-snug text-ink">{recipe.title}</h3>
          {favorite && <Heart className="mt-0.5 h-4 w-4 shrink-0 fill-protein text-protein" aria-label="Favorita" />}
        </div>
        <div className="num mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {minutes} min
          </span>
          <span className="font-semibold text-ink">{kcal === null ? '—' : Math.round(kcal)} kcal</span>
          <span className="font-semibold text-protein">{protein === null ? '—' : Math.round(protein)} g prot.</span>
        </div>
        {badge && <span className="label-caps text-brand-ink">{badge}</span>}
      </div>
    </>
  )
  const cls = cx('group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface text-left transition hover:-translate-y-0.5 hover:shadow-lift')
  if (href) return <Link href={href} className={cls}>{body}</Link>
  return (
    <button type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}
