alter table public.posts
  add column if not exists event_title text,
  add column if not exists event_description text,
  add column if not exists event_cta_label text;

alter table public.posts
  add constraint posts_event_title_length check (event_title is null or char_length(event_title) between 1 and 120),
  add constraint posts_event_description_length check (event_description is null or char_length(event_description) between 1 and 300),
  add constraint posts_event_cta_label_length check (event_cta_label is null or char_length(event_cta_label) between 1 and 40);

create or replace view public.post_details
with (security_invoker = true)
as
select
  p.id, p.blog_id, p.category_id, c.name as category_name, p.title, p.content,
  p.status, p.view_count, p.published_at, p.created_at, p.updated_at, p.deleted_at,
  p.purge_after, b.name as blog_name, b.slug as blog_slug, b.owner_id,
  u.nickname as author_nickname, p.content_document, p.is_event,
  p.event_title, p.event_description, p.event_cta_label
from public.posts p
join public.blogs b on b.id = p.blog_id
join public.users u on u.id = b.owner_id
left join public.blog_categories c on c.id = p.category_id;

revoke all on public.post_details from public, anon, authenticated;
grant select on public.post_details to service_role;
