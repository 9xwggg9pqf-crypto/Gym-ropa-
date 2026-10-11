import * as z from 'zod/v4'
import { UNITS } from '@/lib/nutrition/types'

// Esquemas de salida estructurada para Claude. La API garantiza JSON válido
// conforme al esquema; aun así, el servidor revalida y contrasta cada clave de
// catálogo antes de usarla.

export const ScanOutput = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('Nombre común del alimento en español'),
      catalogKey: z.string().nullable().describe('Clave EXACTA del catálogo si encaja; null si no hay una equivalente'),
      confidence: z.enum(['alta', 'media', 'baja']).describe('Confianza en la identificación visual'),
      state: z.enum(['crudo', 'cocinado', 'congelado', 'conserva', 'desconocido']),
      count: z.number().nullable().describe('Número de piezas sólo si se pueden contar claramente; si no, null'),
      packaging: z.string().nullable().describe('Envase visible (bolsa, lata, bandeja...) o null'),
      note: z.string().nullable(),
    }),
  ),
  unidentified: z.array(
    z.object({
      description: z.string().describe('Descripción de lo que se ve'),
      possibilities: z.array(z.string()).describe('Posibles alimentos, si los hay'),
    }),
  ),
  imageQuality: z.enum(['buena', 'regular', 'mala']),
  notFood: z.boolean().describe('true si la imagen no muestra alimentos'),
})
export type ScanOutput = z.infer<typeof ScanOutput>

const Target = z.object({
  value: z.number(),
  kind: z.enum(['approx', 'min', 'max']),
  strict: z.boolean(),
})

export const RecipeOutput = z.object({
  title: z.string(),
  description: z.string(),
  servings: z.number(),
  prepMinutes: z.number(),
  cookMinutes: z.number(),
  difficulty: z.enum(['facil', 'media', 'dificil']),
  utensils: z.array(z.string()),
  ingredients: z.array(
    z.object({
      name: z.string(),
      catalogKey: z.string().nullable(),
      quantity: z.number(),
      unit: z.enum(UNITS),
      role: z.enum(['protein', 'carb', 'fat', 'vegetable', 'dairy', 'sauce', 'seasoning', 'fruit', 'other']),
      adjustable: z.boolean(),
      minG: z.number().nullable(),
      maxG: z.number().nullable(),
      optional: z.boolean(),
      fromPantry: z.boolean(),
      note: z.string().nullable(),
    }),
  ),
  steps: z.array(z.object({ text: z.string(), timerSeconds: z.number().nullable(), temperatureC: z.number().nullable() })),
  tips: z.array(z.string()),
  substitutions: z.array(
    z.object({
      ingredientName: z.string(),
      options: z.array(z.object({ name: z.string(), catalogKey: z.string().nullable(), note: z.string() })),
    }),
  ),
  safetyNotes: z.array(z.string()),
  tags: z.array(z.string()),
})
export type RecipeOutput = z.infer<typeof RecipeOutput>

export const GenerateOutput = z.object({
  interpretation: z.object({
    summary: z.string().describe('Qué has entendido de la petición, en una o dos frases'),
    dish: z.string().nullable(),
    servings: z.number().nullable(),
    targets: z.object({ kcal: Target.nullable(), protein: Target.nullable(), carbs: Target.nullable(), fat: Target.nullable() }),
    questions: z.array(z.string()).describe('Preguntas imprescindibles (p. ej. de seguridad) si falta información'),
  }),
  recipes: z.array(RecipeOutput),
  infeasible: z.string().nullable().describe('Explicación si la petición no se puede cumplir de forma razonable o segura'),
})
export type GenerateOutput = z.infer<typeof GenerateOutput>
