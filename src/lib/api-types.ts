// Tipos compartidos cliente/servidor de las filas de la base de datos.
import type { MealTargets, Recipe, Unit } from '@/lib/nutrition/types'

export interface ProfileRow {
  id: string
  display_name: string | null
  locale: 'es' | 'en'
  region: string
  profile_type: 'cotidiana' | 'equilibrada' | 'deporte' | 'batch' | 'economica' | 'rapida'
  cooking_level: 'principiante' | 'basico' | 'intermedio' | 'avanzado'
  usual_minutes: number | null
  budget: 'bajo' | 'medio' | 'alto' | null
  default_servings: number
  allergies: string[]
  intolerances: string[]
  diets: string[]
  dislikes: string[]
  favorites: string[]
  default_targets: MealTargets | null
  personalization_consent: boolean
}

export interface RecipeRow {
  id: string
  title: string
  data: Recipe
  servings: number
  kcal_per_serving: number | null
  protein_per_serving: number | null
  carbs_per_serving: number | null
  fat_per_serving: number | null
  targets: MealTargets | null
  source: 'ai' | 'manual' | 'adapted'
  parent_id: string | null
  version: number
  is_favorite: boolean
  image_url: string | null
  image_credit: string | null
  last_cooked_at: string | null
  created_at: string
  updated_at: string
}

export interface PantryRow {
  id: string
  name: string
  food_key: string | null
  quantity: number | null
  unit: Unit
  location: 'nevera' | 'congelador' | 'despensa'
  status: 'disponible' | 'agotado' | 'revisar'
  food_state: 'crudo' | 'cocinado' | 'congelado' | 'conserva' | null
  purchased_on: string | null
  expires_on: string | null
  date_kind: 'caducidad' | 'consumo_preferente' | null
  use_first: boolean
  low_threshold: number | null
  created_at: string
}

export interface ShoppingRowDb {
  id: string
  item_key: string | null
  name: string
  quantity: number | null
  unit: string
  category: string
  checked: boolean
  source: 'manual' | 'plan' | 'recipe'
  created_at: string
}

export interface MealPlanRow {
  id: string
  plan_date: string
  slot: 'desayuno' | 'media_manana' | 'comida' | 'merienda' | 'cena' | 'snack'
  position: number
  recipe_id: string
  servings: number
}

export interface CustomFoodRow {
  id: string
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number | null
  sugars: number | null
  sat_fat: number | null
  sodium_mg: number | null
  unit_grams: number | null
  allergens: string[]
  category: string
}

export interface PlanRow {
  id: string
  name: string
  description: string
  price_cents: number
  currency: string
  billing_interval: 'month' | 'year' | null
  stripe_price_id: string | null
  limits: Record<string, number>
  features: string[]
  sort: number
}
