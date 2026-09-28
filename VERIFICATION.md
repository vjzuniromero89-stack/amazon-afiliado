# Verificación de entrega

Fecha: 28 de septiembre de 2026.

Corrección posterior: el cron predeterminado cambió de cada 15 minutos a una ejecución diaria (`0 12 * * *`) para resolver el rechazo de despliegue en Hobby. Se actualizaron la etiqueta de Scheduler y el README. Esta corrección local no implica que se haya actualizado el repositorio GitHub o completado un despliegue remoto.

| Comprobación | Resultado |
| --- | --- |
| Compilación de producción Next.js | Correcta |
| TypeScript estricto | Correcto |
| Pruebas de dominio y PostgreSQL embebido | 17/17 |
| Pruebas de proveedores: conceptos, PNG y validación | 3/3 |
| Pruebas de interfaz en Chrome | 4/4 |
| Auditoría npm de dependencias de producción | 0 vulnerabilidades reportadas |
| Vista de escritorio y móvil | Revisada visualmente |

Total: **24 pruebas automatizadas aprobadas**.

Las pruebas de PostgreSQL ejecutaron la migración completa y verificaron: RLS por usuario, prohibición de acceso a tokens, rechazo de vínculos entre usuarios, aprobación por versión, cambios de disclosure, exclusión de claims duplicados, límites diarios e intervalos, bloqueo de productos repetidos, cuarentena de resultados inciertos y reservas de generación ante solicitudes concurrentes.

Las pruebas de imagen comprobaron la firma PNG y dimensiones 1000 × 1500 de las tres plantillas. Las pruebas de navegador recorrieron las diez áreas, el formulario de producto, errores visibles en el diálogo y navegación móvil a 390 × 844 sin desbordamiento horizontal.

## Pendiente de configuración externa

- Crear/configurar el proyecto Supabase alojado, aplicar la migración y validar sus advisors.
- Introducir las variables reales e iniciar sesión.
- Conectar la app aprobada de Pinterest y verificar publicación/analytics contra la cuenta real.
- Configurar el tracking de Amazon y comprobar su marketplace.
- Desplegar en Vercel y confirmar la ejecución del cron según el plan.

No se crearon recursos cloud, no se inventaron credenciales y no se publicó ningún Pin. La aplicación se entregó preparada para estas conexiones. Creators API y la generación de imágenes mediante un modelo externo permanecen como puntos de extensión explícitos; la entrada manual y los PNG tipográficos funcionan sin ellos.
