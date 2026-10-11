import { Beef, CookingPot, Croissant, Drumstick, Egg, Fish, Leaf, Salad, Soup, Wheat } from 'lucide-react'
import type { Recipe } from '@/lib/nutrition/types'
import { getFood } from '@/lib/nutrition/catalog'
import { cx } from '@/components/ui'

// Portada ilustrada (sin fotos inventadas). Si hay una foto real con licencia
// (Unsplash configurado), se muestra con su atribución.
const PALETTES = [
  ['#4A2160', '#F4B03E'],
  ['#2E3B1F', '#C9D86A'],
  ['#6B1E1E', '#F28C6B'],
  ['#1E3A4A', '#F4B03E'],
  ['#3D2A12', '#E9A23B'],
  ['#2A1B3D', '#E6A0C4'],
]

function CoverIcon({ kind, className, color }: { kind: IconKey; className: string; color: string }) {
  const props = { className, style: { color }, strokeWidth: 1.6 }
  switch (kind) {
    case 'soup':
      return <Soup {...props} />
    case 'salad':
      return <Salad {...props} />
    case 'bakery':
      return <Croissant {...props} />
    case 'fish':
      return <Fish {...props} />
    case 'egg':
      return <Egg {...props} />
    case 'poultry':
      return <Drumstick {...props} />
    case 'meat':
      return <Beef {...props} />
    case 'veg':
      return <Leaf {...props} />
    case 'grain':
      return <Wheat {...props} />
    default:
      return <CookingPot {...props} />
  }
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

type IconKey = 'soup' | 'salad' | 'bakery' | 'fish' | 'egg' | 'poultry' | 'meat' | 'veg' | 'grain' | 'pot'

function iconFor(recipe: Pick<Recipe, 'ingredients' | 'title'>): IconKey {
  const main = recipe.ingredients.find((i) => i.role === 'protein') ?? recipe.ingredients[0]
  const food = getFood(main?.foodKey)
  const t = recipe.title.toLowerCase()
  if (/sopa|crema|caldo|guiso|potaje/.test(t)) return 'soup'
  if (/ensalada|bowl/.test(t)) return 'salad'
  if (/tortita|pancake|bizcocho|pan /.test(t)) return 'bakery'
  if (food?.animal === 'fish') return 'fish'
  if (food?.group === 'egg') return 'egg'
  if (food?.key.includes('pollo') || food?.key.includes('pavo')) return 'poultry'
  if (food?.animal === 'meat') return 'meat'
  if (food?.group === 'protein_veg' || food?.group === 'legume') return 'veg'
  if (/pasta|espagueti|arroz|risotto|pizza/.test(t)) return 'grain'
  return 'pot'
}

export function RecipeCover({ recipe, imageUrl, imageCredit, className, size = 'md' }: { recipe: Pick<Recipe, 'ingredients' | 'title'>; imageUrl?: string | null; imageCredit?: string | null; className?: string; size?: 'sm' | 'md' | 'lg' }) {
  if (imageUrl) {
    return (
      <figure className={cx('relative overflow-hidden bg-sunken', className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageUrl} alt={`Foto de referencia: ${recipe.title}`} className="h-full w-full object-cover" loading="lazy" />
        {imageCredit && <figcaption className="absolute bottom-1 right-2 rounded bg-black/50 px-1.5 text-[10px] text-white">{imageCredit}</figcaption>}
      </figure>
    )
  }
  const [bg, fg] = PALETTES[hash(recipe.title) % PALETTES.length]
  const kind = iconFor(recipe)
  const iconSize = size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-20 w-20' : 'h-12 w-12'
  return (
    <div className={cx('relative flex items-center justify-center overflow-hidden', className)} style={{ background: `radial-gradient(120% 90% at 85% 10%, ${fg}55 0%, transparent 55%), ${bg}` }} aria-hidden>
      <div className="absolute -bottom-6 -left-6 h-24 w-24 rounded-full opacity-25" style={{ background: fg }} />
      <div className="absolute right-4 top-3 h-3 w-3 rounded-full opacity-60" style={{ background: fg }} />
      <CoverIcon kind={kind} className={iconSize} color={fg} />
    </div>
  )
}
