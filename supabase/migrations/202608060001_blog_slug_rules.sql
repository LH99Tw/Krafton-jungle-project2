alter table public.blogs
  drop constraint if exists blogs_slug_format;

alter table public.blogs
  add constraint blogs_slug_format check (
    slug ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$'
    and slug !~ '--'
    and slug not in ('api', 'login', 'signup', 'feed', 'post', 'blog', 'me', 'new', 'manage')
  );

comment on column public.blogs.slug is
  'Unique public blog address identifier used by /blog/{slug}.';
