-- Projects created without the optional realtime.send database helper need a
-- publication-backed invalidation stream. This migration also repairs projects
-- where 202608060017 was applied before that compatibility change.

do $$
declare target record;
begin
  for target in select * from (values
    ('posts', 'posts'), ('post_likes', 'posts'), ('post_bookmarks', 'posts'),
    ('post_comments', 'posts'), ('post_classifications', 'posts'),
    ('market_items', 'market'), ('market_item_likes', 'market'), ('market_item_images', 'market'),
    ('blogs', 'blogs'), ('subscriptions', 'blogs'), ('home_banners', 'home')
  ) as entries(table_name, surface)
  loop
    execute format('drop trigger if exists content_invalidation on public.%I', target.table_name);
  end loop;
end;
$$;

drop function if exists public.broadcast_content_invalidation();

create table if not exists public.content_versions (
  surface text primary key,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.content_versions enable row level security;
grant select on public.content_versions to anon, authenticated;

drop policy if exists "content versions are publicly readable" on public.content_versions;
create policy "content versions are publicly readable"
  on public.content_versions for select
  to anon, authenticated
  using (true);

insert into public.content_versions(surface)
values ('home'), ('posts'), ('market'), ('blogs')
on conflict (surface) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'content_versions'
  ) then
    alter publication supabase_realtime add table public.content_versions;
  end if;
end;
$$;

create or replace function public.bump_content_version()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.content_versions(surface, version, updated_at)
  values (tg_argv[0], 1, clock_timestamp())
  on conflict (surface) do update
    set version = public.content_versions.version + 1,
        updated_at = excluded.updated_at;
  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    execute 'select realtime.send($1, $2, $3, $4)'
      using jsonb_build_object('surface', tg_argv[0], 'version', extract(epoch from clock_timestamp())::bigint),
        'invalidate', 'content-cache', false;
  end if;
  return null;
end;
$$;

revoke all on function public.bump_content_version() from public, anon, authenticated;

do $$
declare target record;
begin
  for target in select * from (values
    ('posts', 'posts'), ('post_likes', 'posts'), ('post_bookmarks', 'posts'),
    ('post_comments', 'posts'), ('post_classifications', 'posts'),
    ('market_items', 'market'), ('market_item_likes', 'market'), ('market_item_images', 'market'),
    ('blogs', 'blogs'), ('subscriptions', 'blogs'), ('home_banners', 'home')
  ) as entries(table_name, surface)
  loop
    execute format(
      'create trigger content_invalidation after insert or update or delete on public.%I for each statement execute function public.bump_content_version(%L)',
      target.table_name, target.surface
    );
  end loop;
end;
$$;
