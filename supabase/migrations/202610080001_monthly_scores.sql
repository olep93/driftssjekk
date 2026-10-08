-- Both report kinds keep four scored areas and a separate total.
-- Ranking queries continue to filter on kind = inspection.
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
  select jsonb_build_object('schema_version',3,'calculation','equal_weight_quarters_v1',
    'report_id',r.id,'version_id',v.id,'version_no',v.version_no,'kind',r.kind,
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
