-- Replace only the image in an editable draft. The old object may still belong
-- to a published version, so its bytes must never be overwritten or deleted.
create or replace function public.replace_report_image(
  p_image uuid, p_expected_path text, p_expected_caption text,
  p_new_path text, p_caption text, p_size integer
) returns text language plpgsql security definer set search_path = '' as $$
declare v_image public.report_images%rowtype;
begin
  select version_id into v_image.version_id from public.report_images where id = p_image;
  if not found then raise exception 'Ingen tilgang'; end if;
  perform 1 from public.report_versions where id = v_image.version_id for update;
  if not app_private.can_edit_version(v_image.version_id) then raise exception 'Ingen tilgang'; end if;
  select * into v_image from public.report_images where id = p_image for update;
  if not found then raise exception 'Ingen tilgang'; end if;
  if v_image.object_path is distinct from p_expected_path or v_image.caption is distinct from p_expected_caption
    then raise exception 'Versjonskonflikt: Bildet ble endret av en kollega. Last inn kladden på nytt.' using errcode = '40001'; end if;
  if p_new_path not like v_image.version_id::text || '/%' or p_new_path not like '%.jpg'
    or p_new_path = v_image.object_path or p_size not between 1 and 10485760
    or p_caption is null or length(p_caption) > 1000 then raise exception 'Ugyldig bilde'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'report-images' and name = p_new_path)
    then raise exception 'Bilde er ikke lastet opp'; end if;
  update public.report_images set object_path = p_new_path, caption = p_caption,
    content_type = 'image/jpeg', byte_size = p_size where id = p_image;
  return p_new_path;
end $$;
revoke all on function public.replace_report_image(uuid,text,text,text,text,integer) from public, anon;
grant execute on function public.replace_report_image(uuid,text,text,text,text,integer) to authenticated;
