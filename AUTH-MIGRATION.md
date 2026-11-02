# BCPOL · Nueva autenticación — estado de la migración

**No fusionar esta rama todavía**. La web pública de `main` sigue operativa con las credenciales actuales.

## Avances verificados el 2 de noviembre de 2026

- Hay **39 cuentas** en `bcpol_private.web_accounts` (comprobación por consulta SQL).
- Los usuarios y sus contraseñas originales se han transformado **sin mover las contraseñas en claro a las herramientas de despliegue**. En la base de datos se guarda un hash BCrypt de SHA-256 de cada contraseña. SHA-256 se aplica al iniciar sesión en la función Edge, antes de llamar a la RPC de verificación.
- El archivo `index.html` de esta rama ya no contiene el diccionario de usuarios y contraseñas; conserva el diseño y calendario.
- La copia anterior se encuentra en `backup-before-auth-hardening-20261102`.
- Las comprobaciones automáticas de la rama han pasado.

## Bloqueo pendiente — imprescindible antes de publicar

La función Edge `bcpol-web-auth` está desplegada en Supabase, pero **su versión activa puede seguir esperando la contraseña original**. Se intentó actualizarla para enviar SHA-256 antes de la RPC y el despliegue quedó bloqueado por las herramientas de seguridad. **Debe desplegarse exactamente el contenido actualizado de `auth-edge/index.ts` desde esta rama.**

El código actualizado contiene:

```typescript
p_password: await hashToken(password),
```

Tras ese despliegue debe comprobarse, con una cuenta de prueba autorizada, el flujo de **inicio de sesión, validación de la sesión y cierre de sesión**. Solo entonces fusionar esta rama con `main`.

Por seguridad, **no volver a ejecutar scripts de importación con las contraseñas en claro**: ello sustituiría los hashes actuales y podría romper el nuevo proceso de comprobación. La función auxiliar `public.bcpol_web_auth_import` debe retirarse después de validar el nuevo acceso; está restringida a `service_role`.

## Limitación de GitHub Pages

La web pública de GitHub Pages no convierte los archivos en privados aunque se añada autenticación. Los archivos estáticos y su historial de GitHub pueden seguir siendo accesibles y las antiguas contraseñas seguirán en la historia del repositorio. Para proteger realmente los materiales, es necesario un alojamiento con comprobación de acceso del lado del servidor y, a medio plazo, renovar las contraseñas que fueron públicas.

## Reversión

Conservar el respaldo `backup-before-auth-hardening-20261102` sin modificar otros repositorios. No tocar BCPOL TRAINING ni sus datos en Supabase.
