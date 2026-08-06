-- Realtime installs realtime.send lazily on some new projects. Emit the
-- preferred Broadcast event whenever it is available, while retaining the
-- publication-backed version row as a no-data fallback during initialization
-- or transient Broadcast failures.

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
