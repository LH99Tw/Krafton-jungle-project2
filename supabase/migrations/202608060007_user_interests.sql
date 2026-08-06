alter table public.users
  add column if not exists interests text[] not null default '{}';

alter table public.users
  drop constraint if exists users_interests_limit;

alter table public.users
  add constraint users_interests_limit
  check (cardinality(interests) <= 8);
