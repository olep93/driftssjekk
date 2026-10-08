-- System administrators can remove empty test rounds after deleting their reports.
create function public.admin_delete_round(p_round uuid, p_actor uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.rounds%rowtype;
begin
  if coalesce(auth.role(),'') <> 'service_role' then raise exception 'Ingen tilgang'; end if;
  select * into r from public.rounds where id = p_round for update;
  if not found then raise exception 'Runden finnes ikke'; end if;
  if exists(select 1 from public.reports where round_id = p_round) then raise exception 'Slett rapportene i runden først'; end if;
  delete from public.round_stores where round_id = p_round;
  delete from public.rounds where id = p_round;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(r.cooperative_id,p_actor,'deleted','round',p_round);
end $$;
revoke all on function public.admin_delete_round(uuid,uuid) from public,anon,authenticated;
grant execute on function public.admin_delete_round(uuid,uuid) to service_role;
