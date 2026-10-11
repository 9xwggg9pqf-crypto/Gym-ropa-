# SNACKEATS

**Lo que tienes. Lo que te apetece. Lo que necesitas.**

Aplicación web progresiva (PWA, instalable en el móvil) de cocina con inteligencia artificial:

- Escanea tu nevera o despensa con una foto y confirma los ingredientes detectados.
- Genera recetas con lo que tienes, con pequeñas compras o a partir de un plato concreto.
- Ajusta las cantidades a objetivos de calorías y macronutrientes **por ración**, con un motor de cálculo determinista y datos públicos de USDA (la IA no inventa cifras nutricionales).
- Alergias, dietas y sustituciones con su efecto nutricional explicado.
- Despensa, plan semanal, lista de la compra, favoritas, colecciones, versiones e historial.
- Modo cocina paso a paso con temporizadores, lectura en voz alta y pantalla siempre encendida.
- Planes gratuito/Premium con límites de uso y pagos con Stripe (preparado, sin activar).

> Estado: **no está lista para producción**. Ver «Antes de lanzar al público».

---

## 1. Arquitectura

| Capa | Tecnología | Motivo |
|---|---|---|
| Interfaz | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3 | Web + PWA instalable, un solo código para móvil y escritorio |
| Servidor | Rutas API de Next.js (Node.js) | Las claves de IA y pagos nunca llegan al navegador |
| Base de datos y cuentas | Supabase (PostgreSQL + Auth) con **RLS** en todas las tablas | Cada usuario sólo puede leer/modificar sus datos, impuesto por la base de datos |
| IA | Anthropic Claude (`claude-opus-5-5` por defecto, configurable) con salida estructurada validada | Visión para el escáner y generación de recetas |
| Nutrición | Catálogo propio de 197 ingredientes extraído **por script** de USDA FoodData Central SR Legacy (dominio público) + API de FDC opcional + alimentos de etiqueta del usuario | Valores verificables con su FDC ID |
| Pagos | Stripe Checkout + portal de cliente + webhook firmado | El acceso Premium sólo se activa por webhook verificado |

Carpetas principales:

```
src/lib/nutrition/   motor determinista: unidades, cálculo, optimizador, alergias, sustituciones
src/lib/ai/          integración con Claude (escáner y recetas), esquemas y prompts
src/lib/recipes/     validación de recetas y enriquecimiento (nutrición + alergias + despensa)
src/lib/shopping/    agregación de la lista de la compra
src/app/             pantallas y rutas API
supabase/migrations/ esquema SQL, RLS, cuotas y límites por plan
supabase/tests/      pruebas de seguridad de la base de datos
scripts/             generación del catálogo USDA y pruebas de base de datos
```

### Cómo se calculan las calorías y los macros

1. La IA propone ingredientes y cantidades y asocia cada uno a una clave del catálogo (validada en el servidor; una clave inventada se descarta).
2. Las cantidades se convierten a gramos con pesos de porción y densidades **de USDA**; si se usa una aproximación (p. ej. «1 cucharada» sin dato), se marca.
3. Se suman los nutrientes de cada ingrediente según su peso y su estado (crudo, cocido, en seco...). Arroz crudo y cocido son alimentos distintos con valores distintos.
4. Si hay objetivos, un optimizador (descenso de gradiente proyectado con límites por ingrediente) ajusta las cantidades sin desfigurar el plato y comprueba si los objetivos son alcanzables, con tres estrategias: equilibrio, priorizar calorías o priorizar proteína.
5. La ficha muestra la precisión (alta / estimación / incompleto), sus causas y la fuente.

---

## 2. Puesta en marcha (sin programar)

Necesitas cuentas en: **Supabase** (gratis para empezar), **Anthropic** (API de pago por uso) y un alojamiento como **Vercel** (gratis para empezar). Stripe, USDA y Unsplash son opcionales.

