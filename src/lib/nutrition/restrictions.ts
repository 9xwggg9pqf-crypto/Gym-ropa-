import { FOODS, normalize, resolveFood } from './catalog'
import type { Allergen, Food, RecipeIngredient } from './types'
import { ALLERGENS } from './types'

export const ALLERGEN_LABELS: Record<Allergen, string> = {
  gluten: 'Gluten',
  crustaceos: 'Crustáceos',
  huevo: 'Huevo',
  pescado: 'Pescado',
  cacahuete: 'Cacahuete',
  soja: 'Soja',
  leche: 'Leche',
  frutos_cascara: 'Frutos de cáscara',
  apio: 'Apio',
  mostaza: 'Mostaza',
  sesamo: 'Sésamo',
  sulfitos: 'Sulfitos',
  altramuces: 'Altramuces',
  moluscos: 'Moluscos',
}

export const DIETS = ['vegetariana', 'vegana', 'pescetariana', 'sin_gluten', 'sin_lactosa'] as const
export type Diet = (typeof DIETS)[number]
export const DIET_LABELS: Record<Diet, string> = {
  vegetariana: 'Vegetariana',
  vegana: 'Vegana',
  pescetariana: 'Pescetariana',
  sin_gluten: 'Sin gluten',
  sin_lactosa: 'Sin lactosa',
}

export const INTOLERANCES = ['lactosa', 'gluten', 'fructosa', 'histamina'] as const
export type Intolerance = (typeof INTOLERANCES)[number]

export interface DietaryProfile {
  allergies: Allergen[]
  intolerances: string[]
  diets: Diet[]
  /** Alimentos que no gustan (claves de catálogo o texto libre). */
  dislikes: string[]
}

export const EMPTY_PROFILE: DietaryProfile = { allergies: [], intolerances: [], diets: [], dislikes: [] }

// Palabras clave para detectar alérgenos en ingredientes SIN correspondencia en el catálogo.
// Es una red de seguridad, no una garantía: un ingrediente sin datos siempre se marca para revisar.
const ALLERGEN_KEYWORDS: Record<Allergen, string[]> = {
  gluten: ['trigo', 'harina', 'pan', 'pasta', 'espagueti', 'macarron', 'cuscus', 'cebada', 'centeno', 'avena', 'seitan', 'galleta', 'rebozado', 'pan rallado', 'bulgur', 'espelta', 'cerveza', 'fideo', 'lasana', 'pizza', 'masa'],
  crustaceos: ['gamba', 'langostino', 'cangrejo', 'bogavante', 'langosta', 'cigala', 'camaron', 'carabinero', 'necora'],
  huevo: ['huevo', 'clara', 'yema', 'mayonesa', 'merengue', 'alioli'],
  pescado: ['pescado', 'atun', 'salmon', 'bacalao', 'merluza', 'anchoa', 'boqueron', 'sardina', 'caballa', 'dorada', 'lubina', 'rape', 'trucha', 'surimi', 'worcestershire', 'perrins'],
  cacahuete: ['cacahuete', 'mani'],
  soja: ['soja', 'tofu', 'tempeh', 'edamame', 'miso', 'shoyu', 'tamari'],
  leche: ['leche', 'queso', 'yogur', 'nata', 'mantequilla', 'crema de leche', 'requeson', 'kefir', 'bechamel', 'mozzarella', 'parmesano', 'suero', 'whey', 'lactosa', 'ghee'],
  frutos_cascara: ['almendra', 'nuez', 'nueces', 'avellana', 'anacardo', 'pistacho', 'pecana', 'macadamia', 'pinon', 'castana de caju', 'praline'],
  apio: ['apio'],
  mostaza: ['mostaza'],
  sesamo: ['sesamo', 'tahini', 'tahin', 'ajonjoli', 'hummus'],
  sulfitos: ['vino', 'vinagre', 'sulfito'],
  altramuces: ['altramuz', 'altramuces', 'lupino'],
  moluscos: ['calamar', 'sepia', 'pulpo', 'mejillon', 'almeja', 'berberecho', 'ostra', 'vieira', 'chipiron', 'navaja'],
}

const MEAT_KEYWORDS = ['pollo', 'pavo', 'ternera', 'cerdo', 'cordero', 'carne', 'jamon', 'bacon', 'chorizo', 'salchicha', 'panceta', 'lomo', 'caldo de pollo', 'caldo de carne', 'gelatina']
const FISH_KEYWORDS = [...ALLERGEN_KEYWORDS.pescado, ...ALLERGEN_KEYWORDS.crustaceos, ...ALLERGEN_KEYWORDS.moluscos]

export function detectAllergensByName(name: string): Allergen[] {
  const n = normalize(name)
  return ALLERGENS.filter((a) => ALLERGEN_KEYWORDS[a].some((k) => n.includes(k)))
}

/** Alérgenos que el usuario debe evitar por alergia o intolerancia declarada. */
export function avoidedAllergens(profile: DietaryProfile): { allergen: Allergen; reason: 'alergia' | 'intolerancia' | 'dieta' }[] {
  const out: { allergen: Allergen; reason: 'alergia' | 'intolerancia' | 'dieta' }[] = profile.allergies.map((a) => ({ allergen: a, reason: 'alergia' as const }))
  const add = (a: Allergen, reason: 'intolerancia' | 'dieta') => {
    if (!out.some((o) => o.allergen === a)) out.push({ allergen: a, reason })
  }
  if (profile.intolerances.includes('lactosa')) add('leche', 'intolerancia')
  if (profile.intolerances.includes('gluten')) add('gluten', 'intolerancia')
  if (profile.diets.includes('sin_gluten')) add('gluten', 'dieta')
  if (profile.diets.includes('sin_lactosa')) add('leche', 'dieta')
  return out
}

