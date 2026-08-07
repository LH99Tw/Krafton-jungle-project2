alter table public.posts
  add column if not exists is_event boolean not null default false;

alter table public.home_banners
  add column if not exists post_id bigint references public.posts(id) on delete cascade;

create unique index if not exists home_banners_post_id_unique
  on public.home_banners (post_id)
  where post_id is not null;

create or replace view public.post_details
with (security_invoker = true)
as
select
  p.id, p.blog_id, p.category_id, c.name as category_name, p.title, p.content,
  p.status, p.view_count, p.published_at, p.created_at, p.updated_at, p.deleted_at,
  p.purge_after, b.name as blog_name, b.slug as blog_slug, b.owner_id,
  u.nickname as author_nickname, p.content_document, p.is_event
from public.posts p
join public.blogs b on b.id = p.blog_id
join public.users u on u.id = b.owner_id
left join public.blog_categories c on c.id = p.category_id;

revoke all on public.post_details from public, anon, authenticated;
grant select on public.post_details to service_role;
