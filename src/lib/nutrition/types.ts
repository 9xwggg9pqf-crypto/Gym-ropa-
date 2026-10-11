// Tipos centrales del dominio nutricional de SNACKEATS.

export const ALLERGENS = [
  'gluten',
  'crustaceos',
  'huevo',
  'pescado',
  'cacahuete',
  'soja',
  'leche',
  'frutos_cascara',
  'apio',
  'mostaza',
  'sesamo',
  'sulfitos',
  'altramuces',
  'moluscos',
] as const
export type Allergen = (typeof ALLERGENS)[number]

export type FoodState = 'raw' | 'cooked' | 'dry' | 'canned' | 'prepared'
export type AnimalOrigin = 'meat' | 'fish' | 'dairy' | 'egg' | 'honey' | null

export type FoodGroup =
  | 'protein_meat'
  | 'protein_fish'
  | 'protein_veg'
  | 'protein_powder'
  | 'egg'
  | 'dairy_liquid'
  | 'yogurt'
  | 'cheese'
  | 'legume'
  | 'carb_grain'
  | 'carb_tuber'
  | 'flour'
  | 'bakery'
  | 'vegetable'
  | 'fruit'
  | 'fat_fruit'
  | 'nut_seed'
  | 'fat_oil'
  | 'fat_butter'
  | 'sweetener'
  | 'sauce'
  | 'condiment'
  | 'broth'
  | 'spice'
  | 'herb'
  | 'other'

export type ShoppingCategory =
  | 'carnes'
  | 'pescados'
  | 'huevos_lacteos'
  | 'bebidas_vegetales'
  | 'frutas_verduras'
  | 'cereales_legumbres'
  | 'panaderia'
  | 'despensa'
  | 'salsas'
  | 'especias'
  | 'frutos_secos'
  | 'congelados'
  | 'otros'

/** Valores por 100 g. `null` significa "dato no disponible", nunca cero. */
export interface Nutrients {
  kcal: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  fiber: number | null
  sugars: number | null
  satFat: number | null
  sodiumMg: number | null
}
export type NutrientKey = keyof Nutrients
export const NUTRIENT_KEYS: NutrientKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber', 'sugars', 'satFat', 'sodiumMg']

export type FoodSource = 'usda_sr_legacy' | 'usda_fdc_api' | 'custom_label'

export interface Food {
  key: string
  fdcId: number | null
  name: string
  aliases: string[]
  usdaDescription: string | null
  category: ShoppingCategory
  group: FoodGroup
  state: FoodState
  allergens: Allergen[]
  mayContain: Allergen[]
  animal: AnimalOrigin
  per100g: Nutrients
  portions: {
    unit: { name: string; grams: number | null; usda?: string } | null
    tbspG: number | null
    tspG: number | null
    cupG: number | null
    densityGPerMl: number | null
  }
  source: FoodSource
  /** Productos comerciales cuya composición varía según la marca. */
  brandVariable?: boolean
}

export const UNITS = ['g', 'kg', 'ml', 'l', 'unidad', 'cda', 'cdta', 'taza', 'pizca'] as const
export type Unit = (typeof UNITS)[number]

export type IngredientRole = 'protein' | 'carb' | 'fat' | 'vegetable' | 'dairy' | 'sauce' | 'seasoning' | 'fruit' | 'other'

export interface RecipeIngredient {
  id: string
  /** Clave del catálogo (o `custom:<uuid>` / `fdc:<id>`). null = sin correspondencia. */
  foodKey: string | null
  /** Nombre visible (en el idioma del usuario). */
  name: string
  quantity: number
  unit: Unit
  role: IngredientRole
  /** Si el optimizador puede cambiar su cantidad. */
  adjustable: boolean
  /** Límites en gramos para conservar la identidad del plato (opcionales). */
  minG?: number | null
  maxG?: number | null
  optional?: boolean
  note?: string | null
  /** Alimento embebido (personalizado o de la API de FDC) para recetas autónomas. */
  inlineFood?: Food | null
}

export interface RecipeStep {
  text: string
  timerSeconds?: number | null
  temperatureC?: number | null
}

export interface SuggestedSubstitution {
  ingredientId: string
  options: { foodKey: string | null; name: string; note: string }[]
}

export interface Recipe {
  title: string
  description: string
  servings: number
  prepMinutes: number
  cookMinutes: number
  difficulty: 'facil' | 'media' | 'dificil'
  utensils: string[]
  ingredients: RecipeIngredient[]
  steps: RecipeStep[]
  tips: string[]
  substitutions: SuggestedSubstitution[]
  safetyNotes: string[]
  tags: string[]
}

export type TargetKind = 'approx' | 'min' | 'max'
export interface MacroTarget {
  value: number
  kind: TargetKind
  /** Estricto = límite que no debe incumplirse; flexible = preferencia. */
  strict?: boolean
}
/** Objetivos POR RACIÓN. Todos opcionales. */
export interface MealTargets {
  kcal?: MacroTarget | null
  protein?: MacroTarget | null
  carbs?: MacroTarget | null
  fat?: MacroTarget | null
}
export type OptimizationPriority = 'calories' | 'protein' | 'balanced'