export type IssueSeverity = 'bloqueo' | 'aviso' | 'revisar'

export interface DietaryIssue {
  ingredientId: string
  ingredientName: string
  severity: IssueSeverity
  message: string
  allergen?: Allergen
}

function dietConflict(food: Food | undefined, name: string, diets: Diet[]): string | null {
  const n = normalize(name)
  const isMeat = food ? food.animal === 'meat' : MEAT_KEYWORDS.some((k) => n.includes(k))
  const isFish = food ? food.animal === 'fish' : FISH_KEYWORDS.some((k) => n.includes(k))
  const isAnimalProduct = food ? food.animal === 'dairy' || food.animal === 'egg' || food.animal === 'honey' : detectAllergensByName(name).some((a) => a === 'leche' || a === 'huevo') || n.includes('miel')
  if (diets.includes('vegana') && (isMeat || isFish || isAnimalProduct)) return 'No es apto para una dieta vegana'
  if (diets.includes('vegetariana') && (isMeat || isFish)) return 'No es apto para una dieta vegetariana'
  if (diets.includes('pescetariana') && isMeat) return 'No es apto para una dieta pescetariana'
  return null
}

/**
 * Revisa una receta frente al perfil del usuario. Nunca afirma que una receta
 * esté libre de un alérgeno: sólo informa de lo que puede identificar.
 */
export function checkIngredients(ingredients: RecipeIngredient[], profile: DietaryProfile): DietaryIssue[] {
  const issues: DietaryIssue[] = []
  const avoided = avoidedAllergens(profile)
  const dislikes = profile.dislikes.map(normalize).filter(Boolean)

  for (const ing of ingredients) {
    const food = resolveFood(ing.foodKey, ing.inlineFood)
    // Los alimentos de la API de FDC o introducidos a mano no tienen alérgenos catalogados por nosotros:
    // se combinan con la detección por nombre y se pide revisión.
    const curated = food?.source === 'usda_sr_legacy'
    const byName = curated ? [] : detectAllergensByName(`${ing.name} ${food?.name ?? ''}`)
    const definite: Allergen[] = [...new Set([...(food?.allergens ?? []), ...byName])]
    const possible: Allergen[] = food ? food.mayContain : []

    for (const { allergen, reason } of avoided) {
      if (definite.includes(allergen)) {
        issues.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          allergen,
          severity: reason === 'alergia' ? 'bloqueo' : 'aviso',
          message: `Contiene ${ALLERGEN_LABELS[allergen].toLowerCase()} (${reason}).`,
        })
      } else if (possible.includes(allergen)) {
        issues.push({
          ingredientId: ing.id,
          ingredientName: ing.name,
          allergen,
          severity: reason === 'alergia' ? 'bloqueo' : 'revisar',
          message: `Puede contener ${ALLERGEN_LABELS[allergen].toLowerCase()} según la marca: revisa la etiqueta o elige una alternativa.`,
        })
      }
    }
    if (!curated && avoided.length > 0) {
      issues.push({
        ingredientId: ing.id,
        ingredientName: ing.name,
        severity: 'revisar',
        message: food
          ? 'Los alérgenos de este alimento no están verificados por SNACKEATS: revisa la etiqueta.'
          : 'Ingrediente sin datos de alérgenos en nuestra base: compruébalo tú antes de cocinar.',
      })
    }
    const diet = dietConflict(food, ing.name, profile.diets)
    if (diet) issues.push({ ingredientId: ing.id, ingredientName: ing.name, severity: 'bloqueo', message: diet })
    const n = normalize(ing.name)
    if (dislikes.some((d) => d === ing.foodKey || (d.length > 2 && n.includes(d)))) {
      issues.push({ ingredientId: ing.id, ingredientName: ing.name, severity: 'aviso', message: 'Está en tu lista de alimentos que no te gustan.' })
    }
  }
  return issues
}

export function isFoodAllowed(food: Food, profile: DietaryProfile): boolean {
  const avoided = avoidedAllergens(profile)
  if (avoided.some(({ allergen }) => food.allergens.includes(allergen) || food.mayContain.includes(allergen))) return false
  if (dietConflict(food, food.name, profile.diets)) return false
  return true
}

/** Alérgenos (seguros y posibles) presentes en la receta, para la ficha de la receta. */
export function recipeAllergens(ingredients: RecipeIngredient[]): { contains: Allergen[]; mayContain: Allergen[]; unknown: string[] } {
  const contains = new Set<Allergen>()
  const may = new Set<Allergen>()
  const unknown: string[] = []
  for (const ing of ingredients) {
    const food = resolveFood(ing.foodKey, ing.inlineFood)
    if (!food) {
      detectAllergensByName(ing.name).forEach((a) => contains.add(a))
      unknown.push(ing.name)
      continue
    }
    food.allergens.forEach((a) => contains.add(a))
    food.mayContain.forEach((a) => may.add(a))
  }
  for (const a of contains) may.delete(a)
  return { contains: [...contains], mayContain: [...may], unknown }
}

export function foodsMatchingProfile(profile: DietaryProfile): Food[] {
  return FOODS.filter((f) => isFoodAllowed(f, profile))
}
