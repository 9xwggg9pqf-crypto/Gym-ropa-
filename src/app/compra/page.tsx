'use client'
import { Check, Copy, Download, Plus, ShoppingBasket, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { deleteShopping, insertPantry, insertShopping, listShopping, updateShopping } from '@/lib/client-data'
import type { ShoppingRowDb } from '@/lib/api-types'
import { CATEGORY_LABELS } from '@/lib/shopping/aggregate'
import { exactFood } from '@/lib/nutrition/catalog'
import type { ShoppingCategory, Unit } from '@/lib/nutrition/types'
import { useSession } from '@/lib/session'
import { Badge, Button, cx, EmptyState, ErrorBox, IconButton, Input, LinkButton, PageHeader, Select, Sheet, Skeleton, useToast } from '@/components/ui'

const fmtQ = (q: number | null, unit: string) => {
  if (q === null) return ''
  if (unit === 'g' && q >= 1000) return `${(Math.round(q / 100) / 10).toString().replace('.', ',')} kg`
  if (unit === 'ml' && q >= 1000) return `${(Math.round(q / 100) / 10).toString().replace('.', ',')} l`
  return `${Math.round(q * 10) / 10} ${unit === 'unidad' ? 'ud.' : unit}`
}

export default function ShoppingPage() {
  const { user, loading, configured } = useSession()
  const toast = useToast()
  const [rows, setRows] = useState<ShoppingRowDb[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('unidad')
  const [edit, setEdit] = useState<ShoppingRowDb | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  const load = useCallback(async () => {
    setError(null)
    const r = await listShopping()
    if (!r.ok) return setError(r.error)
    setRows(r.data.map((x) => ({ ...x, quantity: x.quantity === null ? null : Number(x.quantity) })))
  }, [])
  useEffect(() => {
    if (user) load()
  }, [user, load])

  const groups = useMemo(() => {
    const m = new Map<string, ShoppingRowDb[]>()
    for (const r of rows ?? []) {
      const k = r.category in CATEGORY_LABELS ? r.category : 'otros'
      m.set(k, [...(m.get(k) ?? []), r])
    }
    return [...m.entries()].sort((a, b) => CATEGORY_LABELS[a[0] as ShoppingCategory].localeCompare(CATEGORY_LABELS[b[0] as ShoppingCategory]))
  }, [rows])
  const pending = rows?.filter((r) => !r.checked).length ?? 0
  const checked = rows?.filter((r) => r.checked) ?? []

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const food = exactFood(name)
    const q = qty ? Number(qty.replace(',', '.')) : null
    const r = await insertShopping([{ name: name.trim(), quantity: q && q > 0 ? q : null, unit, category: food?.category ?? 'otros', item_key: null, source: 'manual' }])
    if (!r.ok) return toast(r.error, 'error')
    setRows((x) => [...(x ?? []), ...r.data])
    setName('')
    setQty('')
  }

  async function toggle(r: ShoppingRowDb) {
    setRows((x) => x!.map((y) => (y.id === r.id ? { ...y, checked: !y.checked } : y)))
    const res = await updateShopping(r.id, { checked: !r.checked })
    if (!res.ok) {
      toast(res.error, 'error')
      load()
    }
  }

  function asText() {
    return groups
      .map(([cat, items]) => `${CATEGORY_LABELS[cat as ShoppingCategory]}\n${items.filter((i) => !i.checked).map((i) => `- ${i.name}${i.quantity ? ` (${fmtQ(i.quantity, i.unit)})` : ''}`).join('\n')}`)
      .filter((block) => block.includes('- '))
      .join('\n\n')
  }

  async function share() {
    const text = `Lista de la compra (SNACKEATS)\n\n${asText()}`
    try {
      if (navigator.share) await navigator.share({ title: 'Lista de la compra', text })
      else {
        await navigator.clipboard.writeText(text)
        toast('Lista copiada al portapapeles')
      }
    } catch {
      /* cancelado */
    }
  }

  function exportFile() {
    const blob = new Blob([`Lista de la compra (SNACKEATS)\n\n${asText()}\n`], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `lista-compra-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Pasa lo comprado a la despensa y lo quita de la lista. */
  async function moveToPantry() {
    if (!checked.length) return
    const r = await insertPantry(
      checked.map((c) => {
        const key = c.item_key?.startsWith('f:') ? c.item_key.slice(2) : exactFood(c.name)?.key ?? null
        const u = (['g', 'kg', 'ml', 'l', 'unidad'].includes(c.unit) ? c.unit : 'unidad') as Unit
        return { name: c.name, food_key: key, quantity: c.quantity, unit: u, location: 'despensa' as const, status: 'disponible' as const, purchased_on: new Date().toISOString().slice(0, 10) }
      }),
    )
    if (!r.ok) return toast(r.error, 'error')
    const d = await deleteShopping(checked.map((c) => c.id))
    if (!d.ok) return toast(d.error, 'error')
    toast(`${checked.length} producto(s) pasados a la despensa`)
    load()
  }

  if (!loading && (!configured || !user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Lista de la compra" />
        <EmptyState icon={<ShoppingBasket className="h-6 w-6" aria-hidden />} title="Tu lista, siempre a mano" action={<LinkButton href="/entrar" variant="primary">Entrar o crear cuenta</LinkButton>}>
          Se genera desde tus recetas y tu plan semanal, restando lo que ya tienes en casa.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Lista de la compra" subtitle={rows ? `${pending} pendiente(s)` : undefined} />
      <p className="text-xs text-muted">No mostramos precios: no disponemos de datos de precios fiables para tu región.</p>

      <form onSubmit={add} className="grid grid-cols-[1fr_5rem_6.5rem_auto] gap-2">
        <Input aria-label="Producto" placeholder="Añadir producto" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
        <Input aria-label="Cantidad" inputMode="decimal" placeholder="Cant." value={qty} onChange={(e) => setQty(e.target.value)} />
        <Select aria-label="Unidad" value={unit} onChange={(e) => setUnit(e.target.value)}>
          <option value="unidad">ud.</option>
          <option value="g">g</option>
          <option value="kg">kg</option>
          <option value="ml">ml</option>
          <option value="l">l</option>
        </Select>
        <IconButton label="Añadir producto" type="submit" className="bg-saffron text-on-saffron hover:bg-saffron">
          <Plus className="h-5 w-5" aria-hidden />
        </IconButton>
      </form>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" icon={<Copy className="h-4 w-4" aria-hidden />} onClick={share} disabled={!pending}>
          Compartir
        </Button>
        <Button size="sm" variant="outline" icon={<Download className="h-4 w-4" aria-hidden />} onClick={exportFile} disabled={!pending}>
          Exportar .txt
        </Button>
        {checked.length > 0 && (
          <>
            <Button size="sm" variant="brand" onClick={moveToPantry}>
              Pasar {checked.length} comprado(s) a la despensa
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmClear(true)}>
              Quitar comprados
            </Button>
          </>
        )}
      </div>

      {error && <ErrorBox message={error} onRetry={load} />}
      {rows === null ? (
        <Skeleton className="h-72" />
      ) : rows.length === 0 ? (
        <EmptyState icon={<ShoppingBasket className="h-6 w-6" aria-hidden />} title="La lista está vacía" action={<LinkButton href="/plan" variant="outline">Ir al plan semanal</LinkButton>}>
          Añade productos arriba o genera la lista desde tu plan o una receta.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map(([cat, items]) => (
            <section key={cat} aria-labelledby={`cat-${cat}`} className="flex flex-col gap-1.5">
              <h2 id={`cat-${cat}`} className="label-caps text-muted">
                {CATEGORY_LABELS[cat as ShoppingCategory]}
              </h2>
              <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
                {items.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-1.5">
                    <button type="button" role="checkbox" aria-checked={r.checked} aria-label={`${r.checked ? 'Desmarcar' : 'Marcar'} ${r.name}`} onClick={() => toggle(r)} className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border-2 transition', r.checked ? 'border-ok bg-ok text-white' : 'border-line')}>
                      {r.checked && <Check className="h-4 w-4" aria-hidden strokeWidth={3} />}
                    </button>
                    <button type="button" className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-2 text-left" onClick={() => setEdit(r)}>
                      <span className={cx('truncate text-[15px]', r.checked && 'text-muted line-through')}>{r.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.source !== 'manual' && <Badge>{r.source === 'plan' ? 'plan' : 'receta'}</Badge>}
                        <span className="num text-sm font-semibold">{fmtQ(r.quantity, r.unit)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <EditSheet row={edit} onClose={() => setEdit(null)} onSaved={load} />
      <Sheet
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        title="¿Quitar los productos comprados?"
        footer={
          <Button
            variant="danger"
            block
            onClick={async () => {
              const d = await deleteShopping(checked.map((c) => c.id))
              setConfirmClear(false)
              if (!d.ok) return toast(d.error, 'error')
              load()
            }}
          >
            Quitar {checked.length}
          </Button>
        }
      >
        <p className="text-sm text-muted">Se eliminarán de la lista sin pasarlos a la despensa.</p>
      </Sheet>
    </div>
  )
}

function EditSheet({ row, onClose, onSaved }: { row: ShoppingRowDb | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [n, setN] = useState('')
  useEffect(() => {
    setQ(row?.quantity != null ? String(row.quantity) : '')
    setN(row?.name ?? '')
  }, [row])
  if (!row) return null
  return (
    <Sheet
      open
      onClose={onClose}
      title="Editar producto"
      footer={
        <div className="flex gap-2">
          <IconButton
            label="Eliminar producto"
            className="text-danger"
            onClick={async () => {
              const d = await deleteShopping([row.id])
              if (!d.ok) return toast(d.error, 'error')
              onClose()
              onSaved()
            }}
          >
            <Trash2 className="h-5 w-5" aria-hidden />
          </IconButton>
          <Button
            variant="primary"
            block
            onClick={async () => {
              const num = q ? Number(q.replace(',', '.')) : null
              const r = await updateShopping(row.id, { name: n.trim() || row.name, quantity: num !== null && Number.isFinite(num) && num >= 0 ? num : null })
              if (!r.ok) return toast(r.error, 'error')
              onClose()
              onSaved()
            }}
          >
            Guardar
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <Input aria-label="Nombre" value={n} onChange={(e) => setN(e.target.value)} maxLength={120} />
        <div className="flex items-center gap-2">
          <Input aria-label="Cantidad" inputMode="decimal" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="text-sm text-muted">{row.unit}</span>
        </div>
        {row.source !== 'manual' && <p className="text-xs text-muted">Generado desde {row.source === 'plan' ? 'tu plan' : 'una receta'}. Si regeneras la lista del plan, su cantidad se recalculará.</p>}
      </div>
    </Sheet>
  )
}
