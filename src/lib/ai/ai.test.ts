import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AIError } from './client'
import { normalizeScan } from './scan'
import type { GenerateOutput, RecipeOutput } from './schemas'

vi.mock('./client', async (orig) => {
  const actual = await orig<typeof import('./client')>()
  return { ...actual, callStructured: vi.fn() }
})
const { callStructured } = await import('./client')
const { generateRecipes, GenerateInput } = await import('./recipes')
const mocked = vi.mocked(callStructured)

const baseRecipe = (title: string, ingredients: RecipeOutput['ingredients']): RecipeOutput => ({
  title,
  description: 'd',
  servings: 1,
  prepMinutes: 10,
  cookMinutes: 15,
  difficulty: 'facil',
  utensils: [],
  ingredients,
  steps: [{ text: 'Cocinar', timerSeconds: 600, temperatureC: null }],
  tips: [],
  substitutions: [],
  safetyNotes: [],
  tags: [],
})
const I = (name: string, catalogKey: string | null, quantity: number, role: RecipeOutput['ingredients'][number]['role']): RecipeOutput['ingredients'][number] => ({
  name,
  catalogKey,
  quantity,
  unit: 'g',
  role,
  adjustable: true,
  minG: null,
  maxG: null,
  optional: false,
  fromPantry: true,
  note: null,
})

describe('Caso F: ingrediente no identificado', () => {
  it('no inventa la identidad: lo deja en "sin identificar" y exige confirmar lo dudoso', () => {
    const r = normalizeScan({
      items: [
        { name: 'Pechuga de pollo', catalogKey: 'pechuga_pollo_cruda', confidence: 'alta', state: 'crudo', count: null, packaging: 'bandeja', note: null },
        { name: 'Queso', catalogKey: 'queso_inventado', confidence: 'media', state: 'desconocido', count: null, packaging: null, note: null },
        { name: 'Tomate', catalogKey: 'tomate', confidence: 'baja', state: 'crudo', count: 3, packaging: null, note: null },
      ],
      unidentified: [{ description: 'Táper con contenido marrón', possibilities: ['guiso', 'lentejas'] }],
      imageQuality: 'regular',
      notFood: false,
    })
    expect(r.items[0]).toMatchObject({ foodKey: 'pechuga_pollo_cruda', needsConfirmation: false })
    expect(r.items[1].needsConfirmation).toBe(true) // clave inexistente → no se usa a ciegas
    expect(r.items[1].foodKey).not.toBe('queso_inventado')
    expect(r.items[2]).toMatchObject({ needsConfirmation: true, count: 3 })
    expect(r.unidentified[0].possibilities).toContain('lentejas')
  })
})

describe('generación de recetas', () => {
  beforeEach(() => mocked.mockReset())
  const ctx = { profile: { allergies: ['leche' as const], intolerances: [], diets: [], dislikes: [] }, pantry: [], locale: 'es' }

  it('Caso G (servidor): descarta recetas con el alérgeno aunque la IA las proponga', async () => {
    const output: GenerateOutput = {
      interpretation: { summary: 'Pollo con arroz', dish: null, servings: 1, targets: { kcal: { value: 650, kind: 'approx', strict: false }, protein: { value: 40, kind: 'min', strict: false }, carbs: null, fat: null }, questions: [] },
      recipes: [
        baseRecipe('Pollo gratinado', [I('Pollo', 'pechuga_pollo_cruda', 150, 'protein'), I('Mozzarella', 'queso_mozzarella', 40, 'dairy')]),
        baseRecipe('Pollo con arroz y tomate', [I('Pollo', 'pechuga_pollo_cruda', 150, 'protein'), I('Arroz', 'arroz_blanco_crudo', 80, 'carb'), I('Tomate', 'tomate', 100, 'vegetable')]),
      ],
      infeasible: null,
    }
    mocked.mockResolvedValue({ data: output, model: 'test', inputTokens: 1, outputTokens: 1 })
    const input = GenerateInput.parse({ mode: 'solo_lo_que_tengo', ingredients: [{ name: 'pollo' }, { name: 'arroz' }, { name: 'queso' }, { name: 'tomate' }] })
    const r = await generateRecipes(input, ctx)
    expect(r.recipes.map((x) => x.recipe.title)).toEqual(['Pollo con arroz y tomate'])
    expect(r.removed).toBe(1)
    // Los objetivos interpretados del texto se aplican si el formulario no los trae
    expect(r.targets?.kcal?.value).toBe(650)
  })

  it('valida las claves de catálogo de la IA (una clave inventada no se usa)', async () => {
    mocked.mockResolvedValue({
      data: { interpretation: { summary: '', dish: null, servings: null, targets: { kcal: null, protein: null, carbs: null, fat: null }, questions: [] }, recipes: [baseRecipe('X', [I('Pollo', 'pollo_mágico', 150, 'protein')])], infeasible: null },
      model: 'test',
      inputTokens: 1,
      outputTokens: 1,
    })
    const r = await generateRecipes(GenerateInput.parse({ mode: 'plato_concreto', request: 'pollo' }), { ...ctx, profile: { allergies: [], intolerances: [], diets: [], dislikes: [] } })
    const ing = r.recipes[0].recipe.ingredients[0]
    expect(ing.foodKey).toBe('pechuga_pollo_cruda') // coincidencia exacta del alias "pollo", no la clave inventada
    expect(r.recipes[0].unmatched).toEqual([])
  })

  it('Caso I: si la IA falla, propaga el error y no devuelve recetas inventadas', async () => {
    const failing = async (): Promise<never> => {
      throw new AIError('unavailable', 'El servicio de IA no responde', true, 503)
    }
    const err = await generateRecipes(GenerateInput.parse({ mode: 'plato_concreto', request: 'pizza' }), ctx, failing).then(() => null, (e: unknown) => e)
    expect(err instanceof AIError).toBe(true)
    expect((err as AIError).code).toBe('unavailable')
    expect((err as AIError).retryable).toBe(true)
  })

  it('rechaza peticiones vacías sin llamar a la IA', async () => {
    const err = await generateRecipes(GenerateInput.parse({ mode: 'plato_concreto', request: '  ' }), ctx).then(() => null, (e: unknown) => e)
    expect((err as AIError).code).toBe('bad_request')
    expect(mocked).not.toHaveBeenCalled()
  })
})
