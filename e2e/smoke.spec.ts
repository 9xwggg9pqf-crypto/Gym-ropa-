import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Receta de ejemplo SÓLO para pruebas (simula el resultado de la IA en la sesión del navegador).
const fixture = {
  createdAt: Date.now(),
  interpretation: { summary: 'Prueba', dish: null, questions: [] },
  targets: null,
  infeasible: null,
  removed: 0,
  recipes: [
    {
      unmatched: [],
      targets: null,
      recipe: {
        title: 'Pollo con arroz (prueba)', description: 'Receta de prueba', servings: 1, prepMinutes: 10, cookMinutes: 20, difficulty: 'facil', utensils: [],
        ingredients: [
          { id: 'a', foodKey: 'pechuga_pollo_cruda', name: 'Pechuga de pollo', quantity: 150, unit: 'g', role: 'protein', adjustable: true },
          { id: 'b', foodKey: 'arroz_blanco_crudo', name: 'Arroz blanco', quantity: 80, unit: 'g', role: 'carb', adjustable: true },
          { id: 'c', foodKey: 'aceite_oliva', name: 'Aceite de oliva', quantity: 10, unit: 'g', role: 'fat', adjustable: true },
        ],
        steps: [{ text: 'Cocinar el arroz.', timerSeconds: 900, temperatureC: null }, { text: 'Dorar el pollo.', timerSeconds: null, temperatureC: null }],
        tips: [], substitutions: [], safetyNotes: [], tags: [],
      },
    },
  ],
}

const PAGES = ['/', '/crear', '/escanear', '/recetas', '/plan', '/compra', '/despensa', '/perfil', '/planes', '/entrar', '/receta?i=0', '/receta/cocinar?i=0', '/privacidad', '/configuracion']

test.beforeEach(async ({ page }) => {
  await page.addInitScript((f) => sessionStorage.setItem('se:results', JSON.stringify(f)), fixture)
})

for (const path of PAGES) {
  test(`accesibilidad y diseño adaptable: ${path}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(path, { waitUntil: 'networkidle' })
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
    expect(serious.map((v) => `${v.id}: ${v.nodes.slice(0, 8).map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
    expect(errors).toEqual([])
  })
}

const kcalCell = (page: import('@playwright/test').Page) => page.locator('section[aria-labelledby="ficha-nutricional"] .text-2xl')

test('Caso D en la interfaz: cambiar la cantidad recalcula la ficha', async ({ page }) => {
  await page.goto('/receta?i=0', { waitUntil: 'networkidle' })
  // 150 g pollo (180 kcal) + 80 g arroz (292 kcal) + 10 g aceite (88,4 kcal) = 560 kcal (USDA)
  await expect(kcalCell(page)).toHaveText(/^560/)
  await page.getByRole('button', { name: 'Aumentar cantidad de Pechuga de pollo' }).click() // +10 g → +12 kcal
  await expect(kcalCell(page)).toHaveText(/^572/)
})

test('Caso E en la interfaz: duplicar raciones duplica cantidades y mantiene kcal por ración', async ({ page }) => {
  await page.goto('/receta?i=0', { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: 'Aumentar raciones' }).first().click()
  await expect(page.getByRole('textbox', { name: 'cantidad de Pechuga de pollo' })).toHaveValue('300')
  await expect(kcalCell(page)).toHaveText(/^560/)
})
