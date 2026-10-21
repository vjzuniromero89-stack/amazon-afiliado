# Contenido reutilizable por canal

Una sola pieza base por producto, adaptada a cada red. **Regla de oro:** solo se usa lo que está en la etiqueta o en la ficha de Amazon (tamaño, cantidad, formato, ingredientes nombrados, "for sensitive skin" si el envase lo dice). Nunca beneficios, resultados ni promesas ("reduce arrugas", "te hará crecer el cabello", "el mejor"). La app ya filtra esas palabras en los Pins (`hasClaim` / `stripClaims`).

## Pieza base (una por producto)

| Pieza | De dónde sale | Dónde se reutiliza |
|---|---|---|
| Foto propia (o hecha con IA) del producto | Pantalla Fotos de la app | Pin, foto de Instagram, tienda |
| Video vertical 9:16 de unos 11 s: modelo usando el producto | Kling + `make_kling_ad.sh` / `add_music.sh` | Reel de Instagram, Reel de Facebook, TikTok, Pin de video (más adelante) |
| 2 o 3 datos de la etiqueta | `pinExtras(p).perks` (los mismos chips de la tienda) | Todos los textos |
| Frase de búsqueda ("Face Moisturizer", "Boxing Hand Wraps") | `searchTerms()` | Título del Pin, hashtags |

## Guion corto (11 s, 3 tiempos)

1. **0–2 s, gancho:** el producto en mano y el nombre en pantalla ("Vanicream Daily Facial Moisturizer").
2. **2–8 s, uso real:** se aplica o se usa tal como se usa de verdad (crema masajeada hasta absorberse, delineador en los dos labios, vendas puestas). Texto en pantalla: un dato de la etiqueta ("3 fl oz · Lightweight").
3. **8–11 s, cierre:** el producto con la etiqueta visible y la barra "Shop it at ivethskin.com".

Sin voz que afirme resultados. La música va pegada al video en Instagram y Facebook (Pixabay, uso comercial). En TikTok se usa la biblioteca comercial.

## Por canal

| Canal | Formato | Texto | Llamado a la acción | Avisos | ¿Lo hace la app? |
|---|---|---|---|---|---|
| Pinterest | Imagen 1000×1500 (3 diseños por producto) | Título que empieza con la frase de búsqueda; descripción con los datos de la etiqueta | Enlace directo a Amazon con tracking ID | La descripción empieza con "#ad · Affiliate link." y la frase de Amazon Associates | Sí: genera, tú apruebas cada Pin, se publica sola |
| Instagram Reels | Video 9:16, música en el archivo | "#ad Nombre · dato · dato" / "Shop it at ivethskin.com (link in bio)" / frase de Associates + "Made with AI." / hashtags | Enlace en la biografía, a ivethskin.com con `?utm_source=instagram` | #ad en la 1.ª línea; marca de IA en la API (`is_ai_generated`) | Sí (Reel, foto diaria, carrusel de los domingos) |
| Facebook | El mismo Reel + un post diario con enlace | Igual que Instagram; el post con enlace lleva la URL de ivethskin.com | Enlace clicable a ivethskin.com | #ad en la 1.ª línea | Sí (Reels y posts con enlace) |
| TikTok | Video 9:16 sin música en el archivo; sonido de la biblioteca comercial | **#ad al principio**, nombre, 1 dato, "Shop it at ivethskin.com", frase de Associates, "Made with AI.", 3 o 4 hashtags | Enlace en la biografía (cuando la cuenta lo permita) a ivethskin.com con `?utm_source=tiktok` | Activar **AI-generated** y **Branded content** | No: se publica a mano en TikTok Studio |

Plantilla de TikTok (copiar y cambiar los datos):

```
#ad {Nombre}: {dato 1}, {dato 2}. Shop it at ivethskin.com. As an Amazon Associate I earn from qualifying purchases. Made with AI. #amazonfinds #{categoría}
```

## Reglas que aplican

| Fuente | Regla | Cómo se cumple |
|---|---|---|
| FTC (Endorsement Guides) | Aviso claro, visible y cerca del enlace o de la recomendación; no basta con ponerlo solo en la biografía | #ad en la 1.ª línea de cada post; barra superior, nota junto a cada grupo de botones y bajo el botón de compra en ivethskin.com |
| Amazon Associates | La frase "As an Amazon Associate I earn from qualifying purchases"; sin precios fijos; sin imágenes de Amazon fuera de su API; sin enlaces acortados que oculten que es Amazon; nada de enlaces en correos ni en material offline | La frase está en la tienda y en cada post. Sin precios. Fotos propias. Enlaces amazon.com directos con `rel="sponsored"` |
| Pinterest | Enlaces de afiliado permitidos en Pins orgánicos; **no** en anuncios pagados; cada Pin programado debe elegirlo una persona | Aprobación Pin por Pin en la app. Los anuncios deben apuntar a ivethskin.com, no a Amazon |
| TikTok | Contenido comercial: activar Branded content; contenido con IA: activar la etiqueta; cuentas de empresa: solo música comercial | Se activa a mano en cada publicación |
| Instagram y Facebook | Etiqueta de IA; "Paid partnership" solo si hay una marca que paga (no es el caso) | La API marca el Reel como hecho con IA; el texto dice "Made with AI." |
