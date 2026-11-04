# Sincronización BCPOL Aula Virtual ↔ Google Drive (04-11-2026)

## Estado y alcance

El endpoint `bcpol-aula-sync` y la migración `005_sync_google_drive.sql` están preparados. **No se sincroniza nada hasta que el preparador configure una clave privada y active el disparador en Google Apps Script.**

La carpeta principal `0. CLASES BCPOL 2026` nunca se comparte con los alumnos. Las carpetas mensuales de septiembre (28), octubre (28) y noviembre (27) se registran con sus IDs reales. No se concede nada a Rafa en noviembre. Los derechos históricos de pago permanecen en `aula_access`.

## Funcionamiento

1. Al marcar un mes abonado en el panel, el estado queda en `granted=true`; Google Drive debe confirmar el acceso antes de marcar `drive_verified`.
2. El script programado consulta la lista autorizada de correos de Google en Supabase, usando una clave aleatoria de 256 bits guardada en Propiedades del script.
3. Comprueba que cada carpeta mensual está bajo la carpeta principal prevista y no presenta lectores ajenos ni permisos públicos. Comparte **solo** los accesos que faltan con rol `reader` y sin correos de aviso. Relee los permisos y confirma el resultado al servidor.
4. Si llega un mes nuevo con alumnos autorizados, crea una carpeta numerada en la principal; los materiales que se suban dentro heredan su acceso. Las clases se registran por separado en el panel.
5. Límite de 40 altas por ejecución para minimizar riesgos. Una función de previsualización no cambia nada. Un disparador horario cada 5 minutos automatiza la revisión.

## Activación privada por el preparador

- Supabase SQL Editor (cuenta propietaria): `select bcpol_private.aula_emitir_clave_sync();` una sola vez.
- Apps Script, Propiedades del script: `BCPOL_SYNC_KEY` igual al resultado, sin copiarlo a ningún repositorio ni chat.
- Sustituir el código antiguo por `BCPOL_AULA_SINCRONIZACION_AUTOMATICA_V1.gs` facilitado privadamente al preparador. La clave **no** está dentro del archivo.
- Ejecutar `previsualizarSincronizacionBCPOL`. Si los tres meses están correctos y sin anomalías, cambiar `BCPOL_ACTIVAR_SINCRONIZACION=true`.
- Ejecutar `sincronizarAulaBCPOL` una vez; después `instalarSincronizacionBCPOL` una vez. Para detener `detenerSincronizacionBCPOL`.

**IMPORTANTE:** volver a emitir el código invalida inmediatamente el anterior. `BCPOL_SYNC_KEY` nunca debe aparecer en código GitHub, documentos públicos, capturas o registros.

## Seguridad y limitaciones

- `bcpol_private.aula_emitir_clave_sync()` tiene ejecución revocada a `anon`, `authenticated` y `service_role`; únicamente desde editor SQL propietario.
- `public.bcpol_aula_sync_api` solo lo ejecuta `service_role`; valida el hash de la clave y el mes/carpeta. Un token inválido no obtiene correos. El Edge endpoint recibe la clave en encabezado privado y no usa CORS público.
- No se toca el endpoint de login ni las contraseñas ni los permisos de las carpetas de clases históricos.
- **Los permisos desactualizados no se eliminan automáticamente en V1.** Si cambia un correo de Google o se corrige un pago concedido por error, hay que revisar también los permisos directos de las clases históricas, y resolver la alerta de acceso inesperado antes de que continúe la sincronización.
- Las clases mensuales nuevas no aparecen hasta registrarse en el panel; la creación de una carpeta no publica automáticamente una clase.
- No afirmes que está activado hasta haber comprobado el disparador y una ejecución real bajo la cuenta de Google propietaria.
