# Pro Play — Landing de marca

Landing page de presentación para **Pro Play**, marca de ropa de gimnasio.
Construida con [Next.js](https://nextjs.org), TypeScript y Tailwind CSS.
Todavía no incluye tienda online (sin carrito ni pagos).

## Cómo editar el contenido (sin tocar código)

Casi todos los textos de la web viven en `src/data/`:

- `src/data/site.ts` — marca, eslogan del hero, textos de "la marca",
  valores, newsletter, redes sociales y pie de página.
- `src/data/products.ts` — lista de productos destacados (nombre,
  categoría, precio, etiqueta).
- `src/data/gallery.ts` — leyendas de la galería lifestyle.

Edita esos archivos, guarda, y la web se actualiza sola en desarrollo.
Las imágenes de producto/galería son marcadores de posición (bloques con
rayas rojas) hasta que subas fotos reales — el componente que los genera
está en `src/components/ui/PlaceholderImage.tsx`.

## Desarrollo

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Estructura del proyecto

```
src/
  app/            → layout, página principal y estilos globales
  components/
    layout/       → Header y Footer
    sections/     → Hero, Productos, Sobre la marca, Galería
    ui/           → botones, tarjetas, formulario de newsletter, etc.
  data/           → contenido editable (textos, productos, galería)
```

## Producción

```bash
npm run build
npm run start
```
