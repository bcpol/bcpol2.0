-- Emisión de código solo desde el editor SQL del propietario del proyecto.
-- No está disponible en la API pública ni en el frontend.
create or replace function bcpol_private.aula_issue_code()
returns text
language plpgsql security invoker
set search_path to pg_catalog,extensions,bcpol_private
as $func$
declare
 v_code text;
begin
 v_code := encode(extensions.gen_random_bytes(24),'hex');
 insert into bcpol_private.aula_admin_setup(username,challenge_sha,expires_at,used_at)
 values('bcpol',encode(extensions.digest(v_code,'sha256'),'hex'),now()+interval '24 hours',null)
 on conflict(username) do update
 set challenge_sha=excluded.challenge_sha,expires_at=excluded.expires_at,used_at=null;
 return v_code;
end
$func$;
revoke all on function bcpol_private.aula_issue_code() from public,anon,authenticated,service_role;
