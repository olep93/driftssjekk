create or replace function public.create_store(p_coop uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  if not app_private.has_role(p_coop,'cooperative_admin') then raise exception 'Ingen tilgang'; end if;
  if length(trim(coalesce(p_name,''))) < 2 then raise exception 'Ugyldig navn'; end if;
  insert into public.stores(cooperative_id,name) values(p_coop,trim(p_name)) returning id into v_id;
  insert into public.audit_events(cooperative_id,actor_id,event_type,object_type,object_id)
    values(p_coop,auth.uid(),'created','store',v_id);
  return v_id;
end $$;
revoke all on function public.create_store(uuid,text) from public, anon;
grant execute on function public.create_store(uuid,text) to authenticated;