### Paso 1 — Supabase
1. Crea un proyecto en <https://supabase.com>.
2. Abre **SQL Editor**, pega el contenido de `supabase/migrations/20261011000000_init.sql` y ejecútalo.
3. En **Authentication → Providers → Email** deja activado el email. En **Authentication → Sign In / Providers** activa **Anonymous sign-ins** (para el modo invitado).
4. Recomendado: activa **CAPTCHA** (Authentication → Attack Protection) para evitar que se creen cuentas de invitado en masa.
5. En **Authentication → URL Configuration** pon como *Site URL* la dirección pública de la app y añade `https://TU-DOMINIO/auth/callback` en *Redirect URLs*.
6. Copia de **Project Settings → API**: la URL, la clave `anon` y la clave `service_role` (esta última es secreta).

### Paso 2 — Anthropic
Crea una clave en <https://console.anthropic.com> → API Keys y añade saldo. Lee la sección de costes antes de abrir la app al público.

### Paso 3 — Desplegar en Vercel
1. Importa este repositorio en <https://vercel.com/new>.
2. En **Environment Variables** añade las variables de `.env.example` (como mínimo las de Supabase, `NEXT_PUBLIC_SITE_URL` y `ANTHROPIC_API_KEY`).
3. Despliega. Abre `/configuracion` en tu app para comprobar qué está conectado.

> Las rutas de IA declaran hasta 120 s de duración. Comprueba que el plan de tu alojamiento lo permite; si tu plan corta antes, la generación de recetas puede fallar por tiempo.

### Paso 4 (opcional) — Pagos con Stripe
1. En Stripe crea un producto «SNACKEATS Premium» con un precio mensual recurrente.
2. Ejecuta `supabase/seed-stripe.example.sql` cambiando `price_XXXX` por el ID del precio.
3. Crea un webhook a `https://TU-DOMINIO/api/stripe/webhook` con los eventos `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.paused`, `customer.subscription.resumed` e `invoice.payment_failed`.
4. Añade `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` en Vercel. Activa el portal de cliente en Stripe (Settings → Billing → Customer portal).
5. Prueba primero en **modo test** de Stripe.

### Entornos separados
Usa **dos proyectos de Supabase** (desarrollo y producción) y asigna sus variables a los entornos *Preview* y *Production* de Vercel. Usa claves de Stripe de test en *Preview*.

---

## 3. Desarrollo local

```bash
npm install
cp .env.example .env.local   # y rellena las claves
npm run dev                   # http://localhost:3000
```

Comprobaciones:

```bash
npm run typecheck   # tipos
npm run lint        # análisis estático
npm test            # 34 pruebas: motor nutricional, optimizador, alergias, compra, IA simulada, cuotas
npm run test:db     # pruebas de RLS/cuotas sobre PostgreSQL local (PGURL=postgres://...)
npm run build       # compilación de producción
npm run test:e2e    # 32 pruebas en navegador (móvil y escritorio oscuro): accesibilidad axe WCAG 2.1 AA,
                    # sin desbordamiento horizontal, sin errores JS, casos D y E en la interfaz real
```

Regenerar el catálogo nutricional (sólo si cambias `scripts/catalog-def.mjs`):

```bash
# Descarga y descomprime https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip
USDA_DIR=/ruta/FoodData_Central_sr_legacy_food_csv_2018-04 npm run foods:build
```

---

## 4. Qué está probado y cómo

| Caso | Cómo se verifica | Resultado |
|---|---|---|
| A. Receta con ingredientes de una foto | Flujo escáner → confirmación → generación implementado; la parte de IA probada con respuestas simuladas | Pendiente de prueba real con clave de Anthropic |
| B. 650 kcal + proteína | `nutrition.test.ts`: cumple con valores recalculados; caso inalcanzable explicado con sugerencias; 3 estrategias | Pasa |
| C. Espaguetis a la boloñesa con objetivo | `nutrition.test.ts`: 750 kcal / ≥40 g manteniendo la pasta en un rango razonable; límite estricto de grasa | Pasa |
| D. Pollo 100 → 150 g | `nutrition.test.ts`: 120 → 180 kcal, 22,5 → 33,75 g (USDA FDC 171077); `e2e/smoke.spec.ts`: la ficha se recalcula al pulsar «+» | Pasa |
| E. 2 → 4 raciones | `nutrition.test.ts`, `aggregate.test.ts` y `e2e/smoke.spec.ts`: cantidades ×2, valores por ración iguales, lista de la compra actualizada | Pasa |
| F. Ingrediente no identificado | `ai.test.ts`: va a «sin identificar», las claves inventadas no se usan, lo dudoso exige confirmación | Pasa (con respuesta simulada) |
| G. Alergia | `nutrition.test.ts` + `ai.test.ts`: bloqueo, «puede contener», sustituciones sin riesgo equivalente, recetas descartadas en el servidor | Pasa |
| H. Guardar y recuperar | `rls_test.sql`: la receta y el perfil persisten para su dueño | Pasa (en PostgreSQL local con un stub de Supabase) |
| I. Fallo de la IA | `ai.test.ts` + `api.test.ts`: error claro, sin resultados inventados, cuota devuelta, reintento | Pasa (simulado) |
| J. Seguridad de datos | `rls_test.sql`: otro usuario no puede leer, modificar, borrar ni enlazar datos ajenos; no puede activarse Premium ni tocar cuotas; anon sin acceso; borrado en cascada | Pasa (en PostgreSQL local) |

