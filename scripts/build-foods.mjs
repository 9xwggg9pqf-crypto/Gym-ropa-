#!/usr/bin/env node
// Genera src/data/foods.generated.json a partir del CSV oficial USDA SR Legacy.
//
// Uso:
//   1. Descarga https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//   2. Descomprime y ejecuta: USDA_DIR=/ruta/a/FoodData_Central_sr_legacy_food_csv_2018-04 npm run foods:build
//
// Los valores nutricionales SIEMPRE salen de los ficheros de USDA: este script
// no inventa ni rellena huecos. Si un nutriente no existe para un alimento, se
// guarda como null (desconocido), nunca como 0.
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import { fileURLToPath } from 'node:url'
import { CATALOG_DEF } from './catalog-def.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const USDA_DIR = process.env.USDA_DIR || process.argv[2]
if (!USDA_DIR) {
  console.error('Falta USDA_DIR (ruta a la carpeta descomprimida de SR Legacy).')
  process.exit(1)
}

// Nutrientes (IDs de FoodData Central)
const NUTRIENTS = {
  1008: 'kcal',
  1003: 'protein',
  1005: 'carbs',
  1004: 'fat',
  1079: 'fiber',
  2000: 'sugars',
  1258: 'satFat',
  1093: 'sodiumMg',
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else q = false
      } else cur += c
    } else if (c === '"') q = true
    else if (c === ',') { out.push(cur); cur = '' }
    else cur += c
  }
  out.push(cur)
  return out
}

async function readCsv(file, onRow) {
  const rl = readline.createInterface({ input: fs.createReadStream(path.join(USDA_DIR, file)), crlfDelay: Infinity })
  let header = null
  for await (const line of rl) {
    if (!line) continue
    const cols = parseCsvLine(line)
    if (!header) { header = cols; continue }
    const row = {}
    header.forEach((h, i) => { row[h] = cols[i] })
    onRow(row)
  }
}

const wanted = new Map(CATALOG_DEF.map((d) => [String(d.fdcId), d]))
const keys = new Set()
for (const d of CATALOG_DEF) {
  if (keys.has(d.key)) throw new Error(`Clave duplicada: ${d.key}`)
  keys.add(d.key)
}

const descriptions = new Map()
await readCsv('food.csv', (r) => { if (wanted.has(r.fdc_id)) descriptions.set(r.fdc_id, r.description) })

const nutrients = new Map()
await readCsv('food_nutrient.csv', (r) => {
  if (!wanted.has(r.fdc_id)) return
  const name = NUTRIENTS[r.nutrient_id]
  if (!name) return
  const m = nutrients.get(r.fdc_id) ?? {}
  m[name] = Number(r.amount)
  nutrients.set(r.fdc_id, m)
})

const portions = new Map()
await readCsv('food_portion.csv', (r) => {
  if (!wanted.has(r.fdc_id)) return
  const list = portions.get(r.fdc_id) ?? []
  list.push({ amount: Number(r.amount), modifier: r.modifier || r.portion_description, grams: Number(r.gram_weight) })
  portions.set(r.fdc_id, list)
})

function perOne(p) {
  return p && p.amount > 0 ? Math.round((p.grams / p.amount) * 100) / 100 : null
}
function findPortion(list, re) {
  return list.find((p) => re.test(p.modifier.trim()))
}

const problems = []
const foods = CATALOG_DEF.map((d) => {
  const id = String(d.fdcId)
  const desc = descriptions.get(id)
  if (!desc) problems.push(`${d.key}: FDC ${id} no existe en SR Legacy`)
  const n = nutrients.get(id) ?? {}
  const per100g = {}
  for (const name of Object.values(NUTRIENTS)) per100g[name] = typeof n[name] === 'number' && !Number.isNaN(n[name]) ? n[name] : null
  for (const req of ['kcal', 'protein', 'carbs', 'fat']) if (per100g[req] === null) problems.push(`${d.key}: falta ${req}`)
  const list = portions.get(id) ?? []
  const tbsp = findPortion(list, /^(tbsp|tablespoon)\b/i)
  const tsp = findPortion(list, /^(tsp|teaspoon)\b/i)
  const cup = findPortion(list, /^cup\b/i)
  const fluidCup = findPortion(list, /^cup$/i)
  let unit = null
  if (d.unitRe) {
    const p = findPortion(list, new RegExp(d.unitRe, 'i'))
    if (!p) problems.push(`${d.key}: sin porción USDA que encaje con ${d.unitRe}. Disponibles: ${list.map((x) => x.modifier).join(' | ')}`)
    else unit = { name: d.unitName ?? 'unidad', grams: perOne(p), usda: `${p.amount} ${p.modifier}` }
  }
  return {
    key: d.key,
    fdcId: d.fdcId,
    name: d.name,
    aliases: d.aliases,
    usdaDescription: desc ?? null,
    category: d.category,
    group: d.group,
    state: d.state,
    allergens: d.allergens,
    mayContain: d.mayContain,
    animal: d.animal,
    per100g,
    portions: {
      unit,
      tbspG: perOne(tbsp),
      tspG: perOne(tsp),
      cupG: perOne(cup),
      // densidad g/ml sólo si USDA da el peso de una taza "cup" sin modificadores (líquidos y polvos)
      densityGPerMl: fluidCup ? Math.round((perOne(fluidCup) / 236.588) * 1000) / 1000 : null,
    },
  }
})

if (problems.length) {
  console.error('Problemas encontrados:\n' + problems.map((p) => ' - ' + p).join('\n'))
  if (problems.some((p) => !p.includes('sin porción'))) process.exit(1)
}

const out = {
  source: 'USDA FoodData Central — SR Legacy (abril 2018). Dominio público (CC0 1.0).',
  sourceUrl: 'https://fdc.nal.usda.gov/',
  generatedAt: new Date().toISOString().slice(0, 10),
  count: foods.length,
  foods,
}
const dest = path.join(here, '..', 'src', 'data', 'foods.generated.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n')
console.log(`OK: ${foods.length} alimentos → ${path.relative(process.cwd(), dest)}`)
if (process.env.VERBOSE) for (const f of foods) console.log(`${f.key.padEnd(28)} ${String(f.fdcId).padEnd(7)} ${f.per100g.kcal}kcal P${f.per100g.protein} | ${f.usdaDescription} | unit=${f.portions.unit?.grams ?? '-'} tbsp=${f.portions.tbspG ?? '-'} dens=${f.portions.densityGPerMl ?? '-'}`)
