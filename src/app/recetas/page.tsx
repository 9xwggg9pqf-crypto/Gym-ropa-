'use client'
import { BookOpen, FolderPlus, History, Search, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { addToCollection, clearHistory, createCollection, deleteCollection, deleteHistory, listCollections, listHistory, listRecipes, removeFromCollection } from '@/lib/client-data'
import type { RecipeRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { RecipeCard } from '@/components/recipe/RecipeCard'
import { Button, Chip, EmptyState, ErrorBox, IconButton, Input, LinkButton, PageHeader, Select, Sheet, Skeleton, Tabs, useToast } from '@/components/ui'

type Tab = 'todas' | 'favoritas' | 'colecciones' | 'historial'

export default function RecipesPage() {
  const { user, loading: sLoading, configured } = useSession()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('todas')
  const [rows, setRows] = useState<RecipeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [maxTime, setMaxTime] = useState('')
  const [minProtein, setMinProtein] = useState('')
  const [maxKcal, setMaxKcal] = useState('')
  const [collections, setCollections] = useState<{ id: string; name: string; collection_recipes: { recipe_id: string }[] }[]>([])
  const [activeCol, setActiveCol] = useState<string | null>(null)
  const [history, setHistory] = useState<{ id: string; query: string; kind: string; created_at: string }[]>([])
  const [newCol, setNewCol] = useState('')
  const [assign, setAssign] = useState<RecipeRow | null>(null)

  async function load() {
    setError(null)
    const [r, c, h] = await Promise.all([listRecipes(), listCollections(), listHistory()])
    if (!r.ok) return setError(r.error)
    setRows(r.data)
    if (c.ok) setCollections(c.data)
    if (h.ok) setHistory(h.data)
  }
  useEffect(() => {
    if (user) load()
  }, [user])

  const filtered = useMemo(() => {
    if (!rows) return []
    const nq = q.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab === 'favoritas' && !r.is_favorite) return false
      if (tab === 'colecciones' && activeCol && !collections.find((c) => c.id === activeCol)?.collection_recipes.some((x) => x.recipe_id === r.id)) return false
      if (nq && !r.title.toLowerCase().includes(nq) && !r.data.ingredients.some((i) => i.name.toLowerCase().includes(nq))) return false
      if (maxTime && r.data.prepMinutes + r.data.cookMinutes > Number(maxTime)) return false
      if (minProtein && (r.protein_per_serving ?? 0) < Number(minProtein)) return false
      if (maxKcal && (r.kcal_per_serving ?? Infinity) > Number(maxKcal)) return false
      return true
    })
  }, [rows, q, tab, activeCol, collections, maxTime, minProtein, maxKcal])

  if (!sLoading && (!configured || !user)) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Mis recetas" />
        <EmptyState icon={<BookOpen className="h-6 w-6" aria-hidden />} title="Guarda tus recetas en tu cuenta" action={<LinkButton href="/entrar" variant="primary">Entrar o crear cuenta</LinkButton>}>
          Crea una receta y guárdala: la tendrás disponible en cualquier dispositivo.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Mis recetas" subtitle={rows ? `${rows.length} receta(s) guardadas` : undefined} action={<LinkButton href="/crear" variant="primary">Nueva receta</LinkButton>} />
      <Tabs label="Secciones de recetas" value={tab} onChange={setTab} items={[{ value: 'todas', label: 'Todas' }, { value: 'favoritas', label: 'Favoritas' }, { value: 'colecciones', label: 'Colecciones' }, { value: 'historial', label: 'Historial' }]} />
      {error && <ErrorBox message={error} onRetry={load} />}

      {tab === 'historial' ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-muted">Tus últimas búsquedas y escaneos (sólo el texto, nunca las fotos).</p>
          {history.length === 0 ? (
            <EmptyState icon={<History className="h-6 w-6" aria-hidden />} title="Sin historial" />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line rounded-2xl border border-line bg-surface">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center justify-between gap-3 px-3 py-2">
                    <Link href={h.kind === 'scan' ? '/escanear' : `/crear?modo=${h.kind === 'dish' ? 'plato_concreto' : 'solo_lo_que_tengo'}&q=${encodeURIComponent(h.query)}`} className="min-w-0 flex-1">
                      <span className="block truncate text-[15px]">{h.query}</span>
                      <span className="text-xs text-muted">{new Date(h.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                    </Link>
                    <IconButton
                      label="Eliminar del historial"
                      onClick={async () => {
                        const r = await deleteHistory(h.id)
                        if (r.ok) setHistory((x) => x.filter((y) => y.id !== h.id))
                        else toast(r.error, 'error')
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <Button
                variant="ghost"
                className="self-start"
                onClick={async () => {
                  if (!user) return
                  const r = await clearHistory(user.id)
                  if (r.ok) setHistory([])
                  else toast(r.error, 'error')
                }}
              >
                Borrar todo el historial
              </Button>
            </>
          )}
        </section>
      ) : (
        <>
          {tab === 'colecciones' && (
            <section className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                <Chip active={!activeCol} onClick={() => setActiveCol(null)}>
                  Todas
                </Chip>
                {collections.map((c) => (
                  <Chip key={c.id} active={activeCol === c.id} onClick={() => setActiveCol(c.id)}>
                    {c.name} <span className="num text-xs opacity-70">{c.collection_recipes.length}</span>
                  </Chip>
                ))}
              </div>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!newCol.trim()) return
                  const r = await createCollection(newCol.trim())
                  if (!r.ok) return toast(r.error, 'error')
                  setNewCol('')
                  load()
                }}
              >
                <Input aria-label="Nombre de la nueva colección" placeholder="Nueva colección (p. ej. Tuppers semana)" value={newCol} maxLength={60} onChange={(e) => setNewCol(e.target.value)} />
                <Button type="submit" variant="outline" icon={<FolderPlus className="h-4 w-4" aria-hidden />}>
                  Crear
                </Button>
              </form>
              {activeCol && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start text-danger"
                  onClick={async () => {
                    const r = await deleteCollection(activeCol)
                    if (!r.ok) return toast(r.error, 'error')
                    setActiveCol(null)
                    load()
                  }}
                >
                  Eliminar esta colección (las recetas no se borran)
                </Button>
              )}
            </section>
          )}

          <section className="flex flex-col gap-3" aria-label="Filtros">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
              <Input aria-label="Buscar en mis recetas" placeholder="Buscar por nombre o ingrediente" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <Select aria-label="Tiempo máximo" value={maxTime} onChange={(e) => setMaxTime(e.target.value)}>
                <option value="">Cualquier tiempo</option>
                <option value="15">≤ 15 min</option>
                <option value="30">≤ 30 min</option>
                <option value="60">≤ 60 min</option>
              </Select>
              <Select aria-label="Proteína mínima por ración" value={minProtein} onChange={(e) => setMinProtein(e.target.value)}>
                <option value="">Proteína</option>
                <option value="20">≥ 20 g</option>
                <option value="30">≥ 30 g</option>
                <option value="40">≥ 40 g</option>
              </Select>
              <Select aria-label="Calorías máximas por ración" value={maxKcal} onChange={(e) => setMaxKcal(e.target.value)}>
                <option value="">Calorías</option>
                <option value="400">≤ 400 kcal</option>
                <option value="600">≤ 600 kcal</option>
                <option value="800">≤ 800 kcal</option>
              </Select>
            </div>
          </section>

          {rows === null ? (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-56" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<BookOpen className="h-6 w-6" aria-hidden />} title={rows.length ? 'Ninguna receta coincide' : 'Aún no has guardado recetas'} action={!rows.length ? <LinkButton href="/crear" variant="primary">Crear la primera</LinkButton> : undefined}>
              {rows.length ? 'Prueba a quitar algún filtro.' : 'Las recetas que guardes aparecerán aquí.'}
            </EmptyState>
          ) : (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {filtered.map((r) => (
                <div key={r.id} className="flex flex-col gap-1">
                  <RecipeCard href={`/recetas/${r.id}`} recipe={r.data} kcal={r.kcal_per_serving} protein={r.protein_per_serving} favorite={r.is_favorite} imageUrl={r.image_url} badge={r.version > 1 ? `Versión ${r.version}` : undefined} />
                  <button type="button" className="self-start px-1 text-xs font-semibold text-muted hover:text-ink" onClick={() => setAssign(r)}>
                    Colecciones…
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Sheet open={Boolean(assign)} onClose={() => setAssign(null)} title={`Colecciones de «${assign?.title ?? ''}»`}>
        {collections.length === 0 ? (
          <p className="text-sm text-muted">Crea una colección en la pestaña «Colecciones».</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {collections.map((c) => {
              const inside = assign ? c.collection_recipes.some((x) => x.recipe_id === assign.id) : false
              return (
                <li key={c.id}>
                  <label className="flex items-center gap-3 rounded-xl border border-line p-3">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-[rgb(var(--brand))]"
                      checked={inside}
                      onChange={async () => {
                        if (!assign) return
                        const r = inside ? await removeFromCollection(c.id, assign.id) : await addToCollection(c.id, assign.id)
                        if (!r.ok) return toast(r.error, 'error')
                        load()
                      }}
                    />
                    {c.name}
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>
    </div>
  )
}
