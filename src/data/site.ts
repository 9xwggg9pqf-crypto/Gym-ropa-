// Contenido general de la marca. Edita los textos aquí para actualizar la web.

export const siteConfig = {
  brand: "PRO PLAY",
  domain: "proplay.com",
  description:
    "Ropa técnica de gym para quienes entrenan con disciplina y no negocian el esfuerzo.",

  nav: [
    { label: "Productos", href: "#productos" },
    { label: "La Marca", href: "#marca" },
    { label: "Galería", href: "#galeria" },
    { label: "Contacto", href: "#newsletter" },
  ],

  hero: {
    kicker: "NUEVA TEMPORADA",
    title: "PRO PLAY",
    subtitle: "ROPA PARA LOS QUE NO SE RINDEN",
    slogan: "DISCIPLINA. FUERZA. SUPERACIÓN.",
    ctaLabel: "VER COLECCIÓN",
    ctaHref: "#productos",
    secondaryLabel: "CONOCE LA MARCA",
    secondaryHref: "#marca",
  },

  about: {
    kicker: "SOBRE LA MARCA",
    title: "NO NACIMOS EN UN DESPACHO. NACIMOS EN EL GIMNASIO.",
    paragraphs: [
      "Pro Play empezó con una idea simple: la ropa de entrenamiento tiene que aguantar el mismo nivel de exigencia que tú te impones cada día. Sin excusas, sin atajos.",
      "Diseñamos cada prenda pensando en quienes entienden que el progreso se construye repetición a repetición, serie a serie. Materiales técnicos, cortes pensados para moverte sin límites y una estética que no pide perdón.",
      "No vendemos ropa. Vendemos una mentalidad.",
    ],
    values: [
      {
        title: "DISCIPLINA",
        description:
          "Presentarte cuando nadie más lo haría. Cada día cuenta.",
        icon: "dumbbell",
      },
      {
        title: "RENDIMIENTO",
        description:
          "Prendas diseñadas para exigir al máximo sin límites de movimiento.",
        icon: "flame",
      },
      {
        title: "SUPERACIÓN",
        description: "El único rival que importa es quien eras ayer.",
        icon: "target",
      },
    ],
  },

  gallery: {
    kicker: "LIFESTYLE",
    title: "VIVE EL ENTRENAMIENTO",
    subtitle:
      "Fotos reales próximamente. Este espacio muestra dónde vivirá tu contenido de gimnasio.",
  },

  newsletter: {
    title: "ÚNETE AL EQUIPO",
    subtitle:
      "Sé el primero en enterarte del lanzamiento de la tienda, nuevas colecciones y ofertas exclusivas.",
    placeholder: "tu@email.com",
    buttonLabel: "SUSCRIBIRME",
    successMessage: "Estás dentro. Te avisaremos en cuanto lancemos.",
    disclaimer: "Sin spam. Solo lanzamientos y novedades de entrenamiento.",
  },

  social: [
    { label: "Instagram", href: "https://instagram.com", icon: "instagram" },
    { label: "TikTok", href: "https://tiktok.com", icon: "tiktok" },
    { label: "YouTube", href: "https://youtube.com", icon: "youtube" },
  ],

  footer: {
    tagline: "ROPA PARA LOS QUE NO SE RINDEN.",
    copyright: `© ${new Date().getFullYear()} Pro Play. Todos los derechos reservados.`,
    note: "Tienda online próximamente.",
  },
} as const;
