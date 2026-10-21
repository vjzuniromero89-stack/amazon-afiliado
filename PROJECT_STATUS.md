# PROJECT_STATUS — Amazon Affiliate Command / ivethskin.com

Archivo compartido para revisar el avance (Claude, ChatGPT o una persona).
- **Actualizado:** 2026-10-21.
- **Rama:** `mejoras/auditoria-seo-medicion` (PR #1), que ya incluye lo compatible del PR #2 de ChatGPT (`codex/ivethskin-audit-20261021`).
- **Sin merge ni producción** hasta la revisión del usuario.

## Qué es

- **Repositorio:** `vjzuniromero89-stack/amazon-afiliado`.
- **Panel privado:** `amazon-afiliado-liard.vercel.app`.
- **Tienda pública:** `ivethskin.com`. Es la misma app: `proxy.ts` reescribe los dominios de `SHOP_HOSTS` a `/finds`.
- **Base de datos:** Supabase `tkyqretgmnyeuqnihipl`. Sus variables `AFILIADO_SUPABASE_*` están **solo en Producción** de edvickar.
- **Afiliado:** Amazon Associates, tracking ID principal `ivethskin-20`.
- **Search Console:** propiedad de dominio `ivethskin.com`, verificada por DNS TXT en Vercel. Dueño: vjzuniromero89@gmail.com. Sitemap con 31 URLs.

## Vercel: dos proyectos conectados al mismo repositorio (verificado 2026-10-21; no se borró ni desconectó nada)

| Proyecto | Equipo | Dominios | Qué hace |
|---|---|---|---|
| `amazon-afiliado` (`prj_HJz4db2xVwIR7ljyqsFdEBOQvpit`) | **edvickar** (acceso de Claude) | **ivethskin.com**, www.ivethskin.com (308 → apex), ivethskin.vercel.app, amazon-afiliado-liard.vercel.app | **Sirve la tienda real y el panel.** El HTML en vivo lleva `dpl_GwB1as…`, que es de edvickar |
| `amazon-afiliado` (`prj_tUc7wgZzemB318TRiX5JJBXs73mu`) | **karvic88** (otra cuenta de Vercel; Claude no tiene acceso) | Probablemente amazon-afiliado-xi.vercel.app, que sirve la misma app con 8 productos reales y fotos | También despliega cada push y cada PR. Su `/api/cron` responde 401, así que **tiene `CRON_SECRET`** |

**Chequeos de GitHub:** los dos proyectos publican un estado con el **mismo nombre**, "Vercel – amazon-afiliado", y GitHub muestra el último que llega.
- **PR #1:** karvic88 `BUBbJCfN…` y `DbHyC2aB…` correctos; edvickar `AcovtERi…` y `DaV3b1UL…` correctos.
- **PR #2:** el estado fallido es de karvic88 `4y9UDEkA…` (sin base de datos al compilar). ChatGPT también vio fallar la vista previa de edvickar `dpl_CVVMMY2W…`.

**Riesgo:** si karvic88 usa la misma base de datos, su cron diario de `vercel.json` (12:00 UTC) también procesa la cola. Decisión pendiente del usuario: desconectar el repositorio en karvic88 o quitarle `CRON_SECRET`, pero no borrar nada sin revisar.

## Estado verificado

| Área | Estado | Cómo se verificó |
|---|---|---|
| Pinterest | ✅ Publica por API; aprobación Pin por Pin | Código (`operations.ts`) y Pins publicados |
| Instagram | ✅ Reels, foto diaria y carrusel por API | Código (`instagram.ts`) y Reels publicados |
| Facebook (Página) | ✅ Reels y post diario con enlace por API | Código (`facebook.ts`) |
| TikTok | ❌ Sin integración; manual en TikTok Studio | No hay código de TikTok |
| Cron | **Cada 15 min** (cron-job.org) + diario de Vercel (12:00 UTC) | Registros de `/api/cron` en edvickar: "cron run: 1 ok" a :00/:15/:30/:45. ChatGPT supuso "diario" porque no vio los registros |
| Pasadas que se cruzan | ⚠️ A las 12:00 hubo **dos pasadas a 34 s** (cron-job.org 12:00:15 y Vercel 12:00:49) | Mismos registros |
| Cola de Pins | Reclamo atómico (`claim_pin`): 1 Pin vencido por cuenta y pasada; límites de 5/día, 60 min, 9 am–9 pm NY | `publishNext`, `scheduleApproved` |
| Colas de Instagram y Facebook | ⚠️ Toman filas `pending` con SELECT, sin reclamo atómico | `publishReels`, `publishFacebook`. Con pasadas cruzadas podría salir un post doble (riesgo que señaló ChatGPT) |
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

1. **Colas de Instagram y Facebook sin reclamo atómico** y pasadas que se cruzan a las 12:00 UTC (y quizás el cron de karvic88). Agregar un reclamo atómico (`UPDATE … SET status='processing' WHERE id=? AND status='pending'`) antes de publicar. Prioridad alta.
2. **karvic88:** que el usuario confirme si debe seguir conectado; si no, desconectar el repositorio o quitarle `CRON_SECRET`.
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
- `npm test` 27 ✅ (dominio, más `traffic-source` del PR #2)
- `npm run test:providers` 12 ✅
- `npm run build` sin base de datos ✅ (con `SHOP_DEMO=1`: 8 productos)
- Vistas previas de Vercel: edvickar ✅ y karvic88 ✅

## Siguiente tarea

Antes de cualquier merge: revisión del usuario. Después:
1. Reclamo atómico en las colas de Instagram y Facebook.
2. Decidir sobre karvic88.
3. Configurar los tracking IDs por canal.
4. Importar el reporte de Associates.
