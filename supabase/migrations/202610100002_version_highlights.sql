-- Optional "Styrker" and "Forbedringer" for the report summary, one point per line (at most three).
-- A published version is never edited, so exports read them straight from the version row.
alter table public.report_versions
  add column strengths text not null default '',
  add column improvements text not null default '';

-- Saves the highlights in the same transaction as the rest of the draft. The existing save_draft
-- does the access, lock and validation checks and bumps lock_version.
create or replace function public.save_draft(
  p_version uuid, p_lock integer, p_visit_date date, p_summary text, p_areas jsonb, p_strengths text, p_improvements text
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_lock integer;
begin
  if length(coalesce(p_strengths, '')) > 1000 or length(coalesce(p_improvements, '')) > 1000
    then raise exception 'Styrker og forbedringer kan ha maks 1000 tegn'; end if;
  v_lock := public.save_draft(p_version, p_lock, p_visit_date, p_summary, p_areas);
  update public.report_versions set strengths = coalesce(p_strengths, ''), improvements = coalesce(p_improvements, '')
    where id = p_version;
  return v_lock;
end $$;
revoke all on function public.save_draft(uuid, integer, date, text, jsonb, text, text) from public, anon;
grant execute on function public.save_draft(uuid, integer, date, text, jsonb, text, text) to authenticated;

-- A correction starts from the previous version's highlights, like it does for scores and comments.
create or replace function app_private.copy_version_highlights()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.version_no > 1 then
    new.strengths := coalesce((select strengths from public.report_versions
      where report_id = new.report_id and version_no = new.version_no - 1), new.strengths);
    new.improvements := coalesce((select improvements from public.report_versions
      where report_id = new.report_id and version_no = new.version_no - 1), new.improvements);
  end if;
  return new;
end $$;
create trigger report_versions_copy_highlights before insert on public.report_versions
  for each row execute function app_private.copy_version_highlights();
