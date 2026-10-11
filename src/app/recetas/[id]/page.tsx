'use client'
import { ArrowLeft, GitCompare, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { deleteRecipe, getRecipe } from '@/lib/client-data'
import type { RecipeRow } from '@/lib/api-types'
import { useSession } from '@/lib/session'
import { RecipeView } from '@/components/recipe/RecipeView'
import { Button, ErrorBox, Sheet, Skeleton, useToast } from '@/components/ui'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export default function SavedRecipePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const toast = useToast()
  const { user, loading } = useSession()
  const [row, setRow] = useState<RecipeRow | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!UUID.test(id)) return setError('El enlace de la receta no es válido.')
    if (!user) return setError('Entra en tu cuenta para ver tus recetas.')
    getRecipe(id).then((r) => (r.ok ? setRow(r.data) : setError('No encontramos esta receta en tu cuenta.')))
  }, [id, user, loading])

  if (error) return <ErrorBox message={error} action={<Button size="sm" onClick={() => router.push(user ? '/recetas' : '/entrar')}>{user ? 'Mis recetas' : 'Entrar'}</Button>} />
  if (!row) return <Skeleton className="h-96" />

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/recetas" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Mis recetas
        </Link>
        <div className="flex gap-1">
          <Link href={`/recetas/${row.id}/versiones`} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted hover:bg-sunken hover:text-ink">
            <GitCompare className="h-4 w-4" aria-hidden /> Versiones
          </Link>
          <button type="button" onClick={() => setConfirm(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger/10">
            <Trash2 className="h-4 w-4" aria-hidden /> Eliminar
          </button>
        </div>
      </div>
      <RecipeView key={row.updated_at} initial={row.data} initialTargets={row.targets} saved={row} cookHref={`/recetas/${row.id}/cocinar`} />
      <Sheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="¿Eliminar esta receta?"
        footer={
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Cancelar
            </Button>
            <Button
              variant="danger"
              block
              onClick={async () => {
                const r = await deleteRecipe(row.id)
                if (!r.ok) return toast(r.error, 'error')
                toast('Receta eliminada')
                router.push('/recetas')
              }}
            >
              Eliminar
            </Button>
          </div>
        }
      >
        <p className="text-sm text-muted">Se eliminará de tu cuenta y de tu plan semanal. Las versiones derivadas se conservan.</p>
      </Sheet>
    </div>
  )
}
