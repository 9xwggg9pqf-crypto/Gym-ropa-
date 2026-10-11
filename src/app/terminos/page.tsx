export const metadata = { title: 'Términos de uso' }

export default function TermsPage() {
  return (
    <article className="flex max-w-prose flex-col gap-4 text-[15px] leading-relaxed">
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm font-semibold">BORRADOR. Debe revisarlo un profesional del derecho antes del lanzamiento.</p>
      <h1 className="font-display text-2xl font-semibold">Términos de uso de SNACKEATS</h1>
      <h2 className="font-display text-lg font-semibold">El servicio</h2>
      <p>SNACKEATS propone recetas generadas con inteligencia artificial y estima su valor nutricional con datos públicos (USDA FoodData Central). Las cifras son estimaciones orientativas y pueden diferir de la realidad según los productos, el peso real y la forma de cocinar.</p>
      <h2 className="font-display text-lg font-semibold">No es consejo médico</h2>
      <p>SNACKEATS no realiza diagnósticos ni sustituye a un médico o dietista-nutricionista. Si tienes una condición de salud, consulta a un profesional.</p>
      <h2 className="font-display text-lg font-semibold">Alergias y seguridad alimentaria</h2>
      <p>Aplicamos tus alergias declaradas al generar y revisar recetas, pero no podemos garantizar la ausencia de alérgenos, trazas ni contaminación cruzada. Revisa siempre las etiquetas de los productos. Sigue prácticas seguras de manipulación y cocción; no consumas alimentos en mal estado.</p>
      <h2 className="font-display text-lg font-semibold">Uso aceptable</h2>
      <p>No se permite automatizar peticiones, eludir los límites de uso ni usar el servicio para fines ilícitos. Podemos limitar o suspender cuentas que abusen del servicio.</p>
      <h2 className="font-display text-lg font-semibold">Suscripciones</h2>
      <p>Premium se renueva automáticamente hasta que lo canceles desde tu perfil; conservarás el acceso hasta el final del periodo pagado. [Completar: derecho de desistimiento, reembolsos, impuestos.]</p>
      <h2 className="font-display text-lg font-semibold">Contacto</h2>
      <p>[email de contacto]</p>
    </article>
  )
}
