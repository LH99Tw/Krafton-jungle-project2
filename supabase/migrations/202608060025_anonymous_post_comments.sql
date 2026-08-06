alter table public.post_comments
  add column if not exists is_anonymous boolean not null default false;

comment on column public.post_comments.is_anonymous is
  'When true, the API hides the author identity from everyone except the author.';
