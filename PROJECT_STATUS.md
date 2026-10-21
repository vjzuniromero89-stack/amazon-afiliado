# PROJECT_STATUS — Amazon Affiliate Command / ivethskin.com

Archivo compartido para revisar el avance (Claude, ChatGPT o una persona).
- **Actualizado:** 2026-10-21 (revisión de duplicados terminada; tienda en inglés y panel en español).
- **Rama:** `mejoras/auditoria-seo-medicion` (PR #1), que ya incluye lo compatible del PR #2 de ChatGPT (`codex/ivethskin-audit-20261021`).
- **Sin merge ni producción** hasta la revisión del usuario.

## Qué es

- **Repositorio:** `vjzuniromero89-stack/amazon-afiliado`.
- **Panel privado:** `amazon-afiliado-liard.vercel.app`.
- **Tienda pública:** `ivethskin.com`. Es la misma app: `proxy.ts` reescribe los dominios de `SHOP_HOSTS` a `/finds`.
- **Base de datos:** Supabase `tkyqretgmnyeuqnihipl`. Sus variables `AFILIADO_SUPABASE_*` están **solo en Producción** de edvickar.
- **Afiliado:** Amazon Associates, tracking ID principal `ivethskin-20`.
- **Search Console:** propiedad de dominio `ivethskin.com`, verificada por DNS TXT en Vercel. Dueño: vjzuniromero89@gmail.com. Sitemap con 31 URLs.

## Vercel: un solo proyecto (desde 2026-10-21)

| Proyecto | Equipo | Dominios | Estado |
|---|---|---|---|
| `amazon-afiliado` (`prj_HJz4db2xVwIR7ljyqsFdEBOQvpit`) | **edvickar** | **ivethskin.com**, www.ivethskin.com (308 → apex), ivethskin.vercel.app, amazon-afiliado-liard.vercel.app | **Sirve la tienda y el panel.** Producción `dpl_GwB1as…` |
| `amazon-afiliado` (`prj_tUc7wgZzemB318TRiX5JJBXs73mu`) | karvic88 | amazon-afiliado-xi.vercel.app | **Eliminado por el dueño el 2026-10-21** |

**Comprobado después de eliminarlo (2026-10-21):**

| Comprobación | Resultado |
|---|---|
| ivethskin.com `/`, una categoría y un producto | 200, desde edvickar |
| www.ivethskin.com | 308 → ivethskin.com |
| amazon-afiliado-xi.vercel.app | 404 `DEPLOYMENT_NOT_FOUND`: confirma que **era** el proyecto de karvic88 |
| Pasada del cron 14:00:17 UTC (edvickar) | "cron run: 1 ok, 0 failed, 1 accounts", ya con la migración de reservas |

Antes, los dos proyectos publicaban en GitHub un estado con el mismo nombre ("Vercel – amazon-afiliado"). Ahora solo llega el de edvickar.

## Publicaciones duplicadas en Instagram y Facebook: corrección (en esta rama)

**Antes:** cada pasada leía las filas `pending` y `processing` con un SELECT y publicaba. Dos pasadas a la vez (cron-job.org y el cron de Vercel a las 12:00 UTC, o el proyecto de karvic88) podían publicar el mismo post. Un timeout después de publicar dejaba el post para reintentar, y lo **reenviaba**.

**Ahora:**

| Pieza | Qué hace |
|---|---|
| `claim_instagram_posts` / `claim_facebook_posts` (SQL) | Reservan los posts vencidos con `FOR UPDATE SKIP LOCKED`. Cada post pasa a `publishing` con una ficha (`claim_token`) de esa pasada; otra pasada no lo puede tomar |
| Escrituras con la ficha | Cada actualización exige `claim_token` = la ficha de la pasada. Una pasada cuya reserva venció no puede sobrescribir |
| `sendOnce` | La llamada que publica se envía **una sola vez** por reserva, con límite de 60 s. Si falla con un 4xx, nada se publicó: se reintenta en otra pasada (3 intentos). Si falla por timeout, conexión cortada, 5xx o respuesta sin id, quizás sí se publicó: el post queda `uncertain` |
| Instagram `uncertain` | Se revisa cada 15 min preguntando el estado del contenedor. `PUBLISHED`: queda publicado, sin repetirlo. `FINISHED`: se publica ahora (un contenedor se publica una sola vez). `ERROR` o `EXPIRED`: falla |
| Facebook Reel | El `video_id` se guarda apenas se inicia la subida y se reutiliza siempre; nunca hay un segundo `start`. Si es `uncertain`, se revisa el estado del video: publicado, en curso o "finish nunca llegó" (se reenvía para el **mismo** video) |
| Facebook post con enlace | Si queda `uncertain`, **no** se reenvía solo: el panel muestra "Revisar en Facebook" |
| Pasada que muere a la mitad | Un post en `publishing` por más de 10 min pasa a `uncertain`. Si solo se estaba creando el contenedor, o iniciando la subida sin video, vuelve a `pending` (nada se publicó) |
| Panel | Muestra "Revisar en Instagram", "Revisar en Facebook" y "Publicando" |

**Pruebas:**
- `tests/social-claims.test.ts`: Postgres real (PGlite) con todas las migraciones. Tres pasadas a la vez no comparten ningún post. Una escritura con una ficha vieja no cambia nada. Una pasada muerta pasa a `uncertain` y no se reenvía. Los posts con enlace inciertos esperan al dueño.
- `tests/social-outcome.test.ts`: un timeout después de publicar genera `MaybeSent` (una sola llamada); un 4xx se puede reintentar; reconciliación de Instagram y Facebook.
- **Límite:** PGlite atiende una consulta a la vez. La prueba demuestra que la reserva cambia el estado y que otra pasada ya no encuentra el post. El bloqueo en paralelo lo da `FOR UPDATE SKIP LOCKED` de Postgres en Supabase.

**Migración aplicada:** el dueño corrió `20261021120000_social_post_claims.sql` en Supabase el 2026-10-21 ("Success"). Claude no puede leer esa base, así que no lo comprobó directamente. El código actual de producción sigue funcionando con ella: solo se agregaron estados, columnas y funciones.

## Pasadas del cron que coinciden: turno exclusivo (en esta rama)

**Problema:** cron-job.org (cada 15 min) y el cron diario de Vercel (12:00 UTC) llegan casi juntos (el 2026-10-21, a 34 s). Las reservas ya impiden publicar dos veces el mismo post, pero no impiden que las dos pasadas **planifiquen** a la vez. `planPhotos` (foto y carrusel del día) y `planLinks` (post con enlace del día) leen "¿ya hay uno hoy?" y luego insertan: dos pasadas juntas podían crear dos posts del mismo día, y los dos se publicarían.

**Ahora:**

| Pieza | Qué hace |
|---|---|
| Tabla `cron_leases` + `acquire_cron_lease` (SQL) | Una sola fila `cron`. La pasada que llega primero la toma por 330 s (un poco más que el máximo de 300 s de la función). La segunda recibe `false`, escribe "cron run: skipped, another run is working" y termina sin hacer nada |
| `release_cron_lease` | Al terminar, la pasada suelta el turno; solo puede soltarlo la pasada que lo tiene |
| Pasada que muere | El turno vence solo a los 330 s; la siguiente pasada de 15 min corre normal |
| Sin la migración | Si la función no existe todavía, la pasada sigue como antes y el registro agrega "(no lease: run the cron_lease migration)". El merge no rompe nada aunque falte la migración |

**Pruebas:** `tests/cron-lease.test.ts` (PGlite): dos pasadas a la vez → solo una trabaja; otra pasada no puede soltar un turno ajeno; un turno vencido se puede volver a tomar.

**Migraciones:**
1. `20261021120000_social_post_claims.sql` — **aplicada** por el dueño (2026-10-21).
2. `20261021150000_cron_lease.sql` — **aplicada** por el dueño (2026-10-21, "Success"). El código de producción actual no la usa todavía; entra en uso con el merge.
3. `20261021160000_plan_once.sql` — **aplicada** por el dueño (2026-10-21, "Success"). Agrega dos índices y reemplaza las dos funciones de reserva; el código de producción actual sigue funcionando con ella.

## Revisión contra publicaciones duplicadas (2026-10-21)

Revisión completa del código de reservas, del cron y de las migraciones. Hallazgos y qué se hizo:

| # | Hallazgo | Riesgo | Arreglo |
|---|---|---|---|
| 1 | El límite "tardó demasiado" (6 h) contaba desde que el post se **creó**, no desde que se **programó** | Un Reel programado días antes se marcaba "falló" en su primera revisión aunque Facebook lo publicara después; rehacerlo duplicaba. En Instagram se perdía | ✅ `ageSinceDue`: cuenta desde la hora programada |
| 2 | Los interruptores del panel (fotos y posts automáticos) planifican fuera del turno del cron | Dos fotos o dos posts con enlace el mismo día si coinciden con una pasada | ✅ Índices únicos: un post planificado por usuario y hora (`instagram_posts_one_planned`, `facebook_posts_one_planned`); el segundo se rechaza y se omite (`checkNew`) |
| 3 | Un post `uncertain` cuya revisión siempre falla se reclamaba cada 15 min para siempre, primero en la fila | Quitaba lugar a posts nuevos (máximo 3 por pasada) | ✅ Los inciertos van al final y dejan de revisarse tras 8 intentos (quedan en "Revisar en …" para el dueño) |
| 4 | Una escritura con la ficha vencida no actualizaba nada, pero la pasada seguía subiendo y publicando | Duplicado si una pasada pasara de 10 min (hoy el máximo es 5) | ✅ Si no se actualiza ninguna fila, la pasada se detiene para ese post |
| 5 | En ivethskin.com, una dirección rara bajo `/finds/...` mostraba la página 404 del panel en español | Texto del panel privado en la tienda | ✅ Página 404 global neutra en inglés, con una línea en español y sin enlace al panel |
| 6 | Rama muerta para posts con enlace inciertos (`facebook.ts`) | Ninguno | Se deja como protección |
| 7 | `claim_token: null` se pone en dos lugares | Ninguno | Se deja |
| 8 | No hay prueba de la ruta `/api/cron` en sí (saltar o seguir sin turno) | Bajo | Se deja: la lógica del turno está probada en SQL |

**Pruebas nuevas:** índices de un post por día; inciertos al final y con tope; edad desde la hora programada; intentos contados en inciertos.

## Idioma de la tienda y del panel (2026-10-21)

Antes toda la app tenía un solo layout raíz con `<html lang="es">`, así que ivethskin.com (en inglés) se declaraba en español, y sus páginas llevaban dentro el texto "Esta página no existe · Volver al Dashboard" del panel.

| Parte | Layout raíz | `lang` |
|---|---|---|
| Tienda (`src/app/finds`) | `finds/layout.tsx` | `en` |
| Panel privado (`src/app/(panel)`) | `(panel)/layout.tsx` | `es` |
| URL que no existe | `global-not-found.tsx` (flag `experimental.globalNotFound`) | `en`, con una línea `lang="es"` |

Las dos partes cargan el mismo `globals.css`, así que ninguna cambia de aspecto. La tienda tiene su propia página de error en inglés (`finds/error.tsx`). Pasar de la tienda al panel recarga la página completa (son dos layouts raíz). En la tienda no hay enlaces al panel.

## karvic88 y la base de datos (resuelto 2026-10-21)

amazon-afiliado-xi.vercel.app (karvic88) usaba **la misma base de datos** (los mismos 8 productos con los mismos UUID) y tenía `CRON_SECRET`. No se pudo ver si su cron corría. El dueño **eliminó** ese proyecto el 2026-10-21; ahora xi responde `DEPLOYMENT_NOT_FOUND`. Ya no hay otro proyecto que trabaje contra esa base.

## Estado verificado

| Área | Estado | Cómo se verificó |
|---|---|---|
| Pinterest | ✅ Publica por API; aprobación Pin por Pin | Código (`operations.ts`) y Pins publicados |
| Instagram | ✅ Reels, foto diaria y carrusel por API | Código (`instagram.ts`) y Reels publicados |
| Facebook (Página) | ✅ Reels y post diario con enlace por API | Código (`facebook.ts`) |
| TikTok | ❌ Sin integración; manual en TikTok Studio | No hay código de TikTok |
| Cron | **Cada 15 min** (cron-job.org) + diario de Vercel (12:00 UTC) | Registros de `/api/cron` en edvickar: "cron run: 1 ok" a :00/:15/:30/:45. ChatGPT supuso "diario" porque no vio los registros |
| Pasadas que se cruzan | ⚠️ A las 12:00 hubo **dos pasadas a 34 s** (cron-job.org 12:00:15 y Vercel 12:00:49). **En esta rama:** turno exclusivo (`cron_leases`); la segunda pasada se salta | Mismos registros; `tests/cron-lease.test.ts` |
| Cola de Pins | Reclamo atómico (`claim_pin`): 1 Pin vencido por cuenta y pasada; límites de 5/día, 60 min, 9 am–9 pm NY | `publishNext`, `scheduleApproved` |
| Colas de Instagram y Facebook | ✅ **En esta rama:** reserva atómica por pasada y estado `uncertain` (ver arriba). Migración `20261021120000_social_post_claims.sql` **aplicada** (2026-10-21, la reportó el dueño); el código nuevo entra con el merge | `publishReels`, `publishFacebook`, `claim_instagram_posts`, `claim_facebook_posts` y pruebas `social-claims` / `social-outcome` |
| Métricas de Pinterest | Impresiones, guardados y clics salientes por día (READY + ESTIMATE) | `syncAnalytics` |
| Clics en la tienda | Toques en "See it on Amazon" por producto y fuente normalizada (sin IP, cookies ni rutas) | `shop_clicks` y `traffic-source.ts` |
| Pedidos y comisiones de Amazon | ❌ No se importan | — |

## PR #1 frente al PR #2 de ChatGPT (combinados en la rama del PR #1)

| Tema | PR #1 (Claude) | PR #2 (ChatGPT) | Resultado combinado |
|---|---|---|---|
| Aviso junto a los productos | Una línea por grupo de botones | "Ad · I may earn a commission…" en cada tarjeta | **Aviso en cada tarjeta** (`#ad · I may earn a commission from this link.`); se quitó la línea por grupo para no duplicar. Bajo el botón de la ficha: "#ad · I may earn a commission from this link. It opens Amazon…" |
| Origen de los clics | `channels.ts`: un tracking ID por canal | `traffic-source.ts`: normaliza redes y guarda el primer origen de la sesión | **Ambos:** la fuente normalizada alimenta el tracking ID por canal; se conservan las pruebas de los dos |
| Carga pública en inglés | — | `finds/loading.tsx` en inglés | Incluido, más **`finds/not-found.tsx` en inglés** (antes salía "Esta página no existe · Volver al Dashboard") |
| SEO (JSON-LD, tarjeta de X) | Sí | — | Se conserva |
| Vista previa | Compila sin base de datos | Falla al compilar | Compila, y además muestra **datos de prueba** (`shop-demo.ts`) |
| Cron | Verificado: 15 min | "Sigue diario" (no verificado) | Se corrige en este archivo; se conserva su advertencia sobre las colas de Meta |
| README | Cron real | Nota de estado arriba | Las dos |

## Revisión de la vista previa (edvickar `dpl_DaV3b1UL…`, commit `820d345`, datos de prueba)

| Comprobación | Resultado |
|---|---|
| Portada | 8 productos; cada tarjeta con su aviso #ad; 8 enlaces `https://www.amazon.com/dp/<ASIN>?tag=ivethskin-20` con `rel="sponsored nofollow noopener noreferrer"` y `target="_blank"` |
| Categorías | Home (3), Fitness (2), Beauty (5), Skincare (2): responden 200, con aviso en las tarjetas y JSON-LD BreadcrumbList + ItemList |
| Productos | 8 de 8 responden 200, con "See it on Amazon", aviso y BreadcrumbList |
| Fotos | Ninguna rota. Cargan diferidas al bajar por la página |
| Producto inexistente | Página en inglés "This find is not here anymore", con `noindex` |
| Celular (375 px) | Sin desplazamiento horizontal; pastillas en 2 filas; tarjetas y ficha legibles |
| Textos del panel privado en la tienda | Ninguno visible |

## Pendientes y riesgos

1. ✅ **Migración `20261021120000_social_post_claims.sql`:** aplicada por el dueño (2026-10-21). Después del merge, comprobar en los registros de `/api/cron` y en el panel que Instagram y Facebook siguen publicando (estados "Publicando" y "Revisar").
2. ✅ **karvic88:** eliminado por el dueño (2026-10-21). Queda solo edvickar. **Migración `20261021150000_cron_lease.sql`:** aplicada (2026-10-21). Después del merge, los registros deben mostrar "skipped, another run is working" a las 12:00 UTC en la pasada que llegue segunda.
3. **"Not found" con código 200:** lleva `noindex`, pero lo ideal es un 404 real. Pasa por el streaming de `loading.tsx`, lo mismo que hoy en producción.
4. **Medición:**
   - crear los tracking IDs en Associates (por ejemplo `ivethskin-pin-20`, `-ig-20`, `-fb-20`, `-tt-20`);
   - poner `AMAZON_CHANNEL_TAGS` en Producción;
   - agregar `?utm_source=` a los enlaces de las biografías;
   - después, importar el CSV de Associates. Pedir primero un reporte de muestra.
5. **Español:** prueba con pocos productos revisados por una persona; `/es` con hreflang recíproco; sin redirigir por ubicación.
6. **Vistas previas con datos reales:** solo con una base o clave de solo lectura para Preview. No copiar las claves de producción.

## Reglas revisadas (2026-10-21)

- Amazon, aviso: https://affiliate-program.amazon.com/help/node/topic/GHQNZAU6669EZS98
- Amazon, reportes: https://affiliate-program.amazon.com/help/node/topic/GMWAK55DQX8JEK7C
- Amazon, tracking IDs: https://affiliate-program.amazon.com/help/node/topic/GK5TZZ4AWML2QSLA
- FTC: https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking
- Pinterest, contenido comercial: https://policy.pinterest.com/en/commercial-and-branded-content-guidelines

El aviso debe ir junto a la recomendación. En video, dentro del video y no solo en la descripción. Contenido por canal: `docs/CONTENIDO-REDES.md`. Decisiones: `docs/ARQUITECTURA.md`.

## Validación de esta rama

- `npx tsc --noEmit` ✅
- `npm test` 43 ✅ (dominio, base de datos, `traffic-source`, `social-claims`, `social-outcome` y `cron-lease`)
- `npm run test:providers` 12 ✅
- `npm run build` sin base de datos ✅ y con `SHOP_DEMO=1` ✅
- Vista previa de Vercel: solo edvickar (karvic88 eliminado)

## Siguiente tarea

Antes de cualquier merge: revisión del usuario. Después:
1. ✅ Las tres migraciones están aplicadas (2026-10-21).
2. Merge del PR #1 cuando el dueño lo apruebe; revisar la primera pasada de Instagram y Facebook y la de las 12:00 UTC (una debe decir "skipped").
3. Configurar los tracking IDs por canal.
4. Importar el reporte de Associates.
