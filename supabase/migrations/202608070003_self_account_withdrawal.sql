-- Withdraw an account atomically while retaining authored content for operators.
-- A null purge_after keeps withdrawal content out of the scheduled 30-day purge.

create or replace function public.withdraw_own_account(
  p_user_id bigint,
  p_replacement_password_hash text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := now();
begin
  if p_replacement_password_hash is null or char_length(p_replacement_password_hash) < 20 then
    raise exception 'INVALID_PASSWORD_HASH';
  end if;

  perform 1
  from public.users
  where id = p_user_id and role <> 'ADMIN' and account_status = 'ACTIVE'
  for update;
  if not found then raise exception 'ACCOUNT_NOT_ACTIVE'; end if;

  update public.posts post
  set deleted_at = coalesce(post.deleted_at, v_now),
      purge_after = null,
      updated_at = v_now
  from public.blogs blog
  where post.blog_id = blog.id and blog.owner_id = p_user_id;

  update public.market_items
  set deleted_at = coalesce(deleted_at, v_now),
      purge_after = null,
      updated_at = v_now
  where seller_id = p_user_id;

  update public.blogs
  set name = '탈퇴한 사용자의 블로그',
      description = '',
      profile_image_path = null,
      shop_name = '탈퇴한 사용자의 상점',
      shop_description = '',
      updated_at = v_now
  where owner_id = p_user_id;

  update public.users
  set email = 'withdrawn+' || p_user_id || '@deleted.invalid',
      nickname = '탈퇴한 사용자 ' || p_user_id,
      login_id = null,
      interests = '{}'::text[],
      password_hash = p_replacement_password_hash,
      account_status = 'WITHDRAWN',
      withdrawn_at = v_now,
      password_change_required = false,
      updated_at = v_now
  where id = p_user_id;

  delete from public.sessions where user_id = p_user_id;
end;
$$;

revoke all on function public.withdraw_own_account(bigint, text) from public, anon, authenticated;
grant execute on function public.withdraw_own_account(bigint, text) to service_role;

comment on function public.withdraw_own_account(bigint, text) is
  'Atomically anonymizes an account and indefinitely retains its posts and market items in operator trash.';
