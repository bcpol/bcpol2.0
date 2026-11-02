# BCPOL — Protección del acceso de alumnos (noviembre de 2026)

## Sistema implantado

- El acceso `bcpol.es` usa el servicio `bcpol-web-auth` de Supabase, con verificación del lado del servidor.
- Se preservan **39 cuentas** y las contraseñas originales, sin mostrarlas ni incluirlas en `index.html`.
- Las contraseñas se almacenan como **BCrypt(SHA-256(contraseña original))** en el esquema restringido `bcpol_private`.
- El servicio Edge calcula SHA-256 antes de consultar la verificación en la base de datos.
- Se emiten tokens aleatorios de sesión que se guardan mediante su hash SHA-256. Cada sesión vence a las 12 horas y puede cerrarse.
- La función de autenticación controla los intentos fallidos y aplica bloqueos temporales.
- La prueba de login en la URL independiente `prueba-acceso.html` ha sido realizada satisfactoriamente por el preparador. Las pruebas automáticas de la rama también fueron satisfactorias.
- No se alteran las cuentas ni los progresos de BCPOL TRAINING.

## Copias y restauración

- Versión anterior: rama `backup-before-auth-activation-20261102`.
- Respaldos anteriores: `backup-before-auth-hardening-20261102`.
- Revertir `index.html` a la rama de respaldo puede restaurar el inicio de sesión antiguo, pero **no mejora su seguridad**, porque las claves originales ya estuvieron expuestas en GitHub.
- No se deben borrar las tablas de Supabase ni los datos del bot en una reversión de la web.

## Limitaciones y riesgos pendientes

La autenticación nueva **no convierte en privados los recursos estáticos de GitHub Pages**. Los archivos publicados (y la historia pública anterior del repositorio) pueden seguir siendo accesibles sin autenticación. El control de acceso real a documentos privados requiere almacenamiento privado y verificación de autorización en el servidor.

Dado que las contraseñas anteriores ya estuvieron expuestas en el código público, **es aconsejable renovarlas de forma escalonada** cuando el preparador lo autorice, aunque se hayan conservado ahora para no interrumpir el acceso.

Los administradores deben eliminar las funciones de importación temporales después de verificar la migración y conservar únicamente las funciones necesarias de login, verificación y cierre.
