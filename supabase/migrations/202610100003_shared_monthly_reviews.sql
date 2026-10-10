-- Monthly reviews become a shared tool for the store and its operations managers: a driftssjef on a
-- visit can start one, and the store manager can continue it (and the other way round). They still
-- only count as internal progress. Unannounced inspection drafts stay hidden from store managers.

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
    if not (app_private.manages_store(p_store) or app_private.can_operate_store(p_store)) or p_round is not null
      then raise exception 'Ingen tilgang'; end if;
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

-- Store managers read every monthly review of their store, drafts included, not only their own.
create or replace function app_private.can_read_report(p_report uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.reports r where r.id = p_report and (
    (r.event_id is not null and app_private.can_read_event_report(r.id)) or
    (r.event_id is null and (app_private.can_operate_store(r.store_id) or
      (app_private.manages_store(r.store_id) and
        (r.current_version_id is not null or r.kind = 'self_check'))))));
$$;
create or replace function app_private.can_read_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and (
      (r.event_id is not null and (r.created_by = (select auth.uid()) or
        app_private.can_manage_event(r.event_id))) or
      (r.event_id is null and (app_private.can_operate_store(r.store_id) or
        (app_private.manages_store(r.store_id) and
          (v.state = 'published' or r.kind = 'self_check'))))));
$$;

-- Monthly review drafts can be edited by the store's managers and its operations managers alike.
create or replace function app_private.can_edit_version(p_version uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.report_versions v join public.reports r on r.id = v.report_id
    where v.id = p_version and v.state = 'draft' and (
      (r.event_id is not null and r.created_by = (select auth.uid()) and
        exists (select 1 from public.events e join public.event_participants ep on ep.event_id = e.id
          join public.memberships m on m.user_id = ep.user_id and m.store_id = ep.home_store_id and m.role = 'store_manager'
          where e.id = r.event_id and e.status = 'planned' and ep.user_id = (select auth.uid()))) or
      (r.event_id is null and ((r.kind = 'inspection' and app_private.can_operate_store(r.store_id)) or
        (r.kind = 'self_check' and (app_private.manages_store(r.store_id) or app_private.can_operate_store(r.store_id)))))));
$$;
