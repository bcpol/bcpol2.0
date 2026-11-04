-- BCPOL Aula Virtual: synchronisation token, month-folder registry and audited confirmations.
-- This migration never grants students access and never changes existing entitlements.
create table if not exists bcpol_private.aula_sync_config (
  id text primary key check (id = 'google-drive'),
  secret_hash text not null check (secret_hash ~ '^[a-f0-9]{64}$'),
  enabled boolean not null default true,
  expires_at timestamptz not null,
  rotated_at timestamptz not null default now()
);
create table if not exists bcpol_private.aula_drive_months (
  month_id text primary key references bcpol_private.aula_months(month_id) on delete restrict,
  folder_id text check (folder_id is null or folder_id ~ '^[A-Za-z0-9_-]{10,150}$'),
  updated_at timestamptz not null default now()
);
insert into bcpol_private.aula_drive_months(month_id,folder_id) values
('2026-09','1lci2DaFRMjkNJnUBva13UviCtOLJFVc0'),
('2026-10','18QFNxg5laAdVRqlyxTLfSe6LXcTQwa_3'),
('2026-11','1vvjRop1lbs2ojAVyPxrQzP2kXHV-zhQT')
on conflict (month_id) do nothing;
alter table bcpol_private.aula_sync_config enable row level security;
alter table bcpol_private.aula_drive_months enable row level security;
revoke all on bcpol_private.aula_sync_config,bcpol_private.aula_drive_months from public,anon,authenticated;
grant select on bcpol_private.aula_sync_config,bcpol_private.aula_drive_months to service_role;
grant insert,update on bcpol_private.aula_drive_months to service_role;

-- Executable only from the project owner's SQL editor, not from any public API.
create or replace function bcpol_private.aula_emitir_clave_sync()
returns text language plpgsql security invoker
set search_path to pg_catalog,bcpol_private,extensions
as $code$
declare v_code text;
begin
 v_code:=encode(extensions.gen_random_bytes(32),'hex');
 insert into bcpol_private.aula_sync_config(id,secret_hash,enabled,expires_at)
 values('google-drive',encode(extensions.digest(v_code,'sha256'),'hex'),true,
        now()+interval '18 months')
 on conflict (id) do update set secret_hash=excluded.secret_hash,
     enabled=true, expires_at=excluded.expires_at, rotated_at=now();
 return v_code;
end
$code$;
revoke all on function bcpol_private.aula_emitir_clave_sync() from public,anon,authenticated,service_role;

create or replace function public.bcpol_aula_sync_api(
 p_token_hash text,p_action text,p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path to pg_catalog,bcpol_private
as $func$
declare
 v_month text; v_folder text; v_emails jsonb; v_snapshot jsonb;
 v_updated integer; v_registered integer;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_action not in ('snapshot','register_folder','confirm')
    or pg_catalog.octet_length(coalesce(p_payload::text,'')) > 30000 then
  return jsonb_build_object('ok',false,'error','Solicitud no válida');
 end if;
 if not exists(
   select 1 from bcpol_private.aula_sync_config
   where id='google-drive' and secret_hash=p_token_hash
     and enabled=true and expires_at>now()
 ) then
  return jsonb_build_object('ok',false,'error','Sincronización no autorizada');
 end if;

 if p_action='snapshot' then
  select coalesce(jsonb_agg(jsonb_build_object(
   'month_id',m.month_id, 'label',m.label, 'sort_order',m.sort_order,
   'folder_id',coalesce(d.folder_id,''),
   'emails',coalesce((
     select jsonb_agg(lower(trim(e.google_email)) order by lower(trim(e.google_email)))
     from bcpol_private.aula_access a
     join bcpol_private.aula_emails e on e.username=a.username
     where a.month_id=m.month_id and a.granted and e.google_email is not null
       and btrim(e.google_email)<>''
   ),'[]'::jsonb)
  ) order by m.sort_order),'[]'::jsonb) into v_snapshot
  from bcpol_private.aula_months m
  left join bcpol_private.aula_drive_months d on d.month_id=m.month_id
  where exists(select 1 from bcpol_private.aula_access a
              where a.month_id=m.month_id and a.granted);
  return jsonb_build_object('ok',true,'months',v_snapshot);
 end if;

 v_month := coalesce(p_payload->>'month_id','');
 v_folder := coalesce(p_payload->>'folder_id','');
 if not exists(select 1 from bcpol_private.aula_months where month_id=v_month)
    or not exists(select 1 from bcpol_private.aula_access
                  where month_id=v_month and granted)
    or v_folder !~ '^[A-Za-z0-9_-]{10,150}$' then
   return jsonb_build_object('ok',false,'error','Mes o carpeta incorrectos');
 end if;

 if p_action='register_folder' then
   insert into bcpol_private.aula_drive_months(month_id,folder_id)
   values(v_month,v_folder)
   on conflict(month_id) do update
      set folder_id=excluded.folder_id,updated_at=now()
      where aula_drive_months.folder_id is null
         or aula_drive_months.folder_id=excluded.folder_id;
   get diagnostics v_registered=row_count;
   if v_registered<1 then
    return jsonb_build_object('ok',false,'error','La carpeta mensual ya tiene otro ID');
   end if;
   return jsonb_build_object('ok',true,'folder_id',v_folder);
 end if;

 if p_action='confirm' then
   v_emails:=p_payload->'verified_emails';
   if jsonb_typeof(v_emails)<>'array' or jsonb_array_length(v_emails)>500
      or exists (
        select 1 from jsonb_array_elements(v_emails) x
        where jsonb_typeof(x)<>'string'
      ) then
     return jsonb_build_object('ok',false,'error','Confirmaciones incorrectas');
   end if;
   if not exists (
    select 1 from bcpol_private.aula_drive_months d
    where d.month_id=v_month and d.folder_id=v_folder
   ) then
    return jsonb_build_object('ok',false,'error','Carpeta no registrada');
   end if;
   -- Only the authenticated worker can confirm permissions. A changed/missing
   -- email is invalidated, and no ungranted month is ever marked verified.
   with checked as (
     select a.username,
       (e.google_email is not null and exists(
          select 1 from jsonb_array_elements_text(v_emails) x
          where lower(btrim(x))=lower(btrim(e.google_email))
       )) as is_verified
     from bcpol_private.aula_access a
     left join bcpol_private.aula_emails e on e.username=a.username
     where a.month_id=v_month and a.granted
   ), updated as (
     update bcpol_private.aula_access a
       set drive_verified=c.is_verified,
           updated_at=now(),
           updated_by='drive-sync'
       from checked c
       where a.username=c.username and a.month_id=v_month
          and a.drive_verified is distinct from c.is_verified
       returning a.username
   ) select count(*) into v_updated from updated;
   return jsonb_build_object('ok',true,'updated',v_updated);
 end if;
 return jsonb_build_object('ok',false,'error','Acción no reconocida');
exception when others then
 return jsonb_build_object('ok',false,'error','Operación no disponible');
end
$func$;
revoke all on function public.bcpol_aula_sync_api(text,text,jsonb)
 from public,anon,authenticated;
grant execute on function public.bcpol_aula_sync_api(text,text,jsonb) to service_role;
