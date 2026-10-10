-- 202610070005 granted the server key access to the tables that existed then. Tables created
-- later (task images and events) got no privileges, so attaching a photo to a task failed.
grant all on table public.action_images, public.events, public.event_participants to service_role;
-- Cover tables added by future migrations as well.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
