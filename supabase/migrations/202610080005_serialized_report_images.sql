-- Serialize image edits with publish_report, which already locks report_versions.
-- This prevents a photo being accepted after the publication snapshot was built.
create or replace function public.add_report_image(
  p_version uuid, p_area text, p_path text, p_caption text, p_type text, p_size integer
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v public.report_versions%rowtype; v_id uuid;
begin
  select * into v from public.report_versions where id = p_version for update;
  if not found or not app_private.can_edit_version(p_version) then raise exception 'Ingen tilgang'; end if;
  if p_area not in ('drive_in','store','outdoor','goods_receiving') or
     p_path not like p_version::text || '/%' or
     p_type not in ('image/jpeg','image/png','image/webp') or
     p_size not between 1 and 10485760 then raise exception 'Ugyldig bilde'; end if;
  if (select count(*) from public.report_images where version_id = p_version and area_key = p_area) >= 20
    then raise exception 'Maksimalt 20 bilder per område'; end if;
  if not exists(select 1 from storage.objects where bucket_id = 'report-images' and name = p_path)
    then raise exception 'Bilde er ikke lastet opp'; end if;
  insert into public.report_images(version_id, area_key, object_path, caption, content_type, byte_size)
    values(p_version, p_area, p_path, coalesce(p_caption,''), p_type, p_size) returning id into v_id;
  return v_id;
end $$;

create or replace function public.remove_report_image(p_image uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare i public.report_images%rowtype; v public.report_versions%rowtype;
begin
  select version_id into i.version_id from public.report_images where id = p_image;
  if not found then raise exception 'Ingen tilgang'; end if;
  select * into v from public.report_versions where id = i.version_id for update;
  select * into i from public.report_images where id = p_image for update;
  if not found or not app_private.can_edit_version(i.version_id) then raise exception 'Ingen tilgang'; end if;
  delete from public.report_images where id = p_image;
  return i.object_path;
end $$;
