create table if not exists public.blog_visitors (
  id bigint generated always as identity primary key,
  blog_id bigint not null references public.blogs(id) on delete cascade,
  visitor_hash text not null,
  first_visited_at timestamptz not null default now(),
  last_visited_at timestamptz not null default now(),
  visit_count bigint not null default 1 check (visit_count > 0),
  unique (blog_id, visitor_hash)
);

create index if not exists blog_visitors_blog_id_idx
  on public.blog_visitors (blog_id);

alter table public.blog_visitors enable row level security;

create or replace function public.record_blog_visit(
  p_blog_id bigint,
  p_visitor_hash text
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.blog_visitors (blog_id, visitor_hash)
  values (p_blog_id, p_visitor_hash)
  on conflict (blog_id, visitor_hash) do update
  set last_visited_at = now(),
      visit_count = public.blog_visitors.visit_count + 1;
$$;

create or replace function public.get_blog_home_stats(p_blog_id bigint)
returns table (total_post_views bigint, total_visitors bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    coalesce((
      select sum(p.view_count)::bigint
      from public.posts p
      where p.blog_id = p_blog_id
        and p.status = 'PUBLISHED'
        and p.deleted_at is null
    ), 0) as total_post_views,
    (select count(*)::bigint from public.blog_visitors v where v.blog_id = p_blog_id) as total_visitors;
$$;

revoke all on public.blog_visitors from anon, authenticated;
revoke all on function public.record_blog_visit(bigint, text) from public, anon, authenticated;
revoke all on function public.get_blog_home_stats(bigint) from public, anon, authenticated;
grant execute on function public.record_blog_visit(bigint, text) to service_role;
grant execute on function public.get_blog_home_stats(bigint) to service_role;
