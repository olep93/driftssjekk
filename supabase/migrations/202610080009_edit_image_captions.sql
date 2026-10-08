create or replace function public.update_report_image_caption(p_image uuid, p_caption text, p_expected_caption text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_version uuid; v_current text;
begin
  if p_caption is null or length(p_caption) > 1000 then
    raise exception 'Ugyldig bildetekst';
  end if;

  select version_id into v_version from public.report_images where id = p_image;
  if not found then raise exception 'Ingen tilgang'; end if;

  -- Serialize caption changes with report publication and image additions.
  perform 1 from public.report_versions where id = v_version for update;
  if not app_private.can_edit_version(v_version) then raise exception 'Ingen tilgang'; end if;

  select caption into v_current from public.report_images where id = p_image for update;
  if not found then raise exception 'Ingen tilgang'; end if;
  if v_current is distinct from p_expected_caption then
    raise exception 'Versjonskonflikt: Bildeteksten ble endret av en kollega' using errcode = '40001';
  end if;

  update public.report_images set caption = p_caption where id = p_image;
  return p_caption;
end $$;

revoke all on function public.update_report_image_caption(uuid,text,text) from public, anon;
grant execute on function public.update_report_image_caption(uuid,text,text) to authenticated;
