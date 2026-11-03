# Aula Virtual BCPOL 2026/27 — rama de prueba

## Objetivo
Aula independiente con un único botón en la página principal y acceso **por mes abonado**, sin anular meses anteriores en caso de baja. Se preservan los 39 usuarios actuales (1 cuenta `bcpol` administrativa y 38 cuentas de alumnos).

## Archivos
- `index.html`: solo añade el botón a `aula.html`; no modifica inicio de sesión.
- `aula.html`: muestra **únicamente los meses abonados** y las clases publicadas tras comprobar permisos de Drive.
- `aula-admin.html`: interfaz de gestión de correos, meses y clases.
- `aula-backend/001_aula_virtual.sql`: esquema privado + API server-only + auditoría de cambios mensuales.
- `aula-backend/index.ts`: Edge Function separada `bcpol-aula` con verificación de las sesiones de BCPOL.

## Estado verificado (3 de noviembre de 2026)
- Migración aplicada en el proyecto Supabase de BCPOL, **sin alterar** usuarios, contraseñas, sesiones existentes ni tablas de BCPOL TRAINING.
- Edge Function independiente `bcpol-aula` desplegada; `bcpol-web-auth` existente intacta.
- 12 mensualidades creadas; **28 correos identificados, 83 derechos mensuales autorizados (28 SEP, 28 OCT, 27 NOV), 9 clases registradas**.
- Compartición real en Drive **pendiente**: 0 derechos verificados y 0 clases publicadas.
- Hay una excepción confirmada: Rafa dispone de septiembre y octubre, pero NO de noviembre.
- El administrador `bcpol` **no está habilitado** en `bcpol_private.aula_admins`. Ningún otro usuario puede administrar.
- Consulta de prueba sobre 8 sesiones vigentes: todas recibieron una vista válida de 12 meses y todas fueron rechazadas para `admin_snapshot`.
- `anon` y `authenticated` no disponen de permiso de ejecución de `public.bcpol_aula_api`.

## Antes de publicar
1. Revisar diseño de `aula.html?demo=1` en un entorno **de pruebas**. La rama de GitHub no se publica en GitHub Pages automáticamente.
2. Rotar la contraseña de la cuenta administrativa y **revocar todas sus sesiones antiguas**. Las contraseñas anteriores habían estado en código público; se recomienda renovar las demás también.
3. Habilitar manualmente un administrador verificado en `bcpol_private.aula_admins` **solo después de completar la rotación**, nunca desde el navegador. Exigir identidad robusta para cambios económicos.
4. Lista de 28 alumnos y pagos de septiembre a noviembre confirmada por el preparador y registrada. Los siguientes meses todavía no están confirmados. No se debe inferir el pago de ningún mes posterior.
5. Revisar carpetas heredadas, accesos «cualquiera con enlace» y permisos de `Nube Clases BCPOL`: **ocultar el enlace no impide entrar**.
6. Las 9 carpetas semanales existentes han sido localizadas y catalogadas sin moverlas. Conceder permisos **solo sobre las 9 carpetas semanales** (251 permisos lector: 112 SEP, 112 OCT, 27 NOV) y verificar cada permiso antes de marcar `drive_verified` y publicar enlaces. Se ha preparado un script privado de Apps Script, no incluido en el repositorio público porque contiene correos personales.
7. El preparador confirma que `11. SUPUESTO SEMANAL` **ya tiene acceso limitado** por su sistema actual; conservar sus permisos y no modificar esa carpeta. Este control es independiente de las nueve carpetas históricas del Aula Virtual. Antes de publicar, comprobar únicamente que ninguna autorización heredada de las carpetas históricas anule la restricción mensual.
8. Probar desde navegador móvil y escritorio con alumnos con 0, 1, 2 o más meses concedidos; intentar abrir un mes no abonado mediante URL guardada y confirmar que Google Drive lo impide.
9. Revisar cambios y hacer una copia de la rama `main` antes de integrar. Publicar solo tras aprobación del preparador.

## Seguridad y límites
- El servidor identifica el usuario mediante el token de sesión ya existente; no acepta el usuario de un `localStorage` ni del cuerpo de `mine`.
- Las contraseñas, hashes y la clave privilegiada nunca se envían al navegador.
- Los privilegios de `service_role` se emplean solo en la Edge Function y se limitan por comprobación explícita del token y del rol administrativo en el servidor.
- Los pagos y correos se almacenan en `bcpol_private`, con RLS y sin permisos directos para `anon`/`authenticated`.
- Los cambios de mensualidades quedan registrados en `aula_access_audit`.
- **No hay sincronización automática con la API de Google Drive en esta fase**: la autorización real de la carpeta ha de efectuarse y comprobarse antes de marcar `drive_verified`.
- Los PDF y vídeos en Drive nunca se consideran privados por aparecer detrás de un botón de la web.
- El modo `?demo=1` solo ilustra la interfaz, sin accesos de Google ni datos reales de usuarios.

## Pruebas aún pendientes
- Verificar el endpoint HTTP desde navegador (el entorno de ejecución de esta tarea no ofrece acceso de red directo con DNS a Supabase).
- Verificar altas y ediciones con una cuenta admin una vez haya renovado credenciales, sin modificar pagos reales durante la prueba.
- Verificar cada carpeta con una cuenta Google que NO tenga permisos, no solo mediante enlaces de la web.
