-- Store-scoped operations memberships. A null store_id keeps whole-cooperative access.
alter table public.memberships drop constraint if exists memberships_check;
alter table public.memberships add constraint memberships_check check (
  (role = 'store_manager' and store_id is not null) or
  (role = 'cooperative_admin' and store_id is null) or
  role = 'operations'
);

create or replace function app_private.has_role(p_coop uuid, p_role public.member_role)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.cooperative_id = p_coop and m.role = p_role and (p_role <> 'operations' or m.store_id is null));
$$;

create or replace function app_private.can_operate_store(p_store uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.stores s join public.memberships m
    on m.cooperative_id = s.cooperative_id and m.user_id = (select auth.uid())
    where s.id = p_store and m.role = 'operations'
      and (m.store_id is null or m.store_id = p_store));
$$;

create or replace function app_private.can_read_report(p_report uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = p_report and (
    app_private.can_operate_store(r.store_id) or
    (app_private.manages_store(r.store_id) and (r.current_version_id is not null or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))));
$$;

create or replace function app_private.can_read_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and (
      app_private.can_operate_store(r.store_id) or
      (app_private.manages_store(r.store_id) and (
        v.state = 'published' or (r.kind = 'self_check' and r.created_by = (select auth.uid()))))));
$$;

create or replace function app_private.can_edit_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and v.state = 'draft' and (
      (r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
      (r.kind = 'self_check' and r.created_by = (select auth.uid()) and app_private.manages_store(r.store_id))));
$$;

create or replace function public.create_report(p_store uuid, p_round uuid, p_kind public.report_kind)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_store public.stores%rowtype; v_report uuid; v_version uuid; v_round public.rounds%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Ikke innlogget'; end if;
  select * into v_store from public.stores where id = p_store and active;
  if not found then raise exception 'Varehus finnes ikke'; end if;
  if p_kind = 'inspection' then
    if not app_private.can_operate_store(p_store) then raise exception 'Ingen tilgang'; end if;
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

create or replace function public.correct_report(p_report uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v public.report_versions%rowtype; v_new uuid;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not (
    (r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
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

create or replace function public.set_report_archived(p_report uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not ((r.kind = 'inspection' and app_private.can_operate_store(r.store_id))
    or (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
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
  if not found or not ((r.kind = 'inspection' and app_private.can_operate_store(r.store_id))
    or (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
    then raise exception 'Ingen tilgang'; end if;
  if r.current_version_id is null or r.withdrawn_at is not null then raise exception 'Rapport kan ikke trekkes tilbake'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Begrunnelse må ha minst fem tegn'; end if;
  update public.reports set withdrawn_at = now(), withdrawal_reason = trim(p_reason) where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'withdrawn','report',p_report,jsonb_build_object('reason',p_reason));
end $$;

create or replace function public.create_action(p_report uuid, p_area text, p_description text, p_assignee uuid, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_id uuid;
begin
  select * into r from public.reports where id = p_report;
  if not found or not app_private.can_read_report(p_report) then raise exception 'Ingen tilgang'; end if;
  if not (app_private.can_operate_store(r.store_id) or app_private.manages_store(r.store_id))
    then raise exception 'Ingen tilgang'; end if;
  if p_assignee is not null and not exists(select 1 from public.memberships where user_id = p_assignee
    and (store_id = r.store_id or (cooperative_id = r.cooperative_id and role = 'operations' and store_id is null)))
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
  if not (app_private.can_operate_store(r.store_id) or app_private.manages_store(r.store_id))
    then raise exception 'Ingen tilgang'; end if;
  if p_status not in ('open','in_progress','done') then raise exception 'Ugyldig status'; end if;
  update public.actions set status = p_status, updated_at = now() where id = p_action;
  insert into public.action_updates(action_id,actor_id,old_status,new_status,comment)
    values(p_action,auth.uid(),a.status,p_status,coalesce(p_comment,''));
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'updated','action',p_action);
end $$;

drop policy if exists store_read on public.stores;
create policy store_read on public.stores for select to authenticated using (
  app_private.can_operate_store(id) or app_private.has_role(cooperative_id, 'cooperative_admin') or app_private.manages_store(id));
drop policy if exists round_read on public.rounds;
create policy round_read on public.rounds for select to authenticated using (
  app_private.has_role(cooperative_id, 'operations') or exists (
    select 1 from public.round_stores rs where rs.round_id = id and
      (app_private.can_operate_store(rs.store_id) or app_private.manages_store(rs.store_id))));
drop policy if exists round_store_read on public.round_stores;
create policy round_store_read on public.round_stores for select to authenticated using (
  app_private.can_operate_store(store_id) or app_private.manages_store(store_id));
revoke all on function app_private.can_operate_store(uuid) from public, anon;
grant execute on function app_private.can_operate_store(uuid) to authenticated;

-- Called only by the server with the service role after verifying the user's
-- immutable app_metadata.system_admin flag. All relational deletion is atomic.
create or replace function public.admin_delete_report(p_report uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_images text[]; v_exports text[];
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Ingen tilgang'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'Rapport finnes ikke'; end if;
  select coalesce(array_agg(distinct i.object_path),array[]::text[]) into v_images
    from public.report_images i join public.report_versions v on v.id = i.version_id where v.report_id = p_report;
  select coalesce(array_agg(distinct e.object_path),array[]::text[]) into v_exports
    from public.exports e join public.report_versions v on v.id = e.version_id
    where v.report_id = p_report and e.object_path is not null;
  update public.reports set current_version_id = null where id = p_report;
  delete from public.action_updates where action_id in (select id from public.actions where report_id = p_report);
  delete from public.actions where report_id = p_report;
  delete from public.notification_outbox where version_id in (select id from public.report_versions where report_id = p_report);
  delete from public.exports where version_id in (select id from public.report_versions where report_id = p_report);
  delete from public.report_images where version_id in (select id from public.report_versions where report_id = p_report);
  delete from public.publication_snapshots where version_id in (select id from public.report_versions where report_id = p_report);
  delete from public.area_assessments where version_id in (select id from public.report_versions where report_id = p_report);
  delete from public.report_versions where report_id = p_report;
  delete from public.reports where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,p_actor,'deleted','report',p_report,jsonb_build_object('store_id',r.store_id,'kind',r.kind));
  return jsonb_build_object('images',to_jsonb(v_images),'exports',to_jsonb(v_exports));
end $$;
revoke all on function public.admin_delete_report(uuid,uuid) from public, anon, authenticated;
grant execute on function public.admin_delete_report(uuid,uuid) to service_role;
