create table if not exists public.subscriptions (
  user_id bigint not null references public.users(id) on delete cascade,
  blog_id bigint not null references public.blogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

create index if not exists subscriptions_blog_id_idx on public.subscriptions (blog_id);
alter table public.subscriptions enable row level security;

revoke all on public.subscriptions from public, anon, authenticated;
grant select, insert, delete on public.subscriptions to service_role;
