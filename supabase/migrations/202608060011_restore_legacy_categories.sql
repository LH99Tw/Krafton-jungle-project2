-- The split migration renamed the pre-existing category table to classifications.
-- Restore those legacy rows to the category model while keeping classifications
-- created after the split in blog_classifications.

alter table public.blog_classifications
  add column if not exists migrated_from_category boolean not null default false;

-- Compatibility for databases that already applied 202608060006 before the
-- migration marker was added. The split was applied at this instant locally.
update public.blog_classifications
set migrated_from_category = true
where not exists (
  select 1 from public.blog_classifications where migrated_from_category
)
and created_at < timestamptz '2026-08-06 04:35:07+00';

insert into public.blog_categories (
  blog_id, name, normalized_name, position, created_at, updated_at
)
select
  classification.blog_id,
  classification.name,
  classification.normalized_name,
  row_number() over (
    partition by classification.blog_id
    order by classification.position, classification.id
  ) - 1,
  classification.created_at,
  classification.updated_at
from public.blog_classifications classification
where classification.migrated_from_category
on conflict (blog_id, normalized_name) do nothing;

update public.posts post
set category_id = category.id
from public.post_classifications link
join public.blog_classifications classification
  on classification.id = link.classification_id
 and classification.migrated_from_category
join public.blog_categories category
  on category.blog_id = classification.blog_id
 and category.normalized_name = classification.normalized_name
where post.id = link.post_id
  and link.position = 0
  and post.category_id is null;

delete from public.post_classifications link
using public.blog_classifications classification
where link.classification_id = classification.id
  and classification.migrated_from_category;

delete from public.blog_classifications
where migrated_from_category;

alter table public.blog_classifications
  drop column migrated_from_category;
