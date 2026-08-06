alter table public.blog_classifications
  add column if not exists source text not null default 'CUSTOM';

alter table public.blog_classifications
  drop constraint if exists blog_classifications_source_check;

alter table public.blog_classifications
  add constraint blog_classifications_source_check
  check (source in ('INTEREST', 'CUSTOM'));

update public.blog_classifications classification
set source = 'INTEREST'
from public.blogs blog
join public.users owner on owner.id = blog.owner_id
where classification.blog_id = blog.id
  and exists (
    select 1
    from unnest(coalesce(owner.interests, '{}'::text[])) interest
    where lower(trim(interest)) = classification.normalized_name
  );
