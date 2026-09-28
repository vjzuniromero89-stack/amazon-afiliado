# Amazon Affiliate Command

Aplicación Next.js App Router + Supabase, preparada para Vercel. Interfaz en español con las diez áreas solicitadas. Flujo predeterminado: **generar → revisar → aprobar → programar → publicar → medir**.

## Qué incluye

- Dashboard, Products, Discover, Pin Studio, Approval Queue, Scheduler, Published, Analytics, AI Insights y Settings.
- Entrada por URL HTTPS de Amazon o ASIN. Nombre, categoría y hechos introducidos por el usuario; no hace scraping ni inventa precios, reseñas o disponibilidad.
- OAuth de Pinterest en el servidor, estado de un solo uso vinculado a usuario y cookie HttpOnly, tokens cifrados con AES-256-GCM, renovación con bloqueo entre procesos, sincronización paginada y creación de boards.
- Tres conceptos por generación: título, descripción, keywords, alt text, CTA, board sugerido y plantilla. Generador por plantillas sin clave de IA; generación de texto mediante OpenAI opcional. Edición y creación manual, rechazo y aprobación por versión.
- Tres plantillas tipográficas PNG de **1000 × 1500**, con disclosure. Se generan en servidor y se pueden descargar. No simulan fotos del producto. Interfaz `ImageProvider` preparada para sustituirlas por un proveedor de imagen; este proveedor futuro no está conectado.
- Publicación real por `POST /v5/pins`, con enlace afiliado canónico e imagen base64. No publica hasta que conectes las cuentas y programes un Pin aprobado.
- Cola persistente: límites por día UTC, intervalo mínimo, bloqueo por cuenta, protección contra doble claim, siete días sin repetir producto en un mismo board y reconciliación de resultados inciertos.
- Métricas diarias reales: impresiones, guardados y clics salientes; CTR derivado, filtros de 7/30 días y agregación por producto, plantilla, board y hora de publicación. AI Insights usa reglas descriptivas, muestra la muestra disponible y no infiere ventas ni comisiones.
- Migración con RLS, relaciones compuestas que impiden vínculos entre usuarios y auditoría transaccional. El navegador tiene lectura limitada por propietario; todas las mutaciones pasan por el servidor autenticado.

## 1. Ejecutar la interfaz

Requisitos: Node.js 22 o superior y npm. Versiones fijadas en `package.json` y `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

En PowerShell, sustituye `cp` por `Copy-Item .env.example .env.local` si lo prefieres. Abre `http://localhost:3000`. Sin variables, la interfaz muestra el estado inicial y permite explorar las secciones; **no guarda datos, no simula conexiones y no publica**. Para una compilación de producción:

```sh
npm run build
npm start
```

## 2. Crear y configurar Supabase

