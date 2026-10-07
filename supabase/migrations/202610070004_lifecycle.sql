create or replace function public.set_report_archived(p_report uuid, p_archived boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.reports%rowtype;
begin
  select * into r from public.reports where id = p_report for update;
  if not found or not ((r.kind = 'inspection' and app_private.has_role(r.cooperative_id,'operations'))
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
  if not found or not ((r.kind = 'inspection' and app_private.has_role(r.cooperative_id,'operations'))
    or (r.kind = 'self_check' and r.created_by = auth.uid() and app_private.manages_store(r.store_id)))
    then raise exception 'Ingen tilgang'; end if;
  if r.current_version_id is null or r.withdrawn_at is not null then raise exception 'Rapport kan ikke trekkes tilbake'; end if;
  if length(trim(coalesce(p_reason,''))) < 5 then raise exception 'Begrunnelse må ha minst fem tegn'; end if;
  update public.reports set withdrawn_at = now(), withdrawal_reason = trim(p_reason) where id = p_report;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id,details)
    values(r.cooperative_id,auth.uid(),'withdrawn','report',p_report,jsonb_build_object('reason',p_reason));
end $$;
create or replace function public.update_round_summary(p_round uuid, p_summary text)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rounds%rowtype;
begin
  select * into r from public.rounds where id = p_round for update;
  if not found or not app_private.has_role(r.cooperative_id,'operations') then raise exception 'Ingen tilgang'; end if;
  if r.status = 'closed' then raise exception 'Gjenåpne runden før redigering'; end if;
  update public.rounds set summary = coalesce(p_summary,'') where id = p_round;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'summary_updated','round',p_round);
end $$;
create or replace function public.retry_export(p_version uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v public.report_versions%rowtype; r public.reports%rowtype;
begin
  select * into v from public.report_versions where id = p_version;
  if not found or v.state <> 'published' or not app_private.can_read_version(p_version) then raise exception 'Ingen tilgang'; end if;
  select * into r from public.reports where id = v.report_id;
  update public.exports set status = 'pending', attempts = 0, error = null, updated_at = now()
    where version_id = p_version and kind = 'report_pdf' and status = 'failed';
  if not found then raise exception 'Ingen feilet PDF-jobb'; end if;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,auth.uid(),'export_retried','report_version',p_version);
end $$;
revoke all on function public.set_report_archived(uuid,boolean), public.withdraw_report(uuid,text),
  public.update_round_summary(uuid,text), public.retry_export(uuid) from public, anon;
grant execute on function public.set_report_archived(uuid,boolean), public.withdraw_report(uuid,text),
  public.update_round_summary(uuid,text), public.retry_export(uuid) to authenticated;
