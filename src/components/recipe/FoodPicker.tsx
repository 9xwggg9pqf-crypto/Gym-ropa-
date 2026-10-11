'use client'
import { Database, PenLine, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { searchFoods } from '@/lib/nutrition/catalog'
import type { Allergen, Food, Unit } from '@/lib/nutrition/types'
import { ALLERGENS } from '@/lib/nutrition/types'
import { ALLERGEN_LABELS } from '@/lib/nutrition/restrictions'
import { api, customFoodToFood, insertCustomFood, listCustomFoods } from '@/lib/client-data'
import { useSession } from '@/lib/session'
import { Badge, Button, Chip, Field, Input, Select, Sheet, Spinner, useToast } from '@/components/ui'

const STATE_LABEL: Record<Food['state'], string> = { raw: 'crudo', cooked: 'cocinado', dry: 'en seco', canned: 'conserva', prepared: 'preparado' }

export interface PickedFood {
  food: Food
  quantity: number
  unit: Unit
}

/** Selector de alimentos: catálogo USDA curado, alimentos propios (etiqueta) y búsqueda ampliada en USDA. */
export function FoodPicker({ open, onClose, onPick, title = 'Añadir ingrediente', initialQuery = '' }: { open: boolean; onClose: () => void; onPick: (p: PickedFood) => void; title?: string; initialQuery?: string }) {
  const { user } = useSession()
  const toast = useToast()
  const [q, setQ] = useState(initialQuery)
  const [custom, setCustom] = useState<Food[]>([])
  const [fdc, setFdc] = useState<Food[] | null>(null)
  const [fdcState, setFdcState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [fdcError, setFdcError] = useState('')
  const [selected, setSelected] = useState<Food | null>(null)
  const [qty, setQty] = useState('100')
  const [unit, setUnit] = useState<Unit>('g')
  const [mode, setMode] = useState<'search' | 'label'>('search')

  useEffect(() => {
    if (!open) return
    setQ(initialQuery)
    setSelected(null)
    setFdc(null)
    setMode('search')
    if (user) listCustomFoods().then((r) => r.ok && setCustom(r.data.map(customFoodToFood)))
  }, [open, user, initialQuery])

  const results = useMemo(() => searchFoods(q, 20), [q])
  const customResults = useMemo(() => custom.filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase())), [custom, q])

  async function searchFdc() {
    setFdcState('loading')
    const r = await api<{ foods: Food[] }>(`/api/foods/fdc?q=${encodeURIComponent(q)}`)
    if (r.ok) {
      setFdc(r.data.foods)
      setFdcState('idle')
    } else {
      setFdcState('error')
      setFdcError(r.error)
    }
  }

  function choose(f: Food) {
    setSelected(f)
    if (f.portions.unit?.grams) {
      setUnit('unidad')
      setQty('1')
    } else {
      setUnit('g')
      setQty('100')
    }
  }

  function confirm() {
    const n = Number(qty.replace(',', '.'))
    if (!selected || !Number.isFinite(n) || n <= 0) {
      toast('Indica una cantidad válida.', 'error')
      return
    }
    onPick({ food: selected, quantity: n, unit })
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={selected ? selected.name : title}
      footer={
        selected ? (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>
              Cambiar
            </Button>
            <Button variant="primary" block onClick={confirm}>
              Añadir
            </Button>
          </div>
        ) : null
      }
    >
      {selected ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-sunken p-3 text-sm">
            <p className="font-semibold">{selected.name}</p>
            <p className="num mt-1 text-muted">
              Por 100 g: {selected.per100g.kcal} kcal · P {selected.per100g.protein} g · H {selected.per100g.carbs} g · G {selected.per100g.fat} g
            </p>
            <p className="mt-1 text-xs text-muted">
              {selected.source === 'custom_label' ? 'Valores de la etiqueta que introdujiste.' : `Fuente: USDA FoodData Central${selected.fdcId ? ` (FDC ${selected.fdcId})` : ''}.`}
              {selected.allergens.length > 0 && ` Contiene: ${selected.allergens.map((a) => ALLERGEN_LABELS[a]).join(', ')}.`}
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Cantidad" htmlFor="fp-qty">
              <Input id="fp-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} />
            </Field>
            <Field label="Unidad" htmlFor="fp-unit">
              <Select id="fp-unit" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
                <option value="g">g</option>
                <option value="ml">ml</option>
                {selected.portions.unit?.grams && <option value="unidad">{selected.portions.unit.name} (≈{selected.portions.unit.grams} g)</option>}
                <option value="cda">cucharada</option>
                <option value="cdta">cucharadita</option>
              </Select>
            </Field>
          </div>
          {unit !== 'g' && <p className="text-xs text-muted">Las unidades y cucharadas usan un peso medio de USDA; para más precisión, pesa el ingrediente.</p>}
        </div>
      ) : mode === 'label' ? (
        <CustomFoodForm
          onCancel={() => setMode('search')}
          onSaved={(f) => {
            setCustom((c) => [f, ...c])
            choose(f)
          }}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input aria-label="Buscar alimento" placeholder="Pollo, arroz, tomate…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          {customResults.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="label-caps text-muted">Tus alimentos</p>
              {customResults.slice(0, 6).map((f) => (
                <FoodRow key={f.key} food={f} onClick={() => choose(f)} />
              ))}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <p className="label-caps text-muted">Catálogo SNACKEATS (USDA)</p>
            {q && results.length === 0 && <p className="py-2 text-sm text-muted">Sin coincidencias en el catálogo.</p>}
            {(q ? results : []).map((f) => (
              <FoodRow key={f.key} food={f} onClick={() => choose(f)} />
            ))}
            {!q && <p className="py-2 text-sm text-muted">Escribe para buscar entre los ingredientes con datos verificados.</p>}
          </div>
          {q.length >= 2 && (
            <div className="flex flex-col gap-2 rounded-2xl border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-muted">¿No está? Busca en la base completa de USDA (nombres en inglés).</p>
                <Button size="sm" variant="outline" icon={<Database className="h-4 w-4" aria-hidden />} onClick={searchFdc} loading={fdcState === 'loading'}>
                  USDA
                </Button>
              </div>
              {fdcState === 'error' && <p className="text-sm text-danger">{fdcError}</p>}
              {fdc?.length === 0 && <p className="text-sm text-muted">Sin resultados con datos completos.</p>}
              {fdc?.map((f) => (
                <FoodRow key={f.key} food={f} onClick={() => choose(f)} />
              ))}
            </div>
          )}
          {user && (
            <Button variant="ghost" icon={<PenLine className="h-4 w-4" aria-hidden />} onClick={() => setMode('label')}>
              Crear un alimento con los datos de su etiqueta
            </Button>
          )}
        </div>
      )}
    </Sheet>
  )
}

