import * as z from 'zod/v4'
import { ALLERGENS, UNITS } from '@/lib/nutrition/types'

const Nutr = z.number().min(0).max(100000).nullable()

export const FoodSchema = z.object({
  key: z.string().max(120),
  fdcId: z.number().int().nullable(),
  name: z.string().min(1).max(160),
  aliases: z.array(z.string().max(80)).max(20),
  usdaDescription: z.string().max(300).nullable(),
  category: z.string().max(40),
  group: z.string().max(40),
  state: z.enum(['raw', 'cooked', 'dry', 'canned', 'prepared']),
  allergens: z.array(z.enum(ALLERGENS)).max(14),
  mayContain: z.array(z.enum(ALLERGENS)).max(14),
  animal: z.enum(['meat', 'fish', 'dairy', 'egg', 'honey']).nullable(),
  per100g: z.object({ kcal: Nutr, protein: Nutr, carbs: Nutr, fat: Nutr, fiber: Nutr, sugars: Nutr, satFat: Nutr, sodiumMg: Nutr }),
  portions: z.object({
    unit: z.object({ name: z.string().max(60), grams: z.number().positive().max(10000).nullable(), usda: z.string().max(120).optional() }).nullable(),
    tbspG: z.number().positive().max(1000).nullable(),
    tspG: z.number().positive().max(1000).nullable(),
    cupG: z.number().positive().max(5000).nullable(),
    densityGPerMl: z.number().positive().max(5).nullable(),
  }),
  source: z.enum(['usda_sr_legacy', 'usda_fdc_api', 'custom_label']),
  brandVariable: z.boolean().optional(),
})

export const IngredientSchema = z.object({
  id: z.string().min(1).max(80),
  foodKey: z.string().max(120).nullable(),
  name: z.string().min(1).max(120),
  quantity: z.number().min(0).max(100000),
  unit: z.enum(UNITS),
  role: z.enum(['protein', 'carb', 'fat', 'vegetable', 'dairy', 'sauce', 'seasoning', 'fruit', 'other']),
  adjustable: z.boolean(),
  minG: z.number().min(0).max(100000).nullable().optional(),
  maxG: z.number().min(0).max(100000).nullable().optional(),
  optional: z.boolean().optional(),
  note: z.string().max(300).nullable().optional(),
  inlineFood: FoodSchema.nullable().optional(),
})

export const RecipeSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(1000),
  servings: z.number().int().min(1).max(50),
  prepMinutes: z.number().int().min(0).max(1440),
  cookMinutes: z.number().int().min(0).max(2880),
  difficulty: z.enum(['facil', 'media', 'dificil']),
  utensils: z.array(z.string().max(80)).max(30),
  ingredients: z.array(IngredientSchema).min(1).max(60),
  steps: z.array(z.object({ text: z.string().min(1).max(1500), timerSeconds: z.number().int().min(0).max(86400).nullable().optional(), temperatureC: z.number().min(0).max(400).nullable().optional() })).min(1).max(40),
  tips: z.array(z.string().max(500)).max(20),
  substitutions: z.array(z.object({ ingredientId: z.string().max(80), options: z.array(z.object({ foodKey: z.string().max(120).nullable(), name: z.string().max(120), note: z.string().max(300) })).max(10) })).max(40),
  safetyNotes: z.array(z.string().max(500)).max(20),
  tags: z.array(z.string().max(40)).max(20),
})

const TargetSchema = z.object({ value: z.number().positive().max(10000), kind: z.enum(['approx', 'min', 'max']), strict: z.boolean().optional() })
export const TargetsSchema = z.object({ kcal: TargetSchema.nullable().optional(), protein: TargetSchema.nullable().optional(), carbs: TargetSchema.nullable().optional(), fat: TargetSchema.nullable().optional() })

export const SaveRecipeInput = z.object({
  recipe: RecipeSchema,
  targets: TargetsSchema.nullable().optional(),
  source: z.enum(['ai', 'manual', 'adapted']).default('ai'),
  parentId: z.uuid().nullable().optional(),
  imageUrl: z.string().url().startsWith('https://').max(500).nullable().optional(),
  imageCredit: z.string().max(200).nullable().optional(),
})