Accesibilidad: las 14 pantallas principales pasan axe (WCAG 2.1 AA) sin incidencias graves en móvil (modo claro) y escritorio (modo oscuro). Eso no sustituye una prueba con personas usuarias y lectores de pantalla.

Lo que **no** se ha podido probar en este entorno: llamadas reales a Claude (no había clave), autenticación real de Supabase (se probó el esquema y RLS en PostgreSQL local, no el servicio Supabase), pagos reales de Stripe, instalación como PWA en dispositivos físicos, lectores de pantalla reales.

---

## 5. Costes recurrentes (estimación a revisar)

- **Anthropic** (pago por uso). Precios de lista por millón de tokens (entrada/salida): Opus 5.5 4 $/20 $, Sonnet 5.5 2 $/10 $, Haiku 5.5 0,10 $/0,50 $. Estimación aproximada, **no medida**: una generación de recetas con Opus 5.5 puede rondar 0,08–0,15 $ (unos 3.600 tokens de entrada y 3.500–6.500 de salida, porque el razonamiento interno del modelo cuenta como salida) y un escaneo 0,03–0,05 $. Con esas cifras, los límites provisionales de Premium (150 + 150 generaciones) podrían costar más que la cuota de 4,99 €. **Antes de fijar precios**: mide el coste real con la consulta de `supabase/seed-stripe.example.sql` (la app guarda los tokens de cada llamada), y decide entre bajar límites, subir precio o probar un modelo más barato con `ANTHROPIC_MODEL`.
- **Supabase**: plan gratuito para empezar; para producción, un plan de pago con copias de seguridad.
- **Vercel**: plan gratuito para pruebas; para uso comercial, un plan de pago (además, el tiempo máximo de las funciones depende del plan).
- **Stripe**: comisión por transacción.
- USDA FoodData Central y su API: gratuitos. Unsplash: gratuito con límites y atribución obligatoria.

---

## 6. Antes de lanzar al público

- [ ] Configurar Supabase, Anthropic y alojamiento; probar todos los flujos con datos reales.
- [ ] Medir el coste real de la IA y ajustar límites y precios (tabla `plans`, sin tocar código).
- [ ] Activar CAPTCHA en Supabase y revisar los límites de envío de emails (configurar SMTP propio).
- [ ] Revisar con un profesional la **política de privacidad** y los **términos** (son borradores) y completar los datos del responsable. Las alergias pueden ser datos de salud (RGPD art. 9).
- [ ] Contratar un plan con copias de seguridad y definir la recuperación ante desastres.
- [ ] Añadir monitorización de errores (el registro técnico está centralizado en `src/lib/log.ts` y no guarda datos personales).
- [ ] Prueba de accesibilidad con lectores de pantalla (VoiceOver/TalkBack) y auditoría Lighthouse.
- [ ] Revisar con un dietista-nutricionista los textos y el catálogo; ampliar el catálogo con productos habituales en España (USDA es una base estadounidense).
- [ ] Completar la traducción al inglés (hoy sólo navegación y textos comunes).
- [ ] Integraciones de salud (Apple Health / Health Connect): no implementadas; requieren app nativa.

## 7. Licencias de datos

Datos nutricionales: USDA, Agricultural Research Service, FoodData Central (SR Legacy, 2018), dominio público (CC0 1.0). Fotos opcionales: Unsplash, con atribución.
