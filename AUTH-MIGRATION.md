# Migración de acceso BCPOL (2026-11-02)

## Estado

- La rama `auth-supabase-secure-20261102` **no debe fusionarse todavía**.
- La web pública de `main` continúa operativa con el acceso anterior.
- El gateway Supabase `bcpol-web-auth` está desplegado; su base de usuarios está pendiente de importación.
- La copia de seguridad del archivo original es `backup-before-auth-hardening-20261102`.
- Se mantiene el sistema de usuario + contraseña, con los mismos datos de las 39 cuentas.
- La copia de seguridad anterior contiene las contraseñas legibles: tratarla como información sensible. La historia de GitHub **no se elimina** al actualizar `index.html`.

## Importación privada

El preparador realiza la importación **desde su ordenador**, sin compartir claves ni contraseñas por chat.

1. Abrir Terminal y ejecutar:

```bash
git clone https://github.com/bcpol/bcpol2.0.git
cd bcpol2.0
git switch -c auth-supabase-secure-20261102 --track origin/auth-supabase-secure-20261102
export SUPABASE_URL=https://axgbiqbyserypsbtwnjr.supabase.co
read -s SUPABASE_SECRET_KEY
export SUPABASE_SECRET_KEY
python3 scripts/migrate_web_accounts.py --migrate
```

Al ejecutar `read -s`, pegar la clave secreta de Supabase y pulsar Intro: **no se verá en pantalla**. Se obtiene en Supabase → proyecto BCPOL → Settings → API Keys → Secret API keys. No utilizar la clave pública/anon.

2. Confirmar que aparece `Importación verificada: 39 cuentas`.

3. Comprobar una de las cuentas sin mostrar su contraseña:

```bash
python3 scripts/migrate_web_accounts.py --test
unset SUPABASE_SECRET_KEY
```

La prueba verifica inicio de sesión, validación y cierre con el backend real. **No imprimir ni enviar la contraseña ni el token**.

4. Solo tras estas dos comprobaciones, fusionar el PR de la rama de autenticación y confirmar la web en un navegador. Posteriormente retirar las funciones temporales `public.bcpol_web_auth_import` y `public.bcpol_web_auth_count`, manteniendo las funciones de login/verify/logout.

## Qué protege y qué no

- Protege las **credenciales nuevas en la base de datos** usando hash BCrypt de coste 12; el frontend nuevo no incluye ni consulta un diccionario de usuarios ni contraseñas.
- Los intentos incorrectos bloquean temporalmente una cuenta a partir de ocho errores en quince minutos.
- La sesión dura doce horas y tiene identificador aleatorio cuyo hash se almacena en el servidor; existe cierre de sesión.
- **NO vuelve privados los archivos de GitHub Pages**: una web estática pública puede descargarse sin autenticación, y las contraseñas antiguas siguen en la historia del repositorio. Para proteger realmente los documentos hay que situarlos detrás de un servidor o almacenamiento privado, y rotar las contraseñas que ya fueron públicas.
- No cambiar el bot de Telegram ni sus tablas de progreso.

## Reversión

La web anterior se conserva en `backup-before-auth-hardening-20261102`. No revertir la base de datos ni eliminar cuentas existentes si hubiera que volver a la versión anterior; mantener la migración como cambio aditivo.
