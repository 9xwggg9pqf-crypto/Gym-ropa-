'use client'
import { ErrorBox } from '@/components/ui'

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return <ErrorBox title="Algo ha fallado al mostrar esta pantalla" message="Puedes reintentarlo. Si se repite, recarga la página." onRetry={reset} />
}
