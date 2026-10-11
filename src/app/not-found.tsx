import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <p className="font-display text-5xl font-bold text-saffron-ink">404</p>
      <h1 className="font-display text-2xl font-semibold">Esta página no existe</h1>
      <Link href="/" className="font-semibold text-brand-ink underline">
        Volver al inicio
      </Link>
    </div>
  )
}
