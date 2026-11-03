-- BCPOL Aula Virtual 2026/27. Isolated schema, no edits to existing web login.
create table if not exists bcpol_private.aula_months (
 month_id text primary key check(month_id ~ '^20[0-9]{2}-(0[1-9]|1[0-2])$'),
 label text not null,
 sort_order smallint not null unique
);
insert into bcpol_private.aula_months(month_id,label,sort_order) values
('2026-09','Septiembre 2026',1),('2026-10','Octubre 2026',2),
('2026-11','Noviembre 2026',3),('2026-12','Diciembre 2026',4),
('2027-01','Enero 2027',5),('2027-02','Febrero 2027',6),
('2027-03','Marzo 2027',7),('2027-04','Abril 2027',8),
('2027-05','Mayo 2027',9),('2027-06','Junio 2027',10),
('2027-07','Julio 2027',11),('2027-08','Agosto 2027',12)
on conflict(month_id) do nothing;
create table if not exists bcpol_private.aula_emails (
 username text primary key references bcpol_private.web_accounts(username) on delete restrict,
 google_email text,
 updated_at timestamptz not null default now(),
 updated_by text
);
create table if not exists bcpol_private.aula_access (
 username text not null references bcpol_private.web_accounts(username) on delete restrict,
 month_id text not null references bcpol_private.aula_months(month_id) on delete restrict,
 granted boolean not null default false,
 drive_verified boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by text,
 primary key(username,month_id),
 constraint aula_drive_only_if_granted check (not drive_verified or granted)
);
create table if not exists bcpol_private.aula_classes (
 month_id text not null references bcpol_private.aula_months(month_id) on delete restrict,
 lesson_number integer not null check(lesson_number between 1 and 70),
 title text not null check(length(title) between 3 and 160),
 drive_url text not null default '',
 published boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by text,
 primary key(month_id,lesson_number),
 constraint aula_published_folder check(
 not published or drive_url ~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+/?$')
);
create table if not exists bcpol_private.aula_admins (
 username text primary key references bcpol_private.web_accounts(username) on delete restrict,
 enabled boolean not null default false
);
create table if not exists bcpol_private.aula_access_audit (
 id bigint generated always as identity primary key,
 username text not null,
 month_id text not null,
 old_granted boolean,
 new_granted boolean not null,
 old_drive_verified boolean,
 new_drive_verified boolean not null,
 changed_by text not null,
 changed_at timestamptz not null default now()
);
-- Admin mode MUST remain disabled until password rotation and authentication recheck.
insert into bcpol_private.aula_admins(username,enabled)
select 'bcpol',false from bcpol_private.web_accounts where username='bcpol'
on conflict(username) do nothing;
alter table bcpol_private.aula_months enable row level security;
alter table bcpol_private.aula_emails enable row level security;
alter table bcpol_private.aula_access enable row level security;
alter table bcpol_private.aula_classes enable row level security;
alter table bcpol_private.aula_admins enable row level security;
alter table bcpol_private.aula_access_audit enable row level security;
revoke all on bcpol_private.aula_months,bcpol_private.aula_emails,bcpol_private.aula_access,bcpol_private.aula_classes,bcpol_private.aula_admins,bcpol_private.aula_access_audit from anon, authenticated;
grant usage on schema bcpol_private to service_role;
grant select on bcpol_private.aula_months,bcpol_private.aula_emails,bcpol_private.aula_access,bcpol_private.aula_classes,bcpol_private.aula_admins,bcpol_private.aula_access_audit to service_role;
grant insert,update on bcpol_private.aula_emails,bcpol_private.aula_access,bcpol_private.aula_classes to service_role;
grant insert on bcpol_private.aula_access_audit to service_role;
grant usage,select on sequence bcpol_private.aula_access_audit_id_seq to service_role;

create or replace function public.bcpol_aula_api(
 p_token_hash text, p_action text, p_payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security definer
set search_path to pg_catalog, bcpol_private
as $func$
declare
 v_user text; v_admin boolean:=false;
 v_target text; v_month text; v_mail text; v_title text; v_url text;
 v_granted boolean; v_verified boolean; v_published boolean; v_number integer;
 v_months jsonb; v_students jsonb;
 v_previous record;
begin
 if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' or
    p_action is null or length(p_action)>30 or
    pg_catalog.octet_length(coalesce(p_payload::text,''))>3500 then
  return jsonb_build_object('ok',false,'error','Solicitud no válida');
 end if;
 select public.bcpol_web_auth_verify(p_token_hash) into v_user;
 if v_user is null then
  return jsonb_build_object('ok',false,'error','Sesión caducada o no válida');
 end if;
 select enabled into v_admin from bcpol_private.aula_admins where username=v_user;
 v_admin:=coalesce(v_admin,false);
 if p_action='mine' then
   select coalesce(jsonb_agg(jsonb_build_object(
    'id',m.month_id,'label',m.label,
    'granted',coalesce(a.granted,false),
    'drive_ready',(coalesce(a.granted,false) and coalesce(a.drive_verified,false)),
    'classes',case when a.granted and a.drive_verified then
     coalesce((select jsonb_agg(jsonb_build_object('title',c.title,'drive_url',c.drive_url)
                order by c.lesson_number)
       from bcpol_private.aula_classes c
       where c.month_id=m.month_id and c.published), '[]'::jsonb)
     else '[]'::jsonb end
   ) order by m.sort_order),'[]'::jsonb)
    into v_months
    from bcpol_private.aula_months m
    left join bcpol_private.aula_access a on a.month_id=m.month_id and a.username=v_user;
   return jsonb_build_object('ok',true,'months',v_months,'is_admin',v_admin);
 end if;
 if not v_admin then
  return jsonb_build_object('ok',false,'error','Administración no habilitada');
 end if;
 if p_action='admin_snapshot' then
   select coalesce(jsonb_agg(jsonb_build_object(
    'username',a.username,'google_email',coalesce(e.google_email,''),
    'access',coalesce((select jsonb_agg(jsonb_build_object(
        'month_id',x.month_id,'granted',x.granted,'drive_verified',x.drive_verified)
        order by x.month_id)
        from bcpol_private.aula_access x where x.username=a.username),'[]'::jsonb)
   ) order by a.username),'[]'::jsonb)
   into v_students from bcpol_private.web_accounts a
   left join bcpol_private.aula_emails e on e.username=a.username
   where a.username<>'bcpol';
   select coalesce(jsonb_agg(jsonb_build_object('id',m.month_id,'label',m.label)
       order by m.sort_order),'[]'::jsonb) into v_months
   from bcpol_private.aula_months m;
   return jsonb_build_object('ok',true,'is_admin',true,'students',v_students,'months',v_months);
 end if;
 if p_action='set_email' then
   v_target:=p_payload->>'username'; v_mail:=lower(trim(coalesce(p_payload->>'google_email','')));
   if v_target is null or v_target='bcpol' or not exists
      (select 1 from bcpol_private.web_accounts a where a.username=v_target)
      or length(v_mail)>254 or (v_mail<>'' and
      v_mail !~ '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+[.][A-Za-z]{2,}$') then
     return jsonb_build_object('ok',false,'error','Alumno o correo no válido');
   end if;
   insert into bcpol_private.aula_emails(username,google_email,updated_by)
   values(v_target,nullif(v_mail,''),v_user)
   on conflict(username) do update set google_email=excluded.google_email,
   updated_at=now(), updated_by=v_user;
   return jsonb_build_object('ok',true);
 end if;
 if p_action='set_access' then
  v_target:=p_payload->>'username';v_month:=p_payload->>'month_id';
  if jsonb_typeof(p_payload->'granted')<>'boolean' or
     jsonb_typeof(p_payload->'drive_verified')<>'boolean' then
    return jsonb_build_object('ok',false,'error','Estado de acceso incorrecto');
  end if;
  v_granted:=(p_payload->>'granted')::boolean;
  v_verified:=(p_payload->>'drive_verified')::boolean;
  if v_target is null or v_target='bcpol' or v_month is null or
     not exists(select 1 from bcpol_private.web_accounts a where a.username=v_target) or
     not exists(select 1 from bcpol_private.aula_months m where m.month_id=v_month) or
     (v_verified and not v_granted) then
    return jsonb_build_object('ok',false,'error','Alumno, mes o permiso incorrecto');
  end if;
  select granted,drive_verified into v_previous
   from bcpol_private.aula_access where username=v_target and month_id=v_month for update;
  insert into bcpol_private.aula_access(username,month_id,granted,drive_verified,updated_by)
   values(v_target,v_month,v_granted,v_verified,v_user)
   on conflict(username,month_id) do update set granted=excluded.granted,
    drive_verified=excluded.drive_verified,updated_by=v_user,updated_at=now();
  insert into bcpol_private.aula_access_audit(username,month_id,old_granted,
   new_granted,old_drive_verified,new_drive_verified,changed_by)
   values(v_target,v_month,v_previous.granted,v_granted,v_previous.drive_verified,v_verified,v_user);
  return jsonb_build_object('ok',true);
 end if;
 if p_action='save_class' then
  v_month:=p_payload->>'month_id'; v_title:=trim(coalesce(p_payload->>'title',''));
  v_url:=trim(coalesce(p_payload->>'drive_url',''));
  if jsonb_typeof(p_payload->'lesson_number')<>'number' or
     jsonb_typeof(p_payload->'published')<>'boolean' then
    return jsonb_build_object('ok',false,'error','Datos de la clase incompletos');
  end if;
  v_number:=(p_payload->>'lesson_number')::integer;
  v_published:=(p_payload->>'published')::boolean;
  if not exists(select 1 from bcpol_private.aula_months m where m.month_id=v_month)
     or v_number<1 or v_number>70 or length(v_title)<3 or length(v_title)>160
     or length(v_url)>500 or (v_url<>'' and
      v_url !~ '^https://drive[.]google[.]com/drive/folders/[A-Za-z0-9_-]+/?$')
     or (v_published and v_url='') then
   return jsonb_build_object('ok',false,'error','Mes, número, título o URL no válidos');
  end if;
  insert into bcpol_private.aula_classes(month_id,lesson_number,title,drive_url,published,updated_by)
   values(v_month,v_number,v_title,v_url,v_published,v_user)
   on conflict(month_id,lesson_number) do update set title=excluded.title,
    drive_url=excluded.drive_url,published=excluded.published,updated_by=v_user,updated_at=now();
  return jsonb_build_object('ok',true);
 end if;
 return jsonb_build_object('ok',false,'error','Acción desconocida');
exception when others then
 return jsonb_build_object('ok',false,'error','Operación no disponible');
end
$func$;

revoke all on function public.bcpol_aula_api(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.bcpol_aula_api(text,text,jsonb) to service_role;