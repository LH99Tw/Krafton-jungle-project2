-- Keep the detail RPC in sync with the rich editor document column.
drop function if exists public.read_post(bigint, bigint);

create or replace function public.read_post(p_post_id bigint, p_request_user_id bigint default null)
returns setof public.post_details
language plpgsql
security definer
set search_path = public
as $$
declare target public.post_details%rowtype;
begin
  select * into target
  from public.post_details
  where id = p_post_id and deleted_at is null;

  if not found then return; end if;
  if target.status = 'DRAFT' and target.owner_id is distinct from p_request_user_id then return; end if;

  if target.status = 'PUBLISHED' then
    update public.posts set view_count = view_count + 1 where id = p_post_id;
    target.view_count := target.view_count + 1;
  end if;

  return next target;
end;
$$;

revoke all on function public.read_post(bigint, bigint) from public, anon, authenticated;
grant execute on function public.read_post(bigint, bigint) to service_role;
