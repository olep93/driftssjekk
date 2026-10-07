create or replace function public.claim_export_jobs()
returns setof public.exports language sql security definer set search_path = '' as $$
  update public.exports e set status = 'processing', attempts = attempts + 1, updated_at = now()
  where e.id in (
    select id from public.exports
    where (status in ('pending','failed') or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      and attempts < 5 and kind = 'report_pdf'
    order by created_at limit 5 for update skip locked
  ) returning e.*;
$$;
create or replace function public.claim_notification_jobs()
returns setof public.notification_outbox language sql security definer set search_path = '' as $$
  update public.notification_outbox n set status = 'processing', attempts = attempts + 1, updated_at = now()
  where n.id in (
    select id from public.notification_outbox
    where (status in ('pending','failed') or (status = 'processing' and updated_at < now() - interval '15 minutes'))
      and attempts < 5 and created_at > now() - interval '23 hours'
    order by created_at limit 10 for update skip locked
  ) returning n.*;
$$;
revoke all on function public.claim_export_jobs(), public.claim_notification_jobs() from public, anon, authenticated;
grant execute on function public.claim_export_jobs(), public.claim_notification_jobs() to service_role;
