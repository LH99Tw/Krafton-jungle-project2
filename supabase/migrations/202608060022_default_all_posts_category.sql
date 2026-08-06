alter table public.blog_categories
  add column if not exists is_default boolean not null default false;

-- Move existing positions out of the way so the protected category can take
-- position zero without violating the per-blog unique position constraint.
update public.blog_categories
set position = position + 1000;

update public.blog_categories
set name = '전체글', normalized_name = '전체글', position = 0, is_default = true, updated_at = now()
where normalized_name = '전체글';

insert into public.blog_categories (blog_id, name, normalized_name, position, is_default)
select blog.id, '전체글', '전체글', 0, true
from public.blogs blog
where not exists (
  select 1 from public.blog_categories category
  where category.blog_id = blog.id and category.is_default
);

update public.blog_categories
set position = position - 999
where not is_default;

create unique index if not exists blog_categories_one_default_per_blog_idx
  on public.blog_categories (blog_id)
  where is_default;

alter table public.blog_categories
  drop constraint if exists blog_categories_default_identity;

alter table public.blog_categories
  add constraint blog_categories_default_identity
  check (not is_default or (name = '전체글' and normalized_name = '전체글' and position = 0));

update public.posts post
set category_id = category.id, updated_at = now()
from public.blog_categories category
where post.blog_id = category.blog_id
  and category.is_default
  and post.category_id is null;

alter table public.posts
  alter column category_id set not null;

create or replace function public.create_default_blog_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.blog_categories (blog_id, name, normalized_name, position, is_default)
  values (new.id, '전체글', '전체글', 0, true);
  return new;
end;
$$;

drop trigger if exists create_default_blog_category_after_insert on public.blogs;
create trigger create_default_blog_category_after_insert
after insert on public.blogs
for each row execute function public.create_default_blog_category();

revoke all on function public.create_default_blog_category() from public, anon, authenticated;
grant execute on function public.create_default_blog_category() to service_role;
