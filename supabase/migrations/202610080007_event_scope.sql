begin;

-- A participant may publish one assigned area. The full score is kept in the
-- JSON snapshot; the legacy four-area sum is absent for these reports.
alter table public.publication_snapshots
  alter column total_quarters_sum drop not null;

alter table public.event_participants
  add column area_keys text[] not null default array['drive_in','store','outdoor','goods_receiving'];
alter table public.event_participants
  add constraint event_participant_areas_check check (
    cardinality(area_keys) between 1 and 4 and
    area_keys <@ array['drive_in','store','outdoor','goods_receiving']::text[]
  );

-- A manager may coordinate an event only while their operations assignments
-- cover the host store and every invited participant's home store.
create or replace function app_private.can_manage_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and app_private.can_operate_store(e.location_store_id)
      and not exists (
        select 1 from public.event_participants ep
        where ep.event_id = e.id
          and not app_private.can_operate_store(ep.home_store_id)
      )
  );
$$;

-- A manager with access to the host alone cannot discover a wider event.
create or replace function app_private.can_read_event(p_event uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event
      and (
        app_private.can_manage_event(e.id)
        or exists (
          select 1 from public.event_participants ep
          where ep.event_id = e.id and ep.user_id = (select auth.uid())
        )
      )
  );
$$;

