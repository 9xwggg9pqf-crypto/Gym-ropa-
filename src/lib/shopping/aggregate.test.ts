import { describe, expect, it } from 'vitest'
import { aggregateShopping, mergeShoppingList, type ShoppingRow } from './aggregate'
import type { RecipeIngredient } from '@/lib/nutrition/types'

const chicken = (q: number): RecipeIngredient => ({ id: 'c', foodKey: 'pechuga_pollo_cruda', name: 'Pollo', quantity: q, unit: 'g', role: 'protein', adjustable: true })
const rice = (q: number): RecipeIngredient => ({ id: 'r', foodKey: 'arroz_blanco_crudo', name: 'Arroz', quantity: q, unit: 'g', role: 'carb', adjustable: true })

describe('lista de la compra', () => {
  it('agrupa repetidos, escala por raciones y resta la despensa', () => {
    const items = aggregateShopping(
      [
        { title: 'Pollo con arroz', baseServings: 2, plannedServings: 4, ingredients: [chicken(300), rice(160)] },
        { title: 'Ensalada de pollo', baseServings: 1, plannedServings: 1, ingredients: [chicken(150)] },
      ],
      [{ foodKey: 'pechuga_pollo_cruda', name: 'Pollo', quantity: 200, unit: 'g', status: 'disponible' }],
    )
    const c = items.find((i) => i.foodKey === 'pechuga_pollo_cruda')!
    expect(c.neededG).toBe(750) // 600 + 150
    expect(c.pantryG).toBe(200)
    expect(c.toBuy).toBe(550)
    expect(c.sources).toEqual(['Pollo con arroz', 'Ensalada de pollo'])
    const r = items.find((i) => i.foodKey === 'arroz_blanco_crudo')!
    expect(r.toBuy).toBe(320)
  })
  it('ignora existencias agotadas', () => {
    const items = aggregateShopping([{ title: 'x', baseServings: 1, plannedServings: 1, ingredients: [rice(100)] }], [
      { foodKey: 'arroz_blanco_crudo', name: 'Arroz', quantity: 500, unit: 'g', status: 'agotado' },
    ])
    expect(items[0].toBuy).toBe(100)
  })
  it('nunca elimina productos añadidos a mano y conserva "comprado"', () => {
    const existing: ShoppingRow[] = [
      { id: '1', item_key: null, name: 'Papel de cocina', quantity: 1, unit: 'unidad', category: 'otros', checked: false, source: 'manual' },
      { id: '2', item_key: 'f:arroz_blanco_crudo', name: 'Arroz', quantity: 320, unit: 'g', category: 'cereales_legumbres', checked: true, source: 'plan' },
      { id: '3', item_key: 'f:tomate', name: 'Tomate', quantity: 200, unit: 'g', category: 'frutas_verduras', checked: false, source: 'plan' },
    ]
    const generated = aggregateShopping([{ title: 'x', baseServings: 1, plannedServings: 1, ingredients: [rice(320)] }], [])
    const res = mergeShoppingList(existing, generated)
    expect(res.keep.map((r) => r.name)).toEqual(['Papel de cocina'])
    expect(res.upsert[0]).toMatchObject({ id: '2', checked: true, quantity: 320 })
    expect(res.remove.map((r) => r.id)).toEqual(['3'])
  })
})
