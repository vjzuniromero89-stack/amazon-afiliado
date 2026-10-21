# PROJECT_STATUS — Amazon Affiliate Command / ivethskin.com

Archivo compartido para revisar el avance (Claude, ChatGPT o una persona). Última actualización: **2026-10-21**, rama `mejoras/auditoria-seo-medicion`.

## Qué es

- **Repositorio:** `vjzuniromero89-stack/amazon-afiliado`.
- **Vercel:** proyecto `amazon-afiliado`, equipo `edvickar`. Panel privado en `amazon-afiliado-liard.vercel.app`; tienda pública en `ivethskin.com` (mismo proyecto; `proxy.ts` + `SHOP_HOSTS`).
- **Base de datos:** Supabase `tkyqretgmnyeuqnihipl` (variables `AFILIADO_SUPABASE_*`, solo en Producción).
- **Afiliado:** Amazon Associates, tracking ID principal `ivethskin-20`.
- **Search Console:** propiedad de dominio `ivethskin.com`, verificada por DNS TXT en Vercel. Dueño: vjzuniromero89@gmail.com. Sitemap enviado: 31 URLs.

## Estado verificado (2026-10-21)

| Área | Estado | Cómo se verificó |
|---|---|---|
| Pinterest | ✅ Publica por API; aprobación Pin por Pin | Código (`operations.ts`) y Pins publicados |
| Instagram | ✅ Reels, foto diaria y carrusel por API | Código (`instagram.ts`) y Reels publicados |
| Facebook (Página) | ✅ Reels y post diario con enlace por API | Código (`facebook.ts`) |
| TikTok | ❌ Sin integración; manual en TikTok Studio | No hay código de TikTok |
| Cron | Cada 15 min (cron-job.org) + respaldo diario de Vercel (12:00 UTC) | Registros de `/api/cron` en Vercel: "cron run: 1 ok" a :00/:15/:30/:45 |
| Cola de Pins | 1 Pin vencido por cuenta y pasada; límites de 5/día, 60 min, 9 am–9 pm NY | `publishNext`, `scheduleApproved` |
| Métricas de Pinterest | Impresiones, guardados y clics salientes por día (READY + ESTIMATE) | `syncAnalytics`; Pinterest tarda 1–2 días en entregar cifras |
| Clics en la tienda | Toques en "See it on Amazon" por producto y fuente (sin IP ni cookies) | Tabla `shop_clicks` |
| Pedidos y comisiones de Amazon | ❌ No se importan todavía | — |
| Aviso de afiliado | Barra superior, junto a cada grupo de botones (nuevo), bajo el botón de compra, pie de página y en cada post | Código e ivethskin.com |
| Pruebas | 24 de dominio + 12 de proveedores, todas pasan; `next build` pasa sin claves | Local, en esta rama |

## Cambios de esta rama (PR)

1. **Las vistas previas compilan:** la tienda devuelve una lista vacía si no hay base de datos (`shop.ts`).
2. **SEO:** JSON-LD (Organization + WebSite en la portada; BreadcrumbList + ItemList en las categorías; BreadcrumbList en los productos), tarjeta grande para X y descripciones de producto con nombre, datos y categoría.
3. **Avisos:** línea "#ad · The buttons are affiliate links…" junto a cada grupo de botones.
4. **Veracidad:** "Photos are ours; some are made with AI" en lugar de "Photos are my own".
5. **Medición (fase 1):** `src/lib/channels.ts` + `AMAZON_CHANNEL_TAGS`, un tracking ID por canal en los Pins y en los clics de la tienda. Sin la variable no cambia nada.
6. **Documentación:** cron real en el README, `docs/ARQUITECTURA.md`, `docs/CONTENIDO-REDES.md`.

## Decisiones

Están en `docs/ARQUITECTURA.md` → "Decisiones". En resumen:
- Medición por tracking ID de Amazon, sin redirecciones propias.
- Sin marcado `Product`, porque no hay precios.
- Las vistas previas muestran la tienda vacía mientras no haya una clave de solo lectura en Preview.

## Pendiente del usuario

1. En Amazon Associates → *Manage Your Tracking IDs*, crear por ejemplo `ivethskin-pin-20`, `ivethskin-ig-20`, `ivethskin-fb-20` y `ivethskin-tt-20` (el sufijo lo pone Amazon).
2. En Vercel → Settings → Environment Variables, agregar `AMAZON_CHANNEL_TAGS` (Producción) con esos IDs, por ejemplo `pinterest=ivethskin-pin-20,instagram=ivethskin-ig-20,facebook=ivethskin-fb-20,tiktok=ivethskin-tt-20`, y volver a desplegar.
3. Poner `?utm_source=tiktok`, `?utm_source=instagram` y `?utm_source=facebook` en los enlaces de las biografías a ivethskin.com.
4. Opcional: para ver productos en las vistas previas, agregar en Preview una clave de Supabase de **solo lectura**. No usar la clave de servicio.

## Siguiente tarea de código

**Importar el reporte de Amazon Associates** (CSV de pedidos y ganancias, que trae tracking ID, ASIN, fecha, artículos pedidos y ganancias):
- Tabla `associates_orders` con RLS por usuario.
- Pantalla para subir el CSV en Analytics.
- Vista que compare por producto y canal: impresiones y clics salientes de Pinterest, toques en la tienda, pedidos y comisiones.

Después:
- Versión en español `/es` con hreflang y textos traducidos a mano, sin cambiar el dominio ni la marca.
- Pins de video.