function FoodRow({ food, onClick }: { food: Food; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center justify-between gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-sunken">
      <span className="min-w-0">
        <span className="block truncate text-[15px] font-medium">{food.name}</span>
        <span className="num block text-xs text-muted">
          {food.per100g.kcal} kcal · P {food.per100g.protein} g / 100 g
        </span>
      </span>
      <Badge>{food.source === 'custom_label' ? 'etiqueta' : food.source === 'usda_fdc_api' ? 'USDA' : STATE_LABEL[food.state]}</Badge>
    </button>
  )
}

function CustomFoodForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (f: Food) => void }) {
  const toast = useToast()
  const [v, setV] = useState({ name: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '', sugars: '', unit: '' })
  const [allergens, setAllergens] = useState<Allergen[]>([])
  const [saving, setSaving] = useState(false)
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
  async function save() {
    const kcal = num(v.kcal), protein = num(v.protein), carbs = num(v.carbs), fat = num(v.fat)
    if (!v.name.trim() || [kcal, protein, carbs, fat].some((x) => x === null || !Number.isFinite(x) || x < 0)) {
      toast('Rellena el nombre y los cuatro valores principales por 100 g.', 'error')
      return
    }
    if ((protein ?? 0) + (carbs ?? 0) + (fat ?? 0) > 100) {
      toast('Proteínas + hidratos + grasas no pueden superar 100 g por cada 100 g.', 'error')
      return
    }
    setSaving(true)
    const r = await insertCustomFood({ name: v.name.trim(), kcal: kcal!, protein: protein!, carbs: carbs!, fat: fat!, fiber: num(v.fiber), sugars: num(v.sugars), sat_fat: null, sodium_mg: null, unit_grams: num(v.unit), allergens, category: 'otros' })
    setSaving(false)
    if (!r.ok) return toast(r.error, 'error')
    toast('Alimento guardado')
    onSaved(customFoodToFood(r.data))
  }
  const f = (k: keyof typeof v, label: string, hint?: string) => (
    <Field label={label} htmlFor={`cf-${k}`} hint={hint}>
      <Input id={`cf-${k}`} inputMode={k === 'name' ? 'text' : 'decimal'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
    </Field>
  )
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted">Copia los valores «por 100 g» de la etiqueta. Se guardan sólo en tu cuenta.</p>
      {f('name', 'Nombre del producto')}
      <div className="grid grid-cols-2 gap-3">
        {f('kcal', 'Energía (kcal)')}
        {f('protein', 'Proteínas (g)')}
        {f('carbs', 'Hidratos (g)')}
        {f('fat', 'Grasas (g)')}
        {f('fiber', 'Fibra (g)', 'Opcional')}
        {f('sugars', 'Azúcares (g)', 'Opcional')}
      </div>
      {f('unit', 'Peso de una unidad (g)', 'Opcional, p. ej. una barrita')}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">Alérgenos que indica la etiqueta</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map((a) => (
            <Chip key={a} active={allergens.includes(a)} onClick={() => setAllergens((s) => (s.includes(a) ? s.filter((x) => x !== a) : [...s, a]))}>
              {ALLERGEN_LABELS[a]}
            </Chip>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button variant="primary" block onClick={save} loading={saving}>
          Guardar alimento
        </Button>
      </div>
      {saving && <Spinner label="Guardando" />}
    </div>
  )
}