1. Crea un proyecto dedicado en [Supabase](https://supabase.com/dashboard).
2. Abre **SQL Editor** y ejecuta, una sola vez, el archivo completo `supabase/migrations/20260928193708_initial_schema.sql`. La migración crea las tablas, permisos, políticas y funciones. No la apliques encima de una base con tablas del mismo nombre.
3. En **Authentication → Users → Add user**, crea tu usuario con email, contraseña de al menos 8 caracteres y email confirmado. La V1 no abre el registro público. Desactiva nuevos registros públicos en la configuración de Auth si el proyecto es privado.
4. Obtén la URL y la clave publicable en el diálogo **Connect**, y la clave de servicio en la configuración de API. Configura en `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=TU_CLAVE_PUBLICABLE
SUPABASE_SERVICE_ROLE_KEY=TU_CLAVE_DE_SERVICIO
APP_URL=http://localhost:3000
```

5. Reinicia la aplicación e inicia sesión desde el perfil o Settings. No introduzcas la clave de servicio en la interfaz. Nunca le añadas el prefijo `NEXT_PUBLIC_`.
6. En **Database → Advisors**, revisa los avisos de seguridad. Las tablas de tokens, estados OAuth y presupuesto de generación no tienen acceso `anon` ni `authenticated`; las demás tienen únicamente `SELECT` con RLS para el propietario. No añadas políticas amplias de escritura para resolver errores de configuración.

Alternativa con CLI para proyectos gestionados por migraciones:

```sh
npx supabase login
npx supabase link --project-ref TU_PROJECT_REF
npx supabase db push
```

No uses ambas vías sobre la misma base sin reconciliar previamente el historial. La migración fue creada con `supabase migration new initial_schema`. Las pruebas locales ejecutan su SQL en PostgreSQL mediante PGlite con roles Auth de prueba; no sustituyen una verificación en tu proyecto alojado.

## 3. Configurar Amazon

En Settings:

1. Introduce tu tracking ID de Associates, exactamente como aparece en tu cuenta.
2. Selecciona el marketplace predeterminado para entradas por ASIN.
3. Añade opcionalmente tu URL `https://www.amazon.com/shop/tu-nombre` de Influencer/Storefront. Esta V1 la guarda y permite abrirla; no importa automáticamente tu Storefront.
4. Revisa el disclosure que se incluirá al principio de la descripción y en la imagen.
5. Guarda las preferencias.

El tracking ID debe ser válido para el marketplace de los productos. V1 tiene una configuración de tracking por usuario: utiliza una cuenta/workspace por marketplace si necesitas identificadores distintos. Los enlaces se reconstruyen como `https://www.amazon…/dp/ASIN?tag=TU_TRACKING_ID`; se eliminan otros parámetros. Expande los enlaces cortos `amzn.to` en el navegador y pega la URL completa.

**Creators API:** la interfaz `ProductProvider` y `AmazonCreatorsProvider` están en `src/lib/server/generation.ts`. El adaptador falla explícitamente como no implementado, en lugar de simular acceso. `AMAZON_CREATORS_ENABLED` documenta la futura configuración; cambiarlo no activa una API inexistente. Una integración posterior debe implementar el contrato autorizado, credenciales, límites y condiciones de uso que correspondan a tu cuenta. La V1 funciona sin ese acceso.

## 4. Conectar Pinterest

1. Configura tu aplicación en [Pinterest Developers](https://developers.pinterest.com/apps/), con acceso aprobado adecuado para tu cuenta.
2. Registra el callback **exacto** `https://TU_DOMINIO/api/pinterest/callback`. En desarrollo usa una URL de callback que Pinterest permita y que llegue al servidor local; si necesitas un túnel HTTPS, usa esa misma base en `APP_URL`. No mezcles orígenes.
3. Configura las variables del servidor:

```dotenv
PINTEREST_APP_ID=TU_APP_ID
PINTEREST_APP_SECRET=TU_APP_SECRET
PINTEREST_REDIRECT_URI=https://TU_DOMINIO/api/pinterest/callback
TOKEN_ENCRYPTION_KEY=CLAVE_BASE64_DE_32_BYTES
```

Genera una clave de cifrado nueva en tu terminal y cópiala a la variable; no la publiques:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

4. Reinicia/reimplanta y pulsa **Settings → Conectar**. Se solicitan `boards:read`, `boards:write`, `pins:read`, `pins:write` y `user_accounts:read`.
5. Pulsa **Sincronizar boards**, elige un board predeterminado y guarda. También puedes crear un board público desde Settings.
6. Prueba la publicación con un Pin que hayas revisado. La creación de un board o Pin modifica tu cuenta real de Pinterest.

Los tokens no llegan al cliente, al HTML, a mensajes de error ni a auditoría. Conserva la clave de cifrado: sustituirla sin migrar los valores cifrados requiere reconectar las cuentas. Los refresh tokens se renuevan según la respuesta de Pinterest; si Pinterest revoca acceso o caduca el refresh token, reconecta. No hay garantía de acceso a analytics con todos los niveles de app; se necesita autorización de Pinterest.

## 5. IA opcional y modos

```dotenv
OPENAI_API_KEY=TU_CLAVE
OPENAI_TEXT_MODEL=gpt-4.1-mini
```

El modelo es configurable. Las llamadas solo se hacen desde el servidor, con los hechos que guardaste del producto; el resultado se valida antes de persistir. Sin clave, siempre hay plantillas editables. Con clave, puedes desmarcar **Usar IA de textos** en Pin Studio. El límite duro es de 30 solicitudes de generación por usuario y día UTC, también ante concurrencia; los fallos consumen una reserva.

| Modo                         | Comportamiento                                                                                                                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Manual                       | No genera nada en segundo plano. Puedes escribir un Pin o pedir variantes por plantilla.                                                                                                                     |
| AI Assisted (predeterminado) | Generas a petición, editas, apruebas y programas.                                                                                                                                                            |
| Autopilot + revisión         | Una vez al día, el worker elige el producto más antiguo sin conceptos y genera tres borradores para que los revises.                                                                                         |
| Autopilot sin revisión       | Requiere seleccionar el modo, activar Autopilot y desactivar la revisión explícitamente. Genera tres conceptos de un producto nuevo al día, aprueba uno con board y trata de programarlo respetando límites. |

Autopilot solo usa tu catálogo importado. No descubre ni compra productos automáticamente. Si no hay board, tracking o conexión, deja borradores/aprobados para que resuelvas la configuración. No intenta consumir todos los cupos diarios: un producto y un Pin automático al día como límite conservador de V1. El worker publica cualquier Pin ya aprobado y programado, independientemente del modo actual.

## 6. Desplegar en Vercel

1. Sube **esta carpeta** a tu repositorio Git, incluyendo lockfile y migración; excluye `.env.local`, `.next` y `node_modules`.
2. En Vercel, **Add New → Project → Import Git Repository**. Si el repositorio contiene más carpetas, selecciona esta carpeta como Root Directory. Framework: Next.js. Node: 22 o superior. Install: `npm ci`. Build: `npm run build`.
3. En **Settings → Environment Variables**, añade todas las variables necesarias de `.env.example`. `APP_URL` debe ser el origen público final sin barra final. `PINTEREST_REDIRECT_URI` debe ser ese origen más `/api/pinterest/callback`. No pongas credenciales de producción en previews públicas.
4. Genera un secreto independiente para `CRON_SECRET` (usa el comando aleatorio de arriba otra vez). Vercel lo enviará como `Authorization: Bearer …` al worker.
5. **El `vercel.json` incluido usa `0 12 * * *`: una ejecución diaria, compatible con el límite de cron de Hobby.** Vercel puede ejecutarla entre las 12:00 y las 12:59 UTC. El worker procesa como máximo un Pin vencido por cuenta en cada ejecución; los demás esperan a otro día o a que pulses “Procesar siguiente”. Para automatización frecuente, usa un plan compatible y cambia el schedule a `*/15 * * * *`, o configura un scheduler externo con HTTPS y el mismo Bearer secret. Actualiza también la etiqueta informativa de Scheduler si cambias la frecuencia.
6. Despliega. Configura el dominio en Pinterest y completa OAuth desde ese dominio. Registra también la URL del sitio en Supabase Auth. No uses un callback de un despliegue preview efímero para la conexión permanente.
7. Ejecuta el recorrido de aceptación de abajo. Comprueba los registros de la función `/api/cron` y la cola en Scheduler. El endpoint devuelve contadores `completed`, `failed` y `accounts`.

Para ejecutar manualmente un trabajo **ya vencido**, pulsa **Scheduler → Procesar siguiente**. No adelanta Pins futuros ni evita los límites. Un cron no garantiza ejecución en el segundo exacto: el trabajo vence a la hora elegida y se procesa en una ejecución posterior.

## 7. Recorrido de aceptación con cuentas reales

1. Inicia sesión. Añade una URL/ASIN y hechos verificados. Comprueba que una URL con otro dominio es rechazada y que el producto no se puede duplicar.
2. Conecta Pinterest, sincroniza boards y configura tracking/disclosure.
3. Genera tres conceptos. Edita uno, elige board, revisa alt text, título, descripción y PNG. Descarga el PNG si quieres revisarlo aparte.
4. Aprueba el Pin. Si lo editas, debe volver a borrador. Apruébalo de nuevo.
5. Programa una hora futura respetando el intervalo. Cancela y verifica que vuelve a revisión. Aprueba y vuelve a programar.
6. Cuando venza, ejecuta el worker o espera al cron. Confirma el Pin en Pinterest y en Published. Procesar dos veces no debe duplicarlo.
7. Sincroniza analytics después de que Pinterest disponga de datos. Ausencia de datos debe mostrarse como `—`; el cero solo aparece si Pinterest lo devuelve. Comprueba CTR y filtros.
8. Prueba con otro usuario: no debe ver productos, boards, cola, métricas ni logs del primero.

## 8. Errores, seguridad y operación

- La V1 no reintenta automáticamente `POST /pins`. Un timeout, error 5xx o una interrupción después del envío puede significar que Pinterest sí publicó. El estado pasa a **uncertain** y reserva el producto/board. Usa **Reconciliar** con el ID publicado; el servidor consulta Pinterest y compara board, título y ASIN. Si no encuentras el Pin, investiga el resultado antes de intervenir la fila; no la reinicies a ciegas.
- Los trabajos `processing` de más de diez minutos se ponen en cuarentena en la siguiente ejecución. Un resultado confirmado se registra junto con la transición de estados en una transacción.
- Un error definitivo/preparación marca `failed`. Cancela el trabajo, corrige, vuelve a aprobar y programa. No existe bucle de reintento que genere spam.
- El intervalo mínimo es 60 minutos y el máximo configurable es 25 Pins por día UTC. El modo inicial permite 5. También se cuentan resultados inciertos en el presupuesto del día del intento.
- Cambiar disclosure o tracking invalida las aprobaciones y cancela las publicaciones pendientes. Los Pins ya publicados no se editan retrospectivamente.
- El servicio no realiza peticiones a las URLs de producto. Las imágenes son generadas localmente; no hay un descargador de URLs arbitrarias.
- Los endpoints de escritura validan sesión con Supabase y exigen el origen configurado; las consultas de propiedad preceden a las mutaciones. La clave de servicio es privilegiada: no la compartas y no la uses fuera del servidor.
- La cuenta Supabase emplea sesión cookie renovada por `proxy.ts`. Mantén copias de seguridad y observa la cola y los logs. Cambiar el esquema o las políticas requiere volver a ejecutar las pruebas.
- V1 se orienta a un workspace personal: el worker limita cada ejecución a 50 cuentas y un presupuesto de tiempo de 220 segundos; para una instalación grande, divide trabajo entre workers y añade particionado/paginación persistente.
- La sincronización de métricas rota por Pins menos recientemente consultados: hasta 20 en una acción manual y 2 por cuenta en cada cron. Solo importa métricas diarias `READY` de los 30 días completos anteriores; no suma snapshots superpuestos. Los datos se actualizan mediante upsert por publicación/fecha.
- Las recomendaciones son descriptivas y exigen al menos 100 impresiones por plantilla en dos plantillas para comparar CTR. La hora agrupada es la hora en que se publicó el Pin, no la hora del clic.
- No incluye importación de ventas/comisiones Amazon, Canva OAuth, sincronización automática de Storefront, acceso a Creators API ni modelo de imágenes conectado. Las plantillas PNG y la entrada manual sí están implementadas. No se necesita Canva para el flujo de V1.

## Desarrollo y pruebas

```sh
npm run typecheck
npm test
npm run test:providers
npm run build
```

Las pruebas cubren canonicalización, URLs hostiles, validación, disclosure, métricas sin datos, CTR ponderado, cifrado autenticado y SQL real de la migración: RLS, propiedad, invalidación de aprobación, claims duplicados, cuarentena, auditoría y límite de generaciones. PGlite ejecuta PostgreSQL embebido, sin crear recursos cloud ni publicar Pins.

Pruebas de navegador (contra una instancia local **sin credenciales**, en otro terminal):

```sh
npm run start -- --port 3010
npx playwright install chromium
npm run test:e2e
```

`TEST_BASE_URL` permite cambiar el puerto. `TEST_BROWSER_CHANNEL=chrome` utiliza Chrome ya instalado. Estas pruebas recorren las diez pantallas, el formulario, la navegación móvil y los errores de configuración; no suplantan un usuario autenticado ni simulan una conexión externa.

Estructura principal:

```text
src/app/                  páginas, layouts y rutas API
src/components/           interfaz responsive
src/lib/domain.ts         validación y cálculos puros
src/lib/server/           Auth, OAuth, cifrado, proveedores, cola y métricas
supabase/migrations/      esquema, políticas, triggers y RPCs
tests/                    pruebas de dominio y base de datos
```

## Referencias de integración

- [Next.js App Router](https://nextjs.org/docs/app)
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Pinterest OAuth](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/)
- [Contrato oficial Pinterest API v5](https://github.com/pinterest/api-description/blob/main/v5/openapi.yaml)
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [OpenAI Chat API](https://developers.openai.com/api/reference/resources/chat)

Las credenciales, aprobación de Pinterest y comprobación de una publicación real dependen de tus cuentas. Ningún resultado de pruebas locales significa que una cuenta externa ya esté conectada o aprobada.
