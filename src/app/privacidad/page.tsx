export const metadata = { title: 'Política de privacidad' }

export default function PrivacyPage() {
  return (
    <article className="flex max-w-prose flex-col gap-4 text-[15px] leading-relaxed">
      <p className="rounded-2xl border border-warn/40 bg-warn/10 p-3 text-sm font-semibold">BORRADOR. Este texto es una base de trabajo y debe revisarlo un profesional del derecho antes del lanzamiento. Los datos entre corchetes deben completarse.</p>
      <h1 className="font-display text-2xl font-semibold">Política de privacidad de SNACKEATS</h1>
      <h2 className="font-display text-lg font-semibold">Responsable</h2>
      <p>[Nombre o razón social], [NIF], [dirección], contacto: [email de privacidad].</p>
      <h2 className="font-display text-lg font-semibold">Qué datos tratamos y para qué</h2>
      <ul className="list-disc pl-5">
        <li>Cuenta: email (o cuenta anónima de invitado) para identificarte y guardar tus datos.</li>
        <li>Perfil opcional: alias, idioma, región, preferencias, alergias, intolerancias, dieta y objetivos nutricionales, para adaptar las recetas. Las alergias e intolerancias pueden considerarse datos de salud: sólo se guardan si las introduces y puedes borrarlas cuando quieras.</li>
        <li>Recetas, colecciones, despensa, plan semanal, lista de la compra, alimentos propios e historial de búsquedas (texto).</li>
        <li>Fotos del escáner: se envían al proveedor de IA para identificar alimentos y no se almacenan en SNACKEATS.</li>
        <li>Registros de uso de IA (tipo de operación, modelo y tokens, sin contenido) para aplicar límites y controlar costes.</li>
        <li>Pagos: los gestiona Stripe; SNACKEATS no ve ni guarda los datos de tu tarjeta.</li>
      </ul>
      <h2 className="font-display text-lg font-semibold">Base legal</h2>
      <p>Ejecución del contrato (prestar el servicio), consentimiento explícito para datos de salud que decidas facilitar y para la personalización con tus favoritas, e interés legítimo para la seguridad y la prevención de abusos. [Revisar y completar.]</p>
      <h2 className="font-display text-lg font-semibold">Encargados del tratamiento</h2>
      <ul className="list-disc pl-5">
        <li>Supabase (base de datos y autenticación) — región: [completar].</li>
        <li>Anthropic (procesamiento por IA de texto e imágenes) — según sus condiciones comerciales de API, que deben revisarse respecto a conservación y uso de datos.</li>
        <li>Stripe (pagos) y [proveedor de alojamiento, p. ej. Vercel].</li>
      </ul>
      <p>Algunos proveedores pueden tratar datos fuera del Espacio Económico Europeo con las garantías adecuadas. [Completar con las garantías aplicables.]</p>
      <h2 className="font-display text-lg font-semibold">Conservación</h2>
      <p>Mientras mantengas tu cuenta. Al eliminarla, se borran tus datos de la base de datos de SNACKEATS. [Indicar plazos de copias de seguridad.]</p>
      <h2 className="font-display text-lg font-semibold">Tus derechos</h2>
      <p>Puedes acceder, rectificar, exportar (desde Perfil → Exportar mis datos) y suprimir tus datos (Perfil → Eliminar mi cuenta), así como oponerte o limitar el tratamiento y reclamar ante la autoridad de control (en España, la AEPD).</p>
      <h2 className="font-display text-lg font-semibold">Entrenamiento de modelos</h2>
      <p>SNACKEATS no utiliza tus fotos ni tus datos para entrenar modelos de IA.</p>
    </article>
  )
}
