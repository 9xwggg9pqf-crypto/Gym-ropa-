'use client'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getRecipe, listVersions } from '@/lib/client-data'
import type { RecipeRow } from '@/lib/api-types'
import { computeNutrition } from '@/lib/nutrition/compute'
import { Badge, EmptyState, ErrorBox, PageHeader, Select, Skeleton } from '@/components/ui'
import { GitCompare } from 'lucide-react'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const f = (v: number | null) => (v === null ? '—' : Math.round(v * 10) / 10)

export default function VersionsPage() {
  const { id } = useParams<{ id: string }>()
  const [versions, setVersions] = useState<RecipeRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [a, setA] = useState<string>('')
  const [b, setB] = useState<string>('')

  useEffect(() => {
    if (!UUID.test(id)) return setError('Enlace no válido.')
    getRecipe(id).then(async (r) => {
      if (!r.ok) return setError(r.error)
      const root = r.data.parent_id ?? r.data.id
      if (!UUID.test(root)) return setError('Enlace no válido.')
      const v = await listVersions(root)
      if (!v.ok) return setError(v.error)
      setVersions(v.data)
      setA(v.data[0]?.id ?? '')
      setB(v.data[v.data.length - 1]?.id ?? '')
    })
  }, [id])

  if (error) return <ErrorBox message={error} />
  if (!versions) return <Skeleton className="h-80" />
  if (versions.length < 2) {
    return (
      <div className="flex flex-col gap-4">
        <Link href={`/recetas/${id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Volver
        </Link>
        <EmptyState icon={<GitCompare className="h-6 w-6" aria-hidden />} title="Sólo hay una versión">
          Edita la receta y pulsa «Guardar como versión» para poder compararlas.
        </EmptyState>
      </div>
    )
  }
  const va = versions.find((v) => v.id === a)!
  const vb = versions.find((v) => v.id === b)!
  const na = computeNutrition(va.data.ingredients, va.data.servings).perServing
  const nb = computeNutrition(vb.data.ingredients, vb.data.servings).perServing
  const names = [...new Set([...va.data.ingredients.map((i) => i.name), ...vb.data.ingredients.map((i) => i.name)])]
  const qty = (r: RecipeRow, name: string) => {
    const i = r.data.ingredients.find((x) => x.name === name)
    return i ? `${Math.round(i.quantity * 10) / 10} ${i.unit}` : '—'
  }
  const opts = versions.map((v) => (
    <option key={v.id} value={v.id}>
      Versión {v.version} · {new Date(v.created_at).toLocaleDateString('es-ES')}
    </option>
  ))
  return (
    <div className="flex flex-col gap-5">
      <Link href={`/recetas/${id}`} className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-muted">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Volver
      </Link>
      <PageHeader title="Comparar versiones" subtitle={va.title} />
      <div className="grid grid-cols-2 gap-3">
        <Select aria-label="Versión A" value={a} onChange={(e) => setA(e.target.value)}>
          {opts}
        </Select>
        <Select aria-label="Versión B" value={b} onChange={(e) => setB(e.target.value)}>
          {opts}
        </Select>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="num w-full min-w-[480px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-muted">
              <th className="p-3 font-medium">Por ración</th>
              <th className="p-3 font-medium">Versión {va.version}</th>
              <th className="p-3 font-medium">Versión {vb.version}</th>
              <th className="p-3 font-medium">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => {
              const d = (nb[k] ?? 0) - (na[k] ?? 0)
              return (
                <tr key={k} className="border-b border-line">
                  <td className="p-3 font-medium">{{ kcal: 'Calorías', protein: 'Proteínas', carbs: 'Hidratos', fat: 'Grasas' }[k]}</td>
                  <td className="p-3">{f(na[k])}</td>
                  <td className="p-3">{f(nb[k])}</td>
                  <td className="p-3">{Math.abs(d) < 0.5 ? <Badge>igual</Badge> : <Badge tone={d > 0 ? 'brand' : 'saffron'}>{d > 0 ? '+' : ''}{f(d)}</Badge>}</td>
                </tr>
              )
            })}
            <tr>
              <td colSpan={4} className="bg-sunken p-2 text-xs font-semibold text-muted">
                Ingredientes (receta completa)
              </td>
            </tr>
            {names.map((n) => {
              const qa = qty(va, n)
              const qb = qty(vb, n)
              return (
                <tr key={n} className="border-b border-line last:border-0">
                  <td className="p-3">{n}</td>
                  <td className="p-3">{qa}</td>
                  <td className="p-3">{qb}</td>
                  <td className="p-3">{qa === qb ? '' : <Badge tone="warn">cambia</Badge>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
