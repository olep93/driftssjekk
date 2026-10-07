-- Driftssjekk: all exposed data uses RLS. Mutations are limited to checked RPCs.
create extension if not exists pgcrypto;
create schema if not exists app_private;

create type public.member_role as enum ('operations', 'store_manager', 'cooperative_admin');
create type public.report_kind as enum ('inspection', 'self_check');
create type public.version_state as enum ('draft', 'published');
create type public.round_state as enum ('planned', 'active', 'closed');

create table public.cooperatives (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id),
  name text not null,
  code text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (cooperative_id, id),
  unique (cooperative_id, name)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cooperative_id uuid not null references public.cooperatives(id),
  store_id uuid,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, cooperative_id, store_id, role),
  foreign key (cooperative_id, store_id) references public.stores(cooperative_id, id),
  check ((role = 'store_manager' and store_id is not null) or (role <> 'store_manager' and store_id is null))
);
create unique index memberships_coop_role_unique on public.memberships(user_id, cooperative_id, role) where store_id is null;
create index memberships_user_idx on public.memberships(user_id, cooperative_id, store_id);

create table public.rounds (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id),
  title text not null,
  sequence_no integer not null,
  planned_from date,
  planned_to date,
  status public.round_state not null default 'planned',
  summary text not null default '',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  unique (cooperative_id, id),
  unique (cooperative_id, sequence_no),
  check (planned_to is null or planned_from is null or planned_to >= planned_from)
);
create table public.round_stores (
  round_id uuid not null,
  cooperative_id uuid not null,
  store_id uuid not null,
  planned_visit date,
  exception_reason text,
  primary key (round_id, store_id),
  foreign key (cooperative_id, round_id) references public.rounds(cooperative_id, id),
  foreign key (cooperative_id, store_id) references public.stores(cooperative_id, id),
  check (exception_reason is null or length(trim(exception_reason)) > 0)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null,
  store_id uuid not null,
  round_id uuid,
  kind public.report_kind not null,
  created_by uuid not null references auth.users(id),
  current_version_id uuid,
  archived_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  created_at timestamptz not null default now(),
  unique (id, cooperative_id),
  foreign key (cooperative_id, store_id) references public.stores(cooperative_id, id),
  foreign key (cooperative_id, round_id) references public.rounds(cooperative_id, id),
  check (round_id is null or kind = 'inspection'),
  check ((withdrawn_at is null) = (withdrawal_reason is null))
);
create unique index one_inspection_per_round_store on public.reports(round_id, store_id) where round_id is not null;
create index reports_store_idx on public.reports(cooperative_id, store_id, created_at desc);
create index reports_round_idx on public.reports(round_id) where round_id is not null;

create table public.report_versions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id),
  version_no integer not null check (version_no > 0),
  state public.version_state not null default 'draft',
  visit_date date,
  summary text not null default '',
  assessor_id uuid not null references auth.users(id),
  change_reason text,
  lock_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by uuid references auth.users(id),
  unique (report_id, version_no),
  unique (report_id, id),
  check ((state = 'draft' and published_at is null) or (state = 'published' and published_at is not null)),
  check (lock_version > 0)
);
alter table public.reports add constraint current_version_belongs_to_report
  foreign key (id, current_version_id) references public.report_versions(report_id, id) deferrable initially deferred;
create unique index one_draft_per_report on public.report_versions(report_id) where state = 'draft';
create index versions_visit_idx on public.report_versions(visit_date desc, state);

create table public.area_assessments (
  version_id uuid not null references public.report_versions(id),
  area_key text not null check (area_key in ('drive_in','store','outdoor','goods_receiving')),
  score_quarters integer check (score_quarters between 4 and 40),
  comment text not null default '',
  needs_follow_up boolean not null default false,
  primary key (version_id, area_key)
);
create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null,
  area_key text not null,
  object_path text not null,
  caption text not null default '',
  sort_order integer not null default 0,
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size integer not null check (byte_size between 1 and 10485760),
  created_at timestamptz not null default now(),
  foreign key (version_id, area_key) references public.area_assessments(version_id, area_key),
  unique (version_id, object_path)
);
create index images_version_idx on public.report_images(version_id, area_key, sort_order);

