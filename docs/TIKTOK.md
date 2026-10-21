# TikTok: publicación orgánica por API (estado y solicitud)

- **Revisado:** 2026-10-21, con la documentación oficial de TikTok de esa fecha.
- **Estado:** TikTok sigue **manual** (TikTok Studio). La app **no tiene conexión** con TikTok y no envía nada. La tarjeta "TikTok" del panel es solo un prototipo.
- **Solicitud:** borrador abajo. **No enviada.** La envía el dueño cuando confirme los datos pendientes.

## Qué API sirve y cuál no

| API | Para qué | ¿Sirve para nosotros? | Enlace oficial |
|---|---|---|---|
| **TikTok API for Business · Accounts API** (`/business/video/publish/`) | Publicar videos **públicos** en una cuenta **propia** ("owned account") | **Sí, es la vía recomendada.** Permite "Manage the organic presence of brands or creators' owned accounts, including publishing video or photo posts" | [Accounts API overview](https://business-api.tiktok.com/portal/docs/accounts-api-overview/v1.3) · [Publish a public video post to an owned account](https://business-api.tiktok.com/portal/docs/publish-a-public-video-post-to-an-owned-account/v1.3) |
| TikTok for Developers · Content Posting API (Direct Post, `video.publish`) | Apps para muchos creadores | **No.** Sin auditoría solo publica en privado (`SELF_ONLY`), con un máximo de 5 usuarios en 24 h. Sus reglas dicen que no es aceptable "a utility tool that uploads content only to accounts you or your team manage", y la revisión de apps pide que no sean "for private or personal use" | [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines) · [Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post) · [App review guidelines](https://developers.tiktok.com/doc/app-review-guidelines) |
| TikTok for Developers · Upload (bandeja, `video.upload`) | Envía un borrador; el creador lo termina en la app | No resuelve la automatización y tiene el mismo problema de revisión | [Upload reference](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video) |

## Permiso y datos del endpoint (Accounts API)

| Punto | Valor oficial |
|---|---|
| Permiso de la app | Scope **"TikTok Accounts"** ([Create a developer app](https://business-api.tiktok.com/portal/docs/create-a-developer-app/v1.3)) |
| Autorización del dueño de la cuenta | URL "TikTok account holder authorization URL" ([Authorization](https://business-api.tiktok.com/portal/docs/accounts-api-authorization/v1.3)) |
| Endpoint | `POST https://business-api.tiktok.com/open_api/v1.3/business/video/publish/` |
| Límites | 6 videos por minuto y **15 por día** por cuenta |
| Video | mp4/mov/webm, 3–600 s, ≤ 1 GB, ≥ 360 px, 23–60 fps |
| URL del video | Debe venir de una **propiedad verificada** (dominio por TXT de DNS, o prefijo de URL con archivo de firma). **No sigue redirecciones** (un 3xx es inválido) ([Manage URL properties](https://business-api.tiktok.com/portal/docs/manage-url-properties/v1.3)) |
| Etiquetas | `is_branded_content` ("Paid partnership"), `is_brand_organic` ("Promotional content"), `is_ai_generated` |
| Música | `music_sound_info` permite poner música de la **Commercial Music Library** |
| Borrador en vez de publicar | `upload_to_draft` (requiere el permiso `video.upload`) |

**Aviso de afiliado:** promocionar productos de terceros a cambio de una comisión es "Branded content" y lleva la etiqueta **"Paid partnership"**. Fuente: [Promoting a brand, product or service](https://support.tiktok.com/en/business-and-creator/creator-and-business-accounts/promoting-a-brand-product-or-service). Por eso el prototipo usa `is_branded_content: true` (`src/lib/tiktok.ts`).

## Requisitos para obtener el acceso

| # | Requisito oficial | Estado |
|---|---|---|
| 1 | Cuenta de **TikTok For Business** ([Get started](https://business-api.tiktok.com/portal/docs/get-started/v1.3)) | ⏳ Por crear (la crea el dueño) |
| 2 | Registro de desarrollador con **correo de dominio de empresa**. "You will be rejected if you are using a personal email". Además: "we are unable to onboard personal accounts or individual developers" ([Register as a developer](https://business-api.tiktok.com/portal/docs/register-as-a-developer/v1.3)) | ⚠️ **Bloqueo:** hace falta un correo `@ivethskin.com` y una **empresa** (nombre legal) |
| 3 | Sitio web de la empresa, público y completo, del mismo dominio que el correo | ✅ ivethskin.com (About, Contact, Privacy y, en esta rama, **Terms**) |
| 4 | **Accounts API Access Application Form**, obligatorio desde el 2026-03-20, **antes** de crear la app ([formulario](https://bytedance.sg.larkoffice.com/share/base/form/shrlgu4WEvtSXpEDLcCw56u4Rfc)) | 📝 Borrador abajo, **no enviado** |
| 5 | Verificación de empresa: un documento aceptado o un Business Center con la empresa verificada | ⚠️ Pendiente (depende del punto 2) |
| 6 | Grabación de pantalla del flujo; se acepta un prototipo | ⏳ Se graba con la tarjeta "TikTok" de esta rama |
| 7 | Crear la app con el scope "TikTok Accounts". Revisión de 2 a 3 días hábiles | ⏳ Después del formulario |
| 8 | El dueño de @ivethskin autoriza la app | ⏳ Después de la aprobación |
| 9 | Verificar la propiedad de las URL de los videos | ⏳ Después de la aprobación |

## Tipo de cuenta de @ivethskin

- **Estado: pendiente de verificar.** La sesión de TikTok abierta en el Chrome del dueño es de otra cuenta, y no se cambió de cuenta.
- **Lo que se ve en el perfil público** (2026-10-21): "Ivethskin Finds", 261 seguidores, la tienda escrita en la biografía como texto (sin enlace) y sin la categoría que suelen mostrar las cuentas de empresa. Indicio de **cuenta personal**, no confirmado.
- **Lo que pide la documentación:** el Accounts API publica en cuentas **propias** de marcas o creadores, y define tres niveles: Personal, Advanced Access y Verified Business. No exige una cuenta de empresa para publicar.
- **Recomendación:** pasar a **cuenta de empresa** (gratis), que da la Commercial Music Library y el enlace en la biografía.
- **Cómo comprobarlo** (lo hace el dueño con la sesión de @ivethskin):
  - **App de TikTok:** Perfil → ☰ → *Settings and privacy* → *Account*. Si aparece "Switch to personal account", es **de empresa**; si aparece "Switch to business account", es **personal**.
  - **Web:** en tiktok.com, foto de perfil → *Switch account* (o *Log out* y entrar con @ivethskin) → *Settings* → *Manage account*.

## Plan técnico (cuando haya aprobación)

1. **URL de los videos:** TikTok no sigue redirecciones. Hay dos opciones:
   - verificar el dominio `ivethskin.com` por TXT y servir el mp4 desde una ruta propia (falta probar que Vercel entregue archivos grandes sin cortar);
   - o un prefijo verificado en un bucket público de Supabase.
2. **Publicación:** un módulo `tiktok.ts` en el servidor que llame a `/business/video/publish/` con el mismo sistema de reservas y estado `uncertain` que Instagram y Facebook. Máximo 1 video por día, solo de productos con video asignado.
3. **Prueba:** primero en modo borrador (`upload_to_draft`) o con el video de prueba oficial, sin publicar. Después, un video real aprobado por el dueño.
4. **No se toca** Instagram, Facebook ni Pinterest.

## Borrador del formulario (en inglés, como el formulario) — NO ENVIADO

> Los campos entre corchetes los completa el dueño.

1. **Business Name:** [Nombre legal de la empresa, como en su registro]
2. **Matches developer profile Company Name?** Yes
3. **App Name:** Ivethskin Content Scheduler
4. **Email Address:** [correo @ivethskin.com usado en TikTok For Business]
5. **Website:** https://ivethskin.com
6. **Business Verification:** Submit An Acceptable Document for Business Verification — [documento de registro de la empresa]
7. **Use Case:**

   > Ivethskin Finds (https://ivethskin.com) is a small product-recommendation brand. We make our own short product videos (some made with AI) for home, skincare, beauty and fitness products we recommend through affiliate programs (Amazon Associates). We already publish these videos on Pinterest, Instagram and Facebook from our own dashboard, where the account owner reviews and approves every video before it is scheduled.
   >
   > We request the "TikTok Accounts" scope only to publish those approved videos to ONE TikTok account that we own (@ivethskin), with /business/video/publish/. Each post will carry the commercial content disclosure as Branded content ("Paid partnership", because we earn affiliate commissions) and the AI-generated label, plus "#ad" in the caption. We will post at most one video per day, only original videos we made, and we will not download, copy or migrate content from TikTok or other accounts, nor extract data from other creators.
   >
   > Why the API instead of TikTok Studio: one approval queue for all our channels, so the same video is reviewed once and the disclosure and AI labels are applied the same way every time, and posts go out at the times our audience is active without manual re-uploading. Access is internal only: the app is used by our team for our own account.
8. **Screen Recordings:** [grabación del prototipo: panel → Settings → tarjeta "TikTok (sin conexión)" con la cola y el texto de cada video]
9. **Estimated Count of Accounts:** Less Than 10
10. **Developer Account Type:** Direct Advertiser
11. **Usage Acknowledgment:** Agree (lo marca el dueño)
