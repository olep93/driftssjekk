begin;

-- A training event assigns one scored concept assessment to each invited store manager.
-- Event assessments use the existing report editor but never enter the official
-- inspection ranking or the monthly progress series.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  cooperative_id uuid not null references public.cooperatives(id),
  title text not null check (length(trim(title)) between 3 and 150),
  description text not null default '',
  location_store_id uuid not null,
  target_mode text not null check (target_mode in ('host','own')),
  starts_at timestamptz not null,
  ends_at timestamptz,
  status text not null default 'planned' check (status in ('planned','closed')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (cooperative_id,location_store_id) references public.stores(cooperative_id,id),
  check (ends_at is null or ends_at >= starts_at)
);
create index events_coop_time_idx on public.events(cooperative_id,starts_at desc);

create table public.event_participants (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  home_store_id uuid not null references public.stores(id),
  target_store_id uuid not null references public.stores(id),
  created_at timestamptz not null default now(),
  primary key (event_id,user_id)
);
create index event_participants_user_idx on public.event_participants(user_id,event_id);

alter table public.reports add column event_id uuid references public.events(id);
alter table public.reports add constraint reports_event_kind_check
  check (event_id is null or (kind = 'self_check' and round_id is null));
create unique index one_event_report_per_manager on public.reports(event_id,created_by) where event_id is not null;

create or replace function app_private.can_read_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and
    (e.created_by = (select auth.uid()) or app_private.can_operate_store(e.location_store_id) or
     exists (select 1 from public.event_participants ep where ep.event_id = e.id and ep.user_id = (select auth.uid()))));
$$;
create or replace function app_private.can_manage_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events e where e.id = p_event and
    app_private.can_operate_store(e.location_store_id));
$$;
create or replace function app_private.can_read_event_report(p_report uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = p_report and r.event_id is not null and
    ((r.created_by = (select auth.uid())) or
     app_private.can_manage_event(r.event_id)));
$$;
revoke all on function app_private.can_read_event(uuid),app_private.can_manage_event(uuid),app_private.can_read_event_report(uuid) from public,anon;
grant execute on function app_private.can_read_event(uuid),app_private.can_manage_event(uuid),app_private.can_read_event_report(uuid) to authenticated;

alter table public.events enable row level security;
alter table public.event_participants enable row level security;
create policy event_read on public.events for select to authenticated using (app_private.can_read_event(id));
create policy event_participant_read on public.event_participants for select to authenticated using
  (user_id = (select auth.uid()) or app_private.can_manage_event(event_id));
grant select on public.events,public.event_participants to authenticated;

drop policy if exists membership_read on public.memberships;
create policy membership_read on public.memberships for select to authenticated using
  (user_id = (select auth.uid()) or app_private.has_role(cooperative_id,'cooperative_admin') or
   (role = 'store_manager' and store_id is not null and app_private.can_operate_store(store_id)));
drop policy if exists store_read on public.stores;
create policy store_read on public.stores for select to authenticated using
  (app_private.can_operate_store(id) or app_private.has_role(cooperative_id,'cooperative_admin') or
   app_private.manages_store(id) or exists
   (select 1 from public.event_participants ep where ep.target_store_id = id and ep.user_id = (select auth.uid())));

create or replace function app_private.can_read_report(p_report uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = p_report and (
    (r.event_id is not null and app_private.can_read_event_report(r.id)) or
    (r.event_id is null and (app_private.can_operate_store(r.store_id) or
      (app_private.manages_store(r.store_id) and
        (r.current_version_id is not null or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))))));
$$;
create or replace function app_private.can_read_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and (
      (r.event_id is not null and (r.created_by = (select auth.uid()) or
        app_private.can_manage_event(r.event_id))) or
      (r.event_id is null and (app_private.can_operate_store(r.store_id) or
        (app_private.manages_store(r.store_id) and
          (v.state = 'published' or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))))));
$$;
create or replace function app_private.can_edit_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and v.state = 'draft' and (
      (r.event_id is not null and r.created_by = (select auth.uid()) and
        exists (select 1 from public.events e join public.event_participants ep on ep.event_id = e.id
          join public.memberships m on m.user_id = ep.user_id and m.store_id = ep.home_store_id and m.role = 'store_manager'
          where e.id = r.event_id and e.status = 'planned' and ep.user_id = (select auth.uid()))) or
      (r.event_id is null and ((r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
        (r.kind = 'self_check' and r.created_by = (select auth.uid()) and app_private.manages_store(r.store_id))))));
