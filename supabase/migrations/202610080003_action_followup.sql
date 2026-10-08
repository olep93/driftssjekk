-- Photos and a reply thread for report-related store tasks.
alter table public.action_updates add constraint action_updates_action_id_id_unique unique (action_id,id);
create table public.action_images (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.actions(id),
  update_id uuid,
  object_path text not null unique,
  caption text not null default '',
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  foreign key (action_id,update_id) references public.action_updates(action_id,id)
);
create index action_images_action_idx on public.action_images(action_id, created_at);
alter table public.action_images enable row level security;
create policy action_image_read on public.action_images for select to authenticated using (
  exists (select 1 from public.actions a where a.id = action_id and app_private.can_read_report(a.report_id)));
grant select on public.action_images to authenticated;
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
  values ('action-images','action-images',false,10485760,array['image/jpeg'])
  on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['image/jpeg'];

-- The task is created by a driftssjef and shown to the report's store.
create or replace function public.create_action(p_report uuid, p_area text, p_description text, p_assignee uuid, p_due date)
returns uuid language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_id uuid;
begin
  select * into r from public.reports where id = p_report;
  if not found or r.current_version_id is null or r.withdrawn_at is not null or not app_private.can_operate_store(r.store_id)
    then raise exception 'Ingen tilgang til publisert rapport'; end if;
  if p_area is not null and p_area not in ('drive_in','store','outdoor','goods_receiving') then raise exception 'Ugyldig område'; end if;
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

create function public.reply_action(p_action uuid, p_status text, p_comment text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare a public.actions%rowtype; r public.reports%rowtype; v_update uuid;
begin
  select * into a from public.actions where id = p_action for update;
  if not found then raise exception 'Oppgaven finnes ikke'; end if;
  select * into r from public.reports where id = a.report_id;
  if not (app_private.can_operate_store(r.store_id) or app_private.manages_store(r.store_id))
    then raise exception 'Ingen tilgang'; end if;
  if p_status not in ('open','in_progress','done') then raise exception 'Ugyldig status'; end if;
  if length(trim(coalesce(p_comment,''))) < 1 then raise exception 'Skriv et svar'; end if;
  update public.actions set status = p_status, updated_at = now() where id = p_action;
  insert into public.action_updates(action_id,actor_id,old_status,new_status,comment)
    values(p_action,auth.uid(),a.status,p_status,trim(p_comment)) returning id into v_update;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'updated','action',p_action);
  return v_update;
end $$;
revoke all on function public.reply_action(uuid,text,text) from public, anon;
grant execute on function public.reply_action(uuid,text,text) to authenticated;

create or replace function public.admin_delete_report(p_report uuid, p_actor uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype; v_images text[]; v_exports text[]; v_action_images text[];
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Ingen tilgang'; end if;
  select * into r from public.reports where id = p_report for update;
  if not found then raise exception 'Rapport finnes ikke'; end if;
  select coalesce(array_agg(distinct i.object_path),array[]::text[]) into v_images
    from public.report_images i join public.report_versions v on v.id = i.version_id where v.report_id = p_report;
  select coalesce(array_agg(distinct e.object_path),array[]::text[]) into v_exports
    from public.exports e join public.report_versions v on v.id = e.version_id
    where v.report_id = p_report and e.object_path is not null;
  select coalesce(array_agg(distinct i.object_path),array[]::text[]) into v_action_images
    from public.action_images i join public.actions a on a.id = i.action_id where a.report_id = p_report;
  update public.reports set current_version_id = null where id = p_report;
  delete from public.action_images where action_id in (select id from public.actions where report_id = p_report);
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
  return jsonb_build_object('images',to_jsonb(v_images),'exports',to_jsonb(v_exports),'action_images',to_jsonb(v_action_images));
end $$;
