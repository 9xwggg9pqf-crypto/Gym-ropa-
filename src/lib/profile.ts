import type { ProfileRow } from '@/lib/api-types'
import type { Diet, DietaryProfile } from '@/lib/nutrition/restrictions'
import type { Allergen } from '@/lib/nutrition/types'

export function toDietaryProfileClient(p: Pick<ProfileRow, 'allergies' | 'intolerances' | 'diets' | 'dislikes'> | null | undefined): DietaryProfile {
  return {
    allergies: (p?.allergies ?? []) as Allergen[],
    intolerances: p?.intolerances ?? [],
    diets: (p?.diets ?? []) as Diet[],
    dislikes: p?.dislikes ?? [],
  }
}
