create or replace function public.login_user_session(
  p_user_id bigint,
  p_old_session_hash text,
  p_new_session_hash text,
  p_csrf_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.sessions
    where session_hash = p_old_session_hash
      and csrf_token = p_csrf_token
      and expires_at > now()
  ) then
    raise exception using errcode = 'P0001', message = 'CSRF_TOKEN_INVALID';
  end if;

  delete from public.sessions where session_hash = p_old_session_hash;

  insert into public.sessions (
    session_hash,
    user_id,
    csrf_token,
    expires_at
  ) values (
    p_new_session_hash,
    p_user_id,
    p_csrf_token,
    now() + interval '7 days'
  );
end;
$$;

revoke all on function public.login_user_session(bigint, text, text, text) from public;
revoke all on function public.login_user_session(bigint, text, text, text) from anon;
revoke all on function public.login_user_session(bigint, text, text, text) from authenticated;
grant execute on function public.login_user_session(bigint, text, text, text) to service_role;
