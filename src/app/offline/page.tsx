export const metadata = { title: 'Sin conexión' }

export default function OfflinePage() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <h1 className="font-display text-2xl font-semibold">Sin conexión</h1>
      <p className="max-w-sm text-muted">SNACKEATS necesita internet para cargar tus datos y usar la IA. Vuelve a intentarlo cuando recuperes la conexión.</p>
    </div>
  )
}
