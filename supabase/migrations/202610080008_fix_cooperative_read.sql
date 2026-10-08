-- The unqualified `id` in the original policy resolved to memberships.id.
-- Add a correctly qualified SELECT policy; permissive policies are OR-combined.
create policy coop_read_assigned on public.cooperatives for select to authenticated using (
  exists (
    select 1
    from public.memberships m
    where m.user_id = (select auth.uid())
      and m.cooperative_id = public.cooperatives.id
  )
);
