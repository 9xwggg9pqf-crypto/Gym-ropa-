'use client'
import { Package, Plus, Sparkles } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { deletePantry, insertPantry, listPantry, updatePantry } from '@/lib/client-data'
import type { PantryRow } from '@/lib/api-types'
import { drafts } from '@/lib/drafts'
import type { Unit } from '@/lib/nutrition/types'
import { useSession } from '@/lib/session'
import { FoodPicker } from '@/components/recipe/FoodPicker'
import { Badge, Button, cx, EmptyState, ErrorBox, Field, Input, LinkButton, PageHeader, Select, Sheet, Skeleton, Tabs, useToast } from '@/components/ui'

type Loc = 'todo' | PantryRow['location']

function daysUntil(date: string) {
  const d = new Date(date + 'T00:00:00')
  const t = new Date()
  t.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - t.getTime()) / 86400000)
}

export default function PantryPage() {
  const router = useRouter()
  const { user, loading, configured } = useSession()
  const toast = useToast()
  const [rows, setRows] = useState<PantryRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loc, setLoc] = useState<Loc>('todo')
  const [picker, setPicker] = useState(false)
  const [edit, setEdit] = useState<PantryRow | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const r = await listPantry()
    if (!r.ok) return setError(r.error)
    setRows(r.data.map((x) => ({ ...x, quantity: x.quantity === null ? null : Number(x.quantity), low_threshold: x.low_threshold === null ? null : Number(x.low_threshold) })))
  }, [])
  useEffect(() => {
    if (user) load()
  }, [user, load])

  const list = useMemo(() => {
    const l = (rows ?? []).filter((r) => loc === 'todo' || r.location === loc)
    // Primero: gastar primero y lo que caduca antes; después, el resto; al final, lo agotado.
    return l.sort((a, b) => {
      const s = (r: PantryRow) => (r.status === 'agotado' ? 2 : r.use_first || (r.expires_on && daysUntil(r.expires_on) <= 3) ? 0 : 1)
      return s(a) - s(b) || (a.expires_on ?? '9999').localeCompare(b.expires_on ?? '9999') || a.name.localeCompare(b.name)
    })
  }, [rows, loc])
  const counts = useMemo(() => ({ todo: rows?.length ?? 0, nevera: rows?.filter((r) => r.location === 'nevera').length ?? 0, congelador: rows?.filter((r) => r.location === 'congelador').length ?? 0, despensa: rows?.filter((r) => r.location === 'despensa').length ?? 0 }), [rows])

  function cookWithSoon() {
    const soon = (rows ?? []).filter((r) => r.status === 'disponible' && (r.use_first || (r.expires_on && daysUntil(r.expires_on) <= 3)))
    if (!soon.length) return toast('No tienes productos marcados para gastar primero ni con fecha próxima.', 'info')
    drafts.setIngredients(soon.map((r) => ({ name: r.name, foodKey: r.food_key, quantity: r.quantity, unit: r.unit === 'ml' || r.unit === 'unidad' ? r.unit : 'g', state: 'desconocido', useFirst: true })))
    router.push('/crear?modo=solo_lo_que_tengo&desde=escaner&despensa=1')
  }

  if (!loading && (!configured || !user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Despensa" />
        <EmptyState icon={<Package className="h-6 w-6" aria-hidden />} title="Lo que tienes en casa" action={<LinkButton href="/entrar" variant="primary">Entrar o crear cuenta</LinkButton>}>
          Guarda tus alimentos (a mano o desde el escáner) y te propondremos recetas para aprovecharlos.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Despensa" subtitle="Las fechas y cantidades son las que introduces tú; no las deducimos de las fotos." action={<Button variant="primary" icon={<Plus className="h-4 w-4" aria-hidden />} onClick={() => setPicker(true)}>Añadir</Button>} />
      <Tabs label="Ubicación" value={loc} onChange={setLoc} items={[{ value: 'todo', label: 'Todo', count: counts.todo }, { value: 'nevera', label: 'Nevera', count: counts.nevera }, { value: 'congelador', label: 'Congelador', count: counts.congelador }, { value: 'despensa', label: 'Despensa', count: counts.despensa }]} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" icon={<Sparkles className="h-4 w-4" aria-hidden />} onClick={cookWithSoon}>
          Recetas para aprovechar lo que caduca
        </Button>
        <LinkButton href="/escanear" variant="ghost">
          Añadir desde una foto
        </LinkButton>
      </div>
      {error && <ErrorBox message={error} onRetry={load} />}
      {rows === null ? (
        <Skeleton className="h-72" />
      ) : list.length === 0 ? (
        <EmptyState icon={<Package className="h-6 w-6" aria-hidden />} title="Nada por aquí">
          Añade productos manualmente o desde el escáner.
        </EmptyState>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
          {list.map((r) => {
            const d = r.expires_on ? daysUntil(r.expires_on) : null
            const low = r.low_threshold !== null && r.quantity !== null && r.quantity <= r.low_threshold
            return (
              <li key={r.id}>
                <button type="button" onClick={() => setEdit(r)} className={cx('flex w-full items-center justify-between gap-3 px-3 py-3 text-left hover:bg-sunken/60', r.status === 'agotado' && 'opacity-60')}>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold">{r.name}</span>
                    <span className="mt-0.5 flex flex-wrap gap-1.5">
                      <Badge>{r.location}</Badge>
                      {r.status === 'agotado' && <Badge tone="danger">agotado</Badge>}
                      {r.status === 'revisar' && <Badge tone="warn">pendiente de revisar</Badge>}
                      {r.use_first && <Badge tone="saffron">gastar primero</Badge>}
                      {low && <Badge tone="warn">se está acabando</Badge>}
                      {d !== null && (
                        <Badge tone={d < 0 ? 'danger' : d <= 2 ? 'warn' : 'neutral'}>
                          {r.date_kind === 'consumo_preferente' ? 'cons. pref.' : 'caduca'} {d < 0 ? `hace ${-d} d` : d === 0 ? 'hoy' : `en ${d} d`}
                        </Badge>
                      )}
                    </span>
                  </span>
                  <span className="num shrink-0 text-sm font-semibold">{r.quantity !== null ? `${r.quantity} ${r.unit}` : '—'}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="text-xs text-muted">
        Caducidad: no consumir después de la fecha. Consumo preferente: después de la fecha el producto puede perder calidad, pero no necesariamente es inseguro. Ante cualquier duda (olor, aspecto, envase dañado), no lo consumas.
      </p>

      <FoodPicker
        open={picker}
        title="Añadir a la despensa"
        onClose={() => setPicker(false)}
        onPick={async ({ food, quantity, unit }) => {
          const u: Unit = ['g', 'kg', 'ml', 'l', 'unidad'].includes(unit) ? unit : 'g'
          const r = await insertPantry([{ name: food.name, food_key: food.key, quantity, unit: u, location: food.category === 'congelados' ? 'congelador' : ['carnes', 'pescados', 'huevos_lacteos', 'frutas_verduras'].includes(food.category) ? 'nevera' : 'despensa', status: 'disponible' }])
          if (!r.ok) return toast(r.error, 'error')
          setRows((x) => [...r.data, ...(x ?? [])])
          setEdit(r.data[0])
        }}
      />
      <PantryEditSheet row={edit} onClose={() => setEdit(null)} onSaved={load} />
    </div>
  )
}

function PantryEditSheet({ row, onClose, onSaved }: { row: PantryRow | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [v, setV] = useState<PantryRow | null>(row)
  const [busy, setBusy] = useState(false)
  useEffect(() => setV(row), [row])
  if (!row || !v) return null
  const set = (patch: Partial<PantryRow>) => setV({ ...v, ...patch })
  async function save() {
    if (!v) return
    if (v.date_kind && !v.expires_on) return toast('Indica la fecha si eliges un tipo de fecha.', 'error')
    setBusy(true)
    const r = await updatePantry(v.id, {
      name: v.name.trim() || row!.name,
      quantity: v.quantity,
      unit: v.unit,
      location: v.location,
      status: v.status,
      food_state: v.food_state,
      purchased_on: v.purchased_on || null,
      expires_on: v.expires_on || null,
      date_kind: v.expires_on ? v.date_kind ?? 'consumo_preferente' : null,
      use_first: v.use_first,
      low_threshold: v.low_threshold,
    })
    setBusy(false)
    if (!r.ok) return toast(r.error, 'error')
    toast('Guardado')
    onClose()
    onSaved()
  }
  const num = (s: string) => (s === '' ? null : Number(s.replace(',', '.')))
  return (
    <Sheet
      open
      onClose={onClose}
      title={row.name}
      footer={
        <div className="flex gap-2">
          <Button
            variant="ghost"
            className="text-danger"
            onClick={async () => {
              const r = await deletePantry(row.id)
              if (!r.ok) return toast(r.error, 'error')
              onClose()
              onSaved()
            }}
          >
            Eliminar
          </Button>
          <Button variant="primary" block onClick={save} loading={busy}>
            Guardar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Nombre" htmlFor="p-name">
          <Input id="p-name" value={v.name} maxLength={120} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Cantidad" htmlFor="p-qty">
            <Input id="p-qty" inputMode="decimal" value={v.quantity ?? ''} onChange={(e) => set({ quantity: num(e.target.value) })} placeholder="Desconocida" />
          </Field>
          <Field label="Unidad" htmlFor="p-unit">
            <Select id="p-unit" value={v.unit} onChange={(e) => set({ unit: e.target.value as Unit })}>
              <option value="g">g</option>
              <option value="kg">kg</option>
              <option value="ml">ml</option>
              <option value="l">l</option>
              <option value="unidad">unidades</option>
            </Select>
          </Field>
          <Field label="Ubicación" htmlFor="p-loc">
            <Select id="p-loc" value={v.location} onChange={(e) => set({ location: e.target.value as PantryRow['location'] })}>
              <option value="nevera">Nevera</option>
              <option value="congelador">Congelador</option>
              <option value="despensa">Despensa</option>
            </Select>
          </Field>
          <Field label="Estado" htmlFor="p-status">
            <Select id="p-status" value={v.status} onChange={(e) => set({ status: e.target.value as PantryRow['status'] })}>
              <option value="disponible">Disponible</option>
              <option value="agotado">Agotado</option>
              <option value="revisar">Pendiente de revisar</option>
            </Select>
          </Field>
          <Field label="Conservación" htmlFor="p-state">
            <Select id="p-state" value={v.food_state ?? ''} onChange={(e) => set({ food_state: (e.target.value || null) as PantryRow['food_state'] })}>
              <option value="">Sin indicar</option>
              <option value="crudo">Crudo/fresco</option>
              <option value="cocinado">Cocinado</option>
              <option value="congelado">Congelado</option>
              <option value="conserva">Conserva</option>
            </Select>
          </Field>
          <Field label="Avisar si queda menos de" htmlFor="p-low" hint={`En ${v.unit}`}>
            <Input id="p-low" inputMode="decimal" value={v.low_threshold ?? ''} onChange={(e) => set({ low_threshold: num(e.target.value) })} />
          </Field>
          <Field label="Fecha de compra" htmlFor="p-buy">
            <Input id="p-buy" type="date" value={v.purchased_on ?? ''} onChange={(e) => set({ purchased_on: e.target.value || null })} />
          </Field>
          <Field label="Fecha en el envase" htmlFor="p-exp">
            <Input id="p-exp" type="date" value={v.expires_on ?? ''} onChange={(e) => set({ expires_on: e.target.value || null, date_kind: e.target.value ? v.date_kind ?? 'consumo_preferente' : null })} />
          </Field>
        </div>
        {v.expires_on && (
          <Field label="Tipo de fecha" htmlFor="p-kind">
            <Select id="p-kind" value={v.date_kind ?? 'consumo_preferente'} onChange={(e) => set({ date_kind: e.target.value as PantryRow['date_kind'] })}>
              <option value="caducidad">Fecha de caducidad («consumir antes del»)</option>
              <option value="consumo_preferente">Consumo preferente («preferentemente antes del»)</option>
            </Select>
          </Field>
        )}
        <label className="flex items-center gap-3 rounded-xl border border-line p-3 text-sm">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--saffron))]" checked={v.use_first} onChange={(e) => set({ use_first: e.target.checked })} />
          Gastar primero
        </label>
      </div>
    </Sheet>
  )
}