$$;

create function public.create_event(p_coop uuid,p_title text,p_description text,p_location uuid,
  p_mode text,p_starts timestamptz,p_ends timestamptz,p_users uuid[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_user uuid; v_home uuid; v_target uuid;
begin
  if not app_private.can_operate_store(p_location) or
     not exists(select 1 from public.stores where id = p_location and cooperative_id = p_coop and active)
    then raise exception 'Ingen tilgang til samlingsvarehuset'; end if;
  if length(trim(coalesce(p_title,''))) not between 3 and 150 or p_mode not in ('host','own') or
     p_starts is null or (p_ends is not null and p_ends < p_starts) or
     coalesce(cardinality(p_users),0) = 0 or cardinality(p_users) > 100
    then raise exception 'Ugyldige samlingsdata'; end if;
  if (select count(distinct candidate.user_id) from unnest(p_users) as candidate(user_id)) <> cardinality(p_users)
    then raise exception 'Velg hver deltaker én gang'; end if;
  -- Resolve each participant to one of the caller's assigned stores.
  for v_user in select unnest(p_users) loop
    select m.store_id into v_home from public.memberships m join public.stores s on s.id = m.store_id
      where m.user_id = v_user and m.cooperative_id = p_coop and m.role = 'store_manager'
        and s.active and app_private.can_operate_store(m.store_id)
      order by s.name limit 1;
    if v_home is null then raise exception 'En deltaker mangler varehustilgang hos driftssjef'; end if;
  end loop;
  insert into public.events(cooperative_id,title,description,location_store_id,target_mode,starts_at,ends_at,created_by)
    values(p_coop,trim(p_title),trim(coalesce(p_description,'')),p_location,p_mode,p_starts,p_ends,auth.uid()) returning id into v_id;
  for v_user in select unnest(p_users) loop
    select m.store_id into v_home from public.memberships m join public.stores s on s.id = m.store_id
      where m.user_id = v_user and m.cooperative_id = p_coop and m.role = 'store_manager'
        and s.active and app_private.can_operate_store(m.store_id)
      order by s.name limit 1;
    v_target := case when p_mode = 'host' then p_location else v_home end;
    insert into public.event_participants(event_id,user_id,home_store_id,target_store_id)
      values(v_id,v_user,v_home,v_target);
  end loop;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(p_coop,auth.uid(),'created','event',v_id,jsonb_build_object('participants',cardinality(p_users)));
  return v_id;
end $$;

create function public.admin_delete_event(p_event uuid,p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Ingen tilgang'; end if;
  select * into e from public.events where id = p_event for update;
  if not found then raise exception 'Samlingen finnes ikke'; end if;
  if exists(select 1 from public.reports where event_id = p_event) then raise exception 'Slett vurderingene først'; end if;
  delete from public.events where id = p_event;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(e.cooperative_id,p_actor,'deleted','event',p_event);
end $$;
revoke all on function public.admin_delete_event(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_event(uuid,uuid) to service_role;

create function public.create_event_report(p_event uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype; p public.event_participants%rowtype; v_report uuid; v_version uuid;
begin
  select * into e from public.events where id = p_event;
  if not found or e.status <> 'planned' then raise exception 'Samlingen er ikke åpen'; end if;
  select * into p from public.event_participants where event_id = p_event and user_id = auth.uid();
  if not found or not exists(select 1 from public.memberships where user_id = auth.uid() and role = 'store_manager' and store_id = p.home_store_id)
    then raise exception 'Ingen tilgang til denne samlingen'; end if;
  if exists(select 1 from public.reports where event_id = p_event and created_by = auth.uid())
    then raise exception 'Du har allerede startet denne vurderingen'; end if;
  insert into public.reports(cooperative_id,store_id,event_id,kind,created_by)
    values(e.cooperative_id,p.target_store_id,p_event,'self_check',auth.uid()) returning id into v_report;
  insert into public.report_versions(report_id,version_no,assessor_id)
    values(v_report,1,auth.uid()) returning id into v_version;
  insert into public.area_assessments(version_id,area_key)
    select v_version,unnest(array['drive_in','store','outdoor','goods_receiving']);
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(e.cooperative_id,auth.uid(),'created','event_report',v_report);
  return v_version;
end $$;

create function public.set_event_status(p_event uuid,p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype;
begin
  select * into e from public.events where id = p_event for update;
  if not found or not app_private.can_manage_event(p_event) then raise exception 'Ingen tilgang'; end if;
  if p_status not in ('planned','closed') then raise exception 'Ugyldig status'; end if;
  update public.events set status = p_status where id = p_event;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(e.cooperative_id,auth.uid(),'status_changed','event',p_event);
end $$;
revoke all on function public.create_event(uuid,text,text,uuid,text,timestamptz,timestamptz,uuid[]),
  public.create_event_report(uuid),public.set_event_status(uuid,text) from public,anon;
grant execute on function public.create_event(uuid,text,text,uuid,text,timestamptz,timestamptz,uuid[]),
  public.create_event_report(uuid),public.set_event_status(uuid,text) to authenticated;


-- Existing report lifecycle extended for event assessments.
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
  if r.event_id is not null and exists(select 1 from public.events where id = r.event_id and status = 'closed')
    then raise exception 'Samlingen er avsluttet'; end if;
  if v.visit_date is null then raise exception 'Besøksdato mangler'; end if;
  if v.version_no > 1 and length(trim(coalesce(p_reason,''))) = 0 then raise exception 'Endringsbegrunnelse mangler'; end if;
  select count(*), sum(score_quarters) into v_count, v_sum from public.area_assessments
    where version_id = p_version and score_quarters between 4 and 40;
  if v_count <> 4 then raise exception 'Alle fire områder må vurderes'; end if;
  select * into s from public.stores where id = r.store_id;
  select display_name into v_name from public.profiles where id = v.assessor_id;
  if r.event_id is not null then
    select title into v_round from public.events where id = r.event_id;
  else
    select title into v_round from public.rounds where id = r.round_id;
  end if;
  select jsonb_build_object('schema_version',3,'calculation','equal_weight_quarters_v1',
    'report_id',r.id,'version_id',v.id,'version_no',v.version_no,'kind',case when r.event_id is not null then 'event_check' else r.kind::text end,
    'cooperative_name',(select name from public.cooperatives where id = r.cooperative_id),
    'store_name',s.name,'round_title',v_round,'visit_date',v.visit_date,
    'assessor_name',coalesce(v_name,''),'summary',v.summary,
    'total',v_sum::numeric / 16,
    'areas',(select jsonb_agg(jsonb_build_object('key',a.area_key,'score_quarters',a.score_quarters,
      'comment',a.comment,'needs_follow_up',a.needs_follow_up,
      'images',(select coalesce(jsonb_agg(jsonb_build_object('path',i.object_path,'caption',i.caption)
        order by i.sort_order), '[]'::jsonb) from public.report_images i
        where i.version_id = a.version_id and i.area_key = a.area_key)) order by a.area_key)
      from public.area_assessments a where a.version_id = v.id)) into v_snapshot;
  update public.report_versions set state = 'published', published_at = now(), published_by = auth.uid(),
    change_reason = p_reason, lock_version = lock_version + 1 where id = p_version;
  insert into public.publication_snapshots(version_id, schema_version, content, total_quarters_sum) values(p_version,3,v_snapshot,v_sum);
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
    (r.event_id is null and r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
    (r.event_id is not null and r.created_by = auth.uid()) or
    (r.event_id is null and r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id))
  ) then raise exception 'Ingen tilgang'; end if;
  if r.event_id is not null and exists(select 1 from public.events where id = r.event_id and status = 'closed')
    then raise exception 'Samlingen er avsluttet'; end if;
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

create or replace function public.set_report_archived(p_report uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not ((r.event_id is null and r.kind = 'inspection' and app_private.can_operate_store(r.store_id))
    or (r.event_id is not null and r.created_by = auth.uid()) or
    (r.event_id is null and r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
    then raise exception 'Ingen tilgang'; end if;
  update public.reports set archived_at = case when p_archived then now() else null end where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),case when p_archived then 'archived' else 'restored' end,'report',p_report);
end $$;

create or replace function public.withdraw_report(p_report uuid, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not ((r.event_id is null and r.kind = 'inspection' and app_private.can_operate_store(r.store_id))
    or (r.event_id is not null and r.created_by = auth.uid()) or
    (r.event_id is null and r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
    then raise exception 'Ingen tilgang'; end if;
  if r.current_version_id is null or r.withdrawn_at is not null then raise exception 'Rapport kan ikke trekkes tilbake'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Begrunnelse må ha minst fem tegn'; end if;
  update public.reports set withdrawn_at = now(), withdrawal_reason = trim(p_reason) where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'withdrawn','report',p_report,jsonb_build_object('reason',p_reason));
end $$;

commit;
