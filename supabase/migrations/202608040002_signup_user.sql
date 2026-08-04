create or replace function public.signup_user(
  p_email text,
  p_password_hash text,
  p_nickname text,
  p_session_hash text,
  p_csrf_token text
)
returns table (
  id bigint,
  email text,
  nickname text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_user public.users%rowtype;
begin
  if not exists (
    select 1
    from public.sessions
    where session_hash = p_session_hash
      and csrf_token = p_csrf_token
      and expires_at > now()
  ) then
    raise exception using
      errcode = 'P0001',
      message = 'CSRF_TOKEN_INVALID';
  end if;

  insert into public.users (email, password_hash, nickname)
  values (p_email, p_password_hash, p_nickname)
  returning * into created_user;

  update public.sessions
  set user_id = created_user.id,
      updated_at = now(),
      expires_at = now() + interval '7 days'
  where session_hash = p_session_hash;

  return query
  select
    created_user.id,
    created_user.email,
    created_user.nickname,
    created_user.created_at,
    created_user.updated_at;
end;
$$;

revoke all on function public.signup_user(text, text, text, text, text) from public;
revoke all on function public.signup_user(text, text, text, text, text) from anon;
revoke all on function public.signup_user(text, text, text, text, text) from authenticated;
grant execute on function public.signup_user(text, text, text, text, text) to service_role;