create or replace function public.can_manage_event(p_event uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select app_private.can_manage_event(p_event);
$$;
revoke all on function public.can_manage_event(uuid) from public, anon;
grant execute on function public.can_manage_event(uuid) to authenticated;

-- The invitation records the exact home store selected for each manager.
-- It matters when a manager is assigned to several stores.
-- Keep the old signature present for migration safety, but make it inaccessible.
revoke all on function public.create_event(uuid,text,text,uuid,text,timestamptz,timestamptz,uuid[])
  from public,anon,authenticated;
do $revoke_old_event$
begin
  if to_regprocedure('public.create_event(uuid,text,text,uuid,text,timestamptz,timestamptz,jsonb)') is not null then
    revoke all on function public.create_event(uuid,text,text,uuid,text,timestamptz,timestamptz,jsonb)
      from public,anon,authenticated;
  end if;
end $revoke_old_event$;
create function public.create_event(p_coop uuid,p_title text,p_description text,p_location uuid,
  p_starts timestamptz,p_ends timestamptz,p_participants jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_item jsonb; v_user uuid; v_home uuid; v_areas text[];
  v_seen uuid[] := array[]::uuid[]; v_covered text[] := array[]::text[];
begin
  if not app_private.can_operate_store(p_location) or
     not exists(select 1 from public.stores where id = p_location and cooperative_id = p_coop and active)
    then raise exception 'Ingen tilgang til samlingsvarehuset'; end if;
  if length(trim(coalesce(p_title,''))) not between 3 and 150 or
     length(coalesce(p_description,'')) > 3000 or
     p_starts is null or (p_ends is not null and p_ends < p_starts)
    then raise exception 'Ugyldige samlingsdata'; end if;
  if jsonb_typeof(p_participants) is distinct from 'array' then
    raise exception 'Velg deltakere'; end if;
  if jsonb_array_length(p_participants) not between 1 and 100 then
    raise exception 'Velg mellom én og hundre deltakere'; end if;
  for v_item in select value from jsonb_array_elements(p_participants) loop
    v_user := (v_item->>'user_id')::uuid;
    v_home := (v_item->>'home_store_id')::uuid;
    if jsonb_typeof(v_item->'area_keys') is distinct from 'array' then
      raise exception 'Velg områder for hver deltaker'; end if;
    select array_agg(value) into v_areas from jsonb_array_elements_text(v_item->'area_keys') as value;
    if v_user is null or v_home is null or v_user = any(v_seen) then
      raise exception 'Velg hver deltaker og hjemvarehus én gang'; end if;
    if coalesce(cardinality(v_areas),0) not between 1 and 4 or
       exists(select 1 from unnest(v_areas) as area_key where area_key not in ('drive_in','store','outdoor','goods_receiving')) or
       (select count(distinct area_key) from unnest(v_areas) as area_key) <> cardinality(v_areas)
      then raise exception 'Ugyldig områdevalg'; end if;
    if not exists(select 1 from public.memberships m join public.stores s on s.id = m.store_id
      where m.user_id = v_user and m.cooperative_id = p_coop and m.store_id = v_home
        and m.role = 'store_manager' and s.active and app_private.can_operate_store(v_home))
      then raise exception 'En deltaker mangler varehustilgang hos driftssjef'; end if;
    v_seen := array_append(v_seen,v_user);
    v_covered := v_covered || v_areas;
  end loop;
  if (select count(distinct area_key) from unnest(v_covered) as area_key) <> 4 then
    raise exception 'Alle fire områder må fordeles på minst én deltaker'; end if;
  insert into public.events(cooperative_id,title,description,location_store_id,target_mode,starts_at,ends_at,created_by)
    values(p_coop,trim(p_title),trim(coalesce(p_description,'')),p_location,'host',p_starts,p_ends,auth.uid())
    returning id into v_id;
  for v_item in select value from jsonb_array_elements(p_participants) loop
    v_user := (v_item->>'user_id')::uuid;
    v_home := (v_item->>'home_store_id')::uuid;
    select array_agg(value) into v_areas from jsonb_array_elements_text(v_item->'area_keys') as value;
    insert into public.event_participants(event_id,user_id,home_store_id,target_store_id,area_keys)
      values(v_id,v_user,v_home,p_location,v_areas);
  end loop;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(p_coop,auth.uid(),'created','event',v_id,jsonb_build_object('participants',cardinality(v_seen)));
  return v_id;
end $$;
revoke all on function public.create_event(uuid,text,text,uuid,timestamptz,timestamptz,jsonb)
  from public,anon;
grant execute on function public.create_event(uuid,text,text,uuid,timestamptz,timestamptz,jsonb)
  to authenticated;

create or replace function public.create_event_report(p_event uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare e public.events%rowtype; p public.event_participants%rowtype; v_report uuid; v_version uuid;
begin
  select * into e from public.events where id = p_event;
  if not found or e.status <> 'planned' then raise exception 'Samlingen er ikke åpen'; end if;
  select * into p from public.event_participants where event_id = p_event and user_id = auth.uid();
  if not found or not exists(select 1 from public.memberships where user_id = auth.uid()
    and role = 'store_manager' and store_id = p.home_store_id)
    then raise exception 'Ingen tilgang til denne samlingen'; end if;
  if exists(select 1 from public.reports where event_id = p_event and created_by = auth.uid())
    then raise exception 'Du har allerede startet denne vurderingen'; end if;
  insert into public.reports(cooperative_id,store_id,event_id,kind,created_by)
    values(e.cooperative_id,p.target_store_id,p_event,'self_check',auth.uid()) returning id into v_report;
  insert into public.report_versions(report_id,version_no,assessor_id)
    values(v_report,1,auth.uid()) returning id into v_version;
  insert into public.area_assessments(version_id,area_key)
    select v_version,unnest(p.area_keys);
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(e.cooperative_id,auth.uid(),'created','event_report',v_report);
  return v_version;
end $$;

create or replace function public.publish_report(p_version uuid, p_lock integer, p_reason text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.report_versions%rowtype; r public.reports%rowtype; s public.stores%rowtype;
  v_sum integer; v_count integer; v_expected integer; v_snapshot jsonb; v_name text; v_round text;
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
  v_expected := 4;
  if r.event_id is not null then
    select cardinality(ep.area_keys) into v_expected from public.event_participants ep
      where ep.event_id = r.event_id and ep.user_id = r.created_by;
    if v_expected is null then raise exception 'Deltakeren mangler områdeoppdrag'; end if;
  end if;
  select count(*), sum(score_quarters) into v_count, v_sum from public.area_assessments
    where version_id = p_version and score_quarters between 4 and 40;
  if v_count <> v_expected then raise exception 'Alle tildelte områder må vurderes'; end if;
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
    'total',v_sum::numeric / (4 * v_expected),
    'areas',(select jsonb_agg(jsonb_build_object('key',a.area_key,'score_quarters',a.score_quarters,
      'comment',a.comment,'needs_follow_up',a.needs_follow_up,
      'images',(select coalesce(jsonb_agg(jsonb_build_object('path',i.object_path,'caption',i.caption)
        order by i.sort_order), '[]'::jsonb) from public.report_images i
        where i.version_id = a.version_id and i.area_key = a.area_key)) order by a.area_key)
      from public.area_assessments a where a.version_id = v.id)) into v_snapshot;
  update public.report_versions set state = 'published', published_at = now(), published_by = auth.uid(),
    change_reason = p_reason, lock_version = lock_version + 1 where id = p_version;
  insert into public.publication_snapshots(version_id, schema_version, content, total_quarters_sum)
    values(p_version,3,v_snapshot,case when r.event_id is not null then null else v_sum end);
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

-- Event assessments remain separate from operational follow-up tasks.
create or replace function public.create_action(p_report uuid, p_area text, p_description text, p_assignee uuid, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_id uuid;
begin
  select * into r from public.reports where id = p_report;
  if not found or r.event_id is not null or r.current_version_id is null or
     r.withdrawn_at is not null or not app_private.can_operate_store(r.store_id)
    then raise exception 'Ingen tilgang til publisert rapport'; end if;
  if p_area is not null and p_area not in ('drive_in','store','outdoor','goods_receiving')
    then raise exception 'Ugyldig område'; end if;
  if length(trim(coalesce(p_description,''))) < 3 then raise exception 'Beskriv oppgaven'; end if;
  if p_assignee is not null and not exists(select 1 from public.memberships where user_id = p_assignee
    and (store_id = r.store_id or (cooperative_id = r.cooperative_id and role = 'operations' and store_id is null)))
    then raise exception 'Ansvarlig mangler tilgang'; end if;
  insert into public.actions(report_id,area_key,description,assigned_to,due_date,created_by)
    values(p_report,p_area,trim(p_description),p_assignee,p_due,auth.uid()) returning id into v_id;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'created','action',v_id);
  return v_id;
end $$;

-- A participant must keep their one event result available to the coordinator.
create or replace function public.set_report_archived(p_report uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or r.event_id is not null or not (
    (r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
    (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
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
  if not found or r.event_id is not null or not (
    (r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
    (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
    then raise exception 'Ingen tilgang'; end if;
  if r.current_version_id is null or r.withdrawn_at is not null then raise exception 'Rapport kan ikke trekkes tilbake'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Begrunnelse må ha minst fem tegn'; end if;
  update public.reports set withdrawn_at = now(), withdrawal_reason = trim(p_reason) where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'withdrawn','report',p_report,jsonb_build_object('reason',p_reason));
end $$;

commit;