create table public.publication_snapshots (
  version_id uuid primary key references public.report_versions(id),
  schema_version integer not null default 1,
  content jsonb not null,
  total_quarters_sum integer not null check (total_quarters_sum between 16 and 160),
  created_at timestamptz not null default now()
);
create table public.actions (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id),
  area_key text check (area_key in ('drive_in','store','outdoor','goods_receiving')),
  description text not null check (length(trim(description)) > 0),
  assigned_to uuid references auth.users(id),
  due_date date,
  status text not null default 'open' check (status in ('open','in_progress','done')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.action_updates (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id),
  actor_id uuid not null references auth.users(id),
  old_status text,
  new_status text,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create table public.exports (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references public.report_versions(id),
  requested_by uuid not null references auth.users(id),
  kind text not null check (kind in ('report_pdf','round_pdf','period_pdf')),
  filters jsonb not null default '{}'::jsonb,
  object_path text,
  status text not null default 'pending' check (status in ('pending','processing','ready','failed')),
  error text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index one_pdf_per_version on public.exports(version_id) where kind = 'report_pdf';
create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.report_versions(id),
  recipient_id uuid not null references auth.users(id),
  recipient_email text not null,
  idempotency_key text not null unique,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  attempts integer not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.audit_events (
  id bigint generated always as identity primary key,
  cooperative_id uuid not null references public.cooperatives(id),
  actor_id uuid references auth.users(id),
  event_type text not null,
  object_type text not null,
  object_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create function app_private.has_role(p_coop uuid, p_role public.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.cooperative_id = p_coop and m.role = p_role);
$$;
create function app_private.manages_store(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.store_id = p_store and m.role = 'store_manager');
$$;
create function app_private.can_read_report(p_report uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = p_report and (
    app_private.has_role(r.cooperative_id, 'operations') or
    (app_private.manages_store(r.store_id) and (r.current_version_id is not null or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))));
$$;
create function app_private.can_read_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and (
      app_private.has_role(r.cooperative_id, 'operations') or
      (app_private.manages_store(r.store_id) and (
        v.state = 'published' or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))));
$$;
create function app_private.can_edit_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and v.state = 'draft' and (
      (r.kind = 'inspection' and app_private.has_role(r.cooperative_id, 'operations')) or
      (r.kind = 'self_check' and r.created_by = (select auth.uid()) and app_private.manages_store(r.store_id))));
$$;
create function app_private.version_from_path(p_name text)
returns uuid language sql immutable set search_path = '' as $$
  select case when p_name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    then split_part(p_name,'/',1)::uuid else null end;
$$;
revoke all on all functions in schema app_private from public;
grant usage on schema app_private to authenticated;
grant execute on all functions in schema app_private to authenticated;

alter table public.cooperatives enable row level security;
alter table public.stores enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.rounds enable row level security;
alter table public.round_stores enable row level security;
alter table public.reports enable row level security;
alter table public.report_versions enable row level security;
alter table public.area_assessments enable row level security;
alter table public.report_images enable row level security;
alter table public.publication_snapshots enable row level security;
alter table public.actions enable row level security;
alter table public.action_updates enable row level security;
alter table public.exports enable row level security;
alter table public.notification_outbox enable row level security;
alter table public.audit_events enable row level security;

create policy coop_read on public.cooperatives for select to authenticated using (
  exists (select 1 from public.memberships m where m.user_id = (select auth.uid()) and m.cooperative_id = id));
create policy store_read on public.stores for select to authenticated using (
  app_private.has_role(cooperative_id, 'operations') or app_private.has_role(cooperative_id, 'cooperative_admin') or app_private.manages_store(id));
create policy profile_read on public.profiles for select to authenticated using (
  id = (select auth.uid()) or exists (
    select 1 from public.memberships mine join public.memberships theirs on theirs.cooperative_id = mine.cooperative_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id and mine.role in ('operations','cooperative_admin')));
create policy membership_read on public.memberships for select to authenticated using (
  user_id = (select auth.uid()) or app_private.has_role(cooperative_id, 'cooperative_admin'));
create policy round_read on public.rounds for select to authenticated using (
  app_private.has_role(cooperative_id, 'operations') or exists (
    select 1 from public.round_stores rs where rs.round_id = id and app_private.manages_store(rs.store_id)));
create policy round_store_read on public.round_stores for select to authenticated using (
  app_private.has_role(cooperative_id, 'operations') or app_private.manages_store(store_id));
create policy report_read on public.reports for select to authenticated using (app_private.can_read_report(id));
create policy version_read on public.report_versions for select to authenticated using (app_private.can_read_version(id));
create policy area_read on public.area_assessments for select to authenticated using (app_private.can_read_version(version_id));
create policy image_read on public.report_images for select to authenticated using (app_private.can_read_version(version_id));
create policy snapshot_read on public.publication_snapshots for select to authenticated using (app_private.can_read_version(version_id));
create policy action_read on public.actions for select to authenticated using (app_private.can_read_report(report_id));
create policy action_update_read on public.action_updates for select to authenticated using (
  exists (select 1 from public.actions a where a.id = action_id and app_private.can_read_report(a.report_id)));
create policy export_read on public.exports for select to authenticated using (
  version_id is not null and app_private.can_read_version(version_id));
create policy audit_read on public.audit_events for select to authenticated using (
  app_private.has_role(cooperative_id, 'operations') or app_private.has_role(cooperative_id, 'cooperative_admin'));

-- Data API may read allowed rows, but may not write any table directly.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.cooperatives, public.stores, public.profiles, public.memberships,
  public.rounds, public.round_stores, public.reports, public.report_versions,
  public.area_assessments, public.report_images, public.publication_snapshots,
  public.actions, public.action_updates, public.exports, public.audit_events to authenticated;

create or replace function public.create_report(p_store uuid, p_round uuid, p_kind public.report_kind)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_store public.stores%rowtype; v_report uuid; v_version uuid; v_round public.rounds%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Ikke innlogget'; end if;
  select * into v_store from public.stores where id = p_store and active;
  if not found then raise exception 'Varehus finnes ikke'; end if;
  if p_kind = 'inspection' then
    if not app_private.has_role(v_store.cooperative_id, 'operations') then raise exception 'Ingen tilgang'; end if;
  elsif p_kind = 'self_check' then
    if not app_private.manages_store(p_store) or p_round is not null then raise exception 'Ingen tilgang'; end if;
  end if;
  if p_round is not null then
    select * into v_round from public.rounds where id = p_round and cooperative_id = v_store.cooperative_id and status <> 'closed';
    if not found or not exists (select 1 from public.round_stores where round_id = p_round and store_id = p_store and exception_reason is null)
      then raise exception 'Ugyldig rundetilknytning'; end if;
  end if;
  insert into public.reports(cooperative_id, store_id, round_id, kind, created_by)
    values (v_store.cooperative_id, p_store, p_round, p_kind, auth.uid()) returning id into v_report;
  insert into public.report_versions(report_id, version_no, assessor_id)
    values (v_report, 1, auth.uid()) returning id into v_version;
  insert into public.area_assessments(version_id, area_key)
    select v_version, unnest(array['drive_in','store','outdoor','goods_receiving']);
  insert into public.audit_events(cooperative_id, actor_id, event_type, object_type, object_id)
    values(v_store.cooperative_id, auth.uid(), 'created', 'report', v_report);
  return v_version;
end $$;

create or replace function public.save_draft(
  p_version uuid, p_lock integer, p_visit_date date, p_summary text, p_areas jsonb
) returns integer language plpgsql security definer set search_path = '' as $$
declare v public.report_versions%rowtype; r public.reports%rowtype; item jsonb; k text; q integer;
begin
  select * into v from public.report_versions where id = p_version for update;
  if not found or not app_private.can_edit_version(p_version) then raise exception 'Ingen tilgang til kladd'; end if;
  if v.lock_version <> p_lock then raise exception 'Versjonskonflikt. Last inn rapporten på nytt.' using errcode = '40001'; end if;
  if jsonb_typeof(p_areas) <> 'object' then raise exception 'Ugyldige områder'; end if;
  for k, item in select key, value from jsonb_each(p_areas) loop
    if k not in ('drive_in','store','outdoor','goods_receiving') then raise exception 'Ugyldig område'; end if;
    if item ? 'score_quarters' and item->>'score_quarters' is not null then
      if (item->>'score_quarters') !~ '^[0-9]+$' then raise exception 'Ugyldig karakter'; end if;
      q := (item->>'score_quarters')::integer;
      if q < 4 or q > 40 then raise exception 'Ugyldig karakter'; end if;
    else q := null; end if;
    update public.area_assessments set score_quarters = q,
      comment = coalesce(item->>'comment',''),
      needs_follow_up = coalesce((item->>'needs_follow_up')::boolean, false)
      where version_id = p_version and area_key = k;
  end loop;
  update public.report_versions set visit_date = p_visit_date, summary = coalesce(p_summary,''),
    lock_version = lock_version + 1, updated_at = now() where id = p_version returning lock_version into p_lock;
  select * into r from public.reports where id = v.report_id;
  insert into public.audit_events(cooperative_id, actor_id, event_type, object_type, object_id)
    values(r.cooperative_id, auth.uid(), 'draft_saved', 'report_version', p_version);
  return p_lock;
end $$;

create or replace function public.add_report_image(
  p_version uuid, p_area text, p_path text, p_caption text, p_type text, p_size integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.can_edit_version(p_version) then raise exception 'Ingen tilgang'; end if;
  if p_area not in ('drive_in','store','outdoor','goods_receiving') or
     p_path not like p_version::text || '/%' or
     p_type not in ('image/jpeg','image/png','image/webp') or
     p_size not between 1 and 10485760 then raise exception 'Ugyldig bilde'; end if;
  if (select count(*) from public.report_images where version_id = p_version and area_key = p_area) >= 20
    then raise exception 'Maksimalt 20 bilder per område'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'report-images' and name = p_path)
    then raise exception 'Bilde er ikke lastet opp'; end if;
  insert into public.report_images(version_id, area_key, object_path, caption, content_type, byte_size)
    values(p_version, p_area, p_path, coalesce(p_caption,''), p_type, p_size) returning id into v_id;
  return v_id;
end $$;

create or replace function public.remove_report_image(p_image uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare i public.report_images%rowtype;
begin
  select * into i from public.report_images where id = p_image for update;
  if not found or not app_private.can_edit_version(i.version_id) then raise exception 'Ingen tilgang'; end if;
  delete from public.report_images where id = p_image;
  return i.object_path;
end $$;

create or replace function public.publish_report(p_version uuid, p_lock integer, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.report_versions%rowtype; r public.reports%rowtype; s public.stores%rowtype;
  v_sum integer; v_count integer; v_snapshot jsonb; v_name text; v_round text;
begin
  select * into v from public.report_versions where id = p_version for update;
  if not found or not app_private.can_edit_version(p_version) then raise exception 'Ingen tilgang til kladd'; end if;
  if v.lock_version <> p_lock then raise exception 'Versjonskonflikt. Last inn rapporten på nytt.' using errcode = '40001'; end if;
  select * into r from public.reports where id = v.report_id for update;
  if r.withdrawn_at is not null then raise exception 'Tilbaketrukket rapport'; end if;
  if r.round_id is not null and exists(select 1 from public.rounds where id = r.round_id and status = 'closed')
    then raise exception 'Runden er avsluttet'; end if;
  if v.visit_date is null then raise exception 'Besøksdato mangler'; end if;
  if v.version_no > 1 and length(trim(coalesce(p_reason,''))) = 0 then raise exception 'Endringsbegrunnelse mangler'; end if;
  select count(*), sum(score_quarters) into v_count, v_sum from public.area_assessments
    where version_id = p_version and score_quarters between 4 and 40;
  if v_count <> 4 then raise exception 'Alle fire områder må vurderes'; end if;
  select * into s from public.stores where id = r.store_id;
  select display_name into v_name from public.profiles where id = v.assessor_id;
  select title into v_round from public.rounds where id = r.round_id;
  select jsonb_build_object('schema_version',1,'calculation','equal_weight_quarters_v1',
    'report_id',r.id,'version_id',v.id,'version_no',v.version_no,'kind',r.kind,
    'cooperative_name',(select name from public.cooperatives where id = r.cooperative_id),
    'store_name',s.name,'round_title',v_round,'visit_date',v.visit_date,
    'assessor_name',coalesce(v_name,''),'summary',v.summary,'total',v_sum::numeric / 16,
    'areas',(select jsonb_agg(jsonb_build_object('key',a.area_key,'score_quarters',a.score_quarters,
      'comment',a.comment,'needs_follow_up',a.needs_follow_up,
      'images',(select coalesce(jsonb_agg(jsonb_build_object('path',i.object_path,'caption',i.caption)
        order by i.sort_order), '[]'::jsonb) from public.report_images i
        where i.version_id = a.version_id and i.area_key = a.area_key)) order by a.area_key)
      from public.area_assessments a where a.version_id = v.id)) into v_snapshot;
  update public.report_versions set state = 'published', published_at = now(), published_by = auth.uid(),
    change_reason = p_reason, lock_version = lock_version + 1 where id = p_version;
  insert into public.publication_snapshots(version_id, content, total_quarters_sum) values(p_version,v_snapshot,v_sum);
  update public.reports set current_version_id = p_version where id = r.id;
  insert into public.exports(version_id, requested_by, kind) values(p_version,auth.uid(),'report_pdf')
    on conflict do nothing;
  if r.kind = 'inspection' then
    insert into public.notification_outbox(version_id,recipient_id,recipient_email,idempotency_key)
      select p_version,m.user_id,u.email,p_version::text || ':' || m.user_id::text
      from public.memberships m join auth.users u on u.id = m.user_id
      where m.store_id = r.store_id and m.role = 'store_manager' and u.email is not null
      on conflict do nothing;
  end if;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'published','report_version',p_version,
      jsonb_build_object('version_no',v.version_no,'reason',p_reason));
  return r.id;
end $$;

create or replace function public.correct_report(p_report uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v public.report_versions%rowtype; v_new uuid;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not (
    (r.kind = 'inspection' and app_private.has_role(r.cooperative_id,'operations')) or
    (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id))
  ) then raise exception 'Ingen tilgang'; end if;
  if r.withdrawn_at is not null or r.current_version_id is null then raise exception 'Rapport kan ikke korrigeres'; end if;
  if r.round_id is not null and exists(select 1 from public.rounds where id = r.round_id and status = 'closed')
    then raise exception 'Gjenåpne runden først'; end if;
  if exists(select 1 from public.report_versions where report_id = p_report and state = 'draft') then raise exception 'Kladd finnes allerede'; end if;
  select * into v from public.report_versions where id = r.current_version_id;
  insert into public.report_versions(report_id,version_no,visit_date,summary,assessor_id)
    values(p_report,v.version_no+1,v.visit_date,v.summary,auth.uid()) returning id into v_new;
  insert into public.area_assessments(version_id,area_key,score_quarters,comment,needs_follow_up)
    select v_new,area_key,score_quarters,comment,needs_follow_up from public.area_assessments where version_id = v.id;
  insert into public.report_images(version_id,area_key,object_path,caption,sort_order,content_type,byte_size)
    select v_new,area_key,object_path,caption,sort_order,content_type,byte_size
    from public.report_images where version_id = v.id;
  -- The new draft references immutable published image objects; deletion removes only draft metadata.
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'correction_started','report',p_report);
  return v_new;
end $$;

create or replace function public.create_round(
  p_coop uuid, p_title text, p_from date, p_to date, p_stores uuid[]
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_sequence integer;
begin
  if not app_private.has_role(p_coop,'operations') then raise exception 'Ingen tilgang'; end if;
  if length(trim(p_title)) = 0 or p_stores is null or cardinality(p_stores) = 0 or (p_to is not null and p_from is not null and p_to < p_from)
    then raise exception 'Ugyldig runde'; end if;
  if exists(select 1 from unnest(p_stores) id left join public.stores s on s.id = id
    where s.id is null or s.cooperative_id <> p_coop or not s.active) then raise exception 'Ugyldig varehus'; end if;
  perform pg_advisory_xact_lock(hashtext(p_coop::text));
  select coalesce(max(sequence_no),0)+1 into v_sequence from public.rounds where cooperative_id = p_coop;
  insert into public.rounds(cooperative_id,title,sequence_no,planned_from,planned_to,created_by)
    values(p_coop,trim(p_title),v_sequence,p_from,p_to,auth.uid()) returning id into v_id;
  insert into public.round_stores(round_id,cooperative_id,store_id)
    select v_id,p_coop,distinct_id from (select distinct unnest(p_stores) distinct_id) x;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(p_coop,auth.uid(),'created','round',v_id);
  return v_id;
end $$;

create or replace function public.set_round_status(p_round uuid, p_status public.round_state, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rounds%rowtype; v_expected integer; v_done integer;
begin
  select * into r from public.rounds where id = p_round for update;
  if not found or not app_private.has_role(r.cooperative_id,'operations') then raise exception 'Ingen tilgang'; end if;
  if r.status = 'closed' and p_status <> 'closed' and length(trim(coalesce(p_reason,''))) = 0
    then raise exception 'Begrunnelse kreves for gjenåpning'; end if;
  if (r.status = 'planned' and p_status = 'closed') or (r.status = 'active' and p_status = 'planned')
    then raise exception 'Ugyldig statusovergang'; end if;
  if p_status = 'closed' then
    select count(*) into v_expected from public.round_stores rs
      where rs.round_id = p_round and rs.exception_reason is null;
    select count(*) into v_done from public.round_stores rs
      where rs.round_id = p_round and rs.exception_reason is null and exists (
        select 1 from public.reports rp where rp.round_id = rs.round_id and rp.store_id = rs.store_id
        and rp.current_version_id is not null and rp.withdrawn_at is null);
    if v_expected <> v_done then raise exception 'Alle forventede varehus må publiseres eller unntas'; end if;
  end if;
  update public.rounds set status = p_status, closed_at = case when p_status = 'closed' then now() else null end where id = p_round;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'status_changed','round',p_round,jsonb_build_object('from',r.status,'to',p_status,'reason',p_reason));
end $$;

create or replace function public.set_round_exception(p_round uuid, p_store uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rounds%rowtype;
begin
  select * into r from public.rounds where id = p_round;
  if not found or not app_private.has_role(r.cooperative_id,'operations') or r.status = 'closed'
    then raise exception 'Ingen tilgang'; end if;
  if length(trim(coalesce(p_reason,''))) = 0 then raise exception 'Begrunnelse kreves'; end if;
  if exists(select 1 from public.reports where round_id = p_round and store_id = p_store and current_version_id is not null and withdrawn_at is null)
    then raise exception 'Publisert varehus kan ikke unntas'; end if;
  update public.round_stores set exception_reason = trim(p_reason) where round_id = p_round and store_id = p_store;
  if not found then raise exception 'Varehus er ikke med i runden'; end if;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'excepted','round_store',p_store,jsonb_build_object('round_id',p_round,'reason',p_reason));
end $$;

create or replace function public.create_action(p_report uuid, p_area text, p_description text, p_assignee uuid, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_id uuid;
begin
  select * into r from public.reports where id = p_report;
  if not found or not app_private.can_read_report(p_report) then raise exception 'Ingen tilgang'; end if;
  if not (app_private.has_role(r.cooperative_id,'operations') or app_private.manages_store(r.store_id))
    then raise exception 'Ingen tilgang'; end if;
  if p_assignee is not null and not exists(select 1 from public.memberships where user_id = p_assignee
    and (store_id = r.store_id or (cooperative_id = r.cooperative_id and role = 'operations')))
    then raise exception 'Ansvarlig mangler tilgang'; end if;
  insert into public.actions(report_id,area_key,description,assigned_to,due_date,created_by)
    values(p_report,p_area,p_description,p_assignee,p_due,auth.uid()) returning id into v_id;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'created','action',v_id);
  return v_id;
end $$;
create or replace function public.update_action(p_action uuid, p_status text, p_comment text)
returns void language plpgsql security definer set search_path = '' as $$
declare a public.actions%rowtype; r public.reports%rowtype;
begin
  select * into a from public.actions where id = p_action for update;
  if not found then raise exception 'Tiltak finnes ikke'; end if;
  select * into r from public.reports where id = a.report_id;
  if not (app_private.has_role(r.cooperative_id,'operations') or app_private.manages_store(r.store_id))
    then raise exception 'Ingen tilgang'; end if;
  if p_status not in ('open','in_progress','done') then raise exception 'Ugyldig status'; end if;
  update public.actions set status = p_status, updated_at = now() where id = p_action;
  insert into public.action_updates(action_id,actor_id,old_status,new_status,comment)
    values(p_action,auth.uid(),a.status,p_status,coalesce(p_comment,''));
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'updated','action',p_action);
end $$;

revoke all on function public.create_report(uuid,uuid,public.report_kind),
  public.save_draft(uuid,integer,date,text,jsonb), public.add_report_image(uuid,text,text,text,text,integer), public.remove_report_image(uuid),
  public.publish_report(uuid,integer,text), public.correct_report(uuid),
  public.create_round(uuid,text,date,date,uuid[]), public.set_round_status(uuid,public.round_state,text),
  public.set_round_exception(uuid,uuid,text), public.create_action(uuid,text,text,uuid,date),
  public.update_action(uuid,text,text) from public, anon;
grant execute on function public.create_report(uuid,uuid,public.report_kind),
  public.save_draft(uuid,integer,date,text,jsonb), public.add_report_image(uuid,text,text,text,text,integer), public.remove_report_image(uuid),
  public.publish_report(uuid,integer,text), public.correct_report(uuid),
  public.create_round(uuid,text,date,date,uuid[]), public.set_round_status(uuid,public.round_state,text),
  public.set_round_exception(uuid,uuid,text), public.create_action(uuid,text,text,uuid,date),
  public.update_action(uuid,text,text) to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values ('report-images','report-images',false,10485760,array['image/jpeg','image/png','image/webp'])
  on conflict (id) do nothing;
insert into storage.buckets(id,name,public)
  values ('report-exports','report-exports',false) on conflict (id) do nothing;
create policy report_image_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'report-images' and app_private.can_read_version(app_private.version_from_path(name)));
create policy report_image_storage_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'report-images' and app_private.can_edit_version(app_private.version_from_path(name))
    and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$');
create policy report_image_storage_delete on storage.objects for delete to authenticated
  using (bucket_id = 'report-images' and app_private.can_edit_version(app_private.version_from_path(name)));
create policy report_export_storage_read on storage.objects for select to authenticated
  using (bucket_id = 'report-exports' and exists (
    select 1 from public.exports e where e.object_path = name and e.status = 'ready'
    and e.version_id is not null and app_private.can_read_version(e.version_id)));
