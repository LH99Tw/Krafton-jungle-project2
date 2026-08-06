alter table public.posts
  add column if not exists content_document jsonb;

create table if not exists public.post_images (
  id uuid primary key default gen_random_uuid(),
  owner_id bigint not null references public.users(id) on delete cascade,
  post_id bigint references public.posts(id) on delete cascade,
  draft_key uuid not null,
  storage_path text not null unique,
  width integer not null,
  height integer not null,
  byte_size integer not null,
  created_at timestamptz not null default now(),
  constraint post_images_dimensions check (width between 1 and 10000 and height between 1 and 10000),
  constraint post_images_size check (byte_size between 16 and 2097152)
);

create index if not exists post_images_owner_draft_idx on public.post_images (owner_id, draft_key);
create index if not exists post_images_post_idx on public.post_images (post_id);

alter table public.post_images enable row level security;
revoke all on public.post_images from public, anon, authenticated;
grant all on public.post_images to service_role;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152, array['image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace view public.post_details
with (security_invoker = true)
as
select
  p.id, p.blog_id, p.category_id, c.name as category_name, p.title, p.content,
  p.status, p.view_count, p.published_at, p.created_at, p.updated_at, p.deleted_at,
  p.purge_after, b.name as blog_name, b.slug as blog_slug, b.owner_id,
  u.nickname as author_nickname, p.content_document
from public.posts p
join public.blogs b on b.id = p.blog_id
join public.users u on u.id = b.owner_id
left join public.blog_categories c on c.id = p.category_id;

revoke all on public.post_details from public, anon, authenticated;
grant select on public.post_details to service_role;
