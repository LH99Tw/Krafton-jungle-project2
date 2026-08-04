grant select, insert, update, delete on table public.users to service_role;
grant select, insert, update, delete on table public.sessions to service_role;
grant select, insert, update, delete on table public.blogs to service_role;
grant select, insert, update, delete on table public.posts to service_role;

grant usage, select on all sequences in schema public to service_role;
