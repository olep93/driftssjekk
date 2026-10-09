-- Private Realtime channel per draft ("draft:<version id>") for presence and change signals.
-- Only users who may edit the draft can join, so store managers never see unannounced inspections.
create or replace function app_private.can_join_draft_channel(p_topic text)
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when p_topic ~ '^draft:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then app_private.can_edit_version(substr(p_topic, 7)::uuid)
    else false
  end;
$$;
revoke all on function app_private.can_join_draft_channel(text) from public, anon;
grant execute on function app_private.can_join_draft_channel(text) to authenticated;

create policy draft_live_read on realtime.messages for select to authenticated
  using (realtime.messages.extension in ('broadcast', 'presence')
    and app_private.can_join_draft_channel((select realtime.topic())));
create policy draft_live_write on realtime.messages for insert to authenticated
  with check (realtime.messages.extension in ('broadcast', 'presence')
    and app_private.can_join_draft_channel((select realtime.topic())));
