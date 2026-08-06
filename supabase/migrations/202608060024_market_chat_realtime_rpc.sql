-- Chat reads stay behind the Edge Function's custom cookie session. Realtime
-- carries invalidation only; message bodies are fetched through these
-- service-role-only RPCs after the API verifies the participant.

create or replace function public.get_market_chat_conversations(p_user_id bigint)
returns table (
  id bigint,
  item_id bigint,
  buyer_id bigint,
  seller_id bigint,
  created_at timestamptz,
  updated_at timestamptz,
  item_title text,
  peer_id bigint,
  peer_nickname text,
  peer_profile_image_path text,
  last_message_id bigint,
  last_message_body text,
  last_message_sender_id bigint,
  last_message_created_at timestamptz,
  unread_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    conversation.id,
    conversation.item_id,
    conversation.buyer_id,
    conversation.seller_id,
    conversation.created_at,
    conversation.updated_at,
    item.title,
    peer.id,
    peer.nickname,
    peer_blog.profile_image_path,
    last_message.id,
    last_message.body,
    last_message.sender_id,
    last_message.created_at,
    coalesce(unread.total, 0)
  from public.market_conversations conversation
  join public.market_items item on item.id = conversation.item_id
  join public.users peer on peer.id = case when conversation.buyer_id = p_user_id then conversation.seller_id else conversation.buyer_id end
  left join public.blogs peer_blog on peer_blog.owner_id = peer.id
  left join lateral (
    select message.id, message.body, message.sender_id, message.created_at
    from public.market_messages message
    where message.conversation_id = conversation.id
    order by message.id desc
    limit 1
  ) last_message on true
  left join lateral (
    select count(*)::bigint as total
    from public.market_messages message
    where message.conversation_id = conversation.id
      and message.sender_id <> p_user_id
      and message.read_at is null
  ) unread on true
  where conversation.buyer_id = p_user_id or conversation.seller_id = p_user_id
  order by conversation.updated_at desc;
$$;

create or replace function public.get_market_chat_messages(
  p_user_id bigint,
  p_conversation_id bigint,
  p_limit integer default 200
)
returns table (
  id bigint,
  conversation_id bigint,
  sender_id bigint,
  body text,
  read_at timestamptz,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select message.id, message.conversation_id, message.sender_id, message.body, message.read_at, message.created_at
  from public.market_messages message
  where message.conversation_id = p_conversation_id
    and exists (
      select 1
      from public.market_conversations conversation
      where conversation.id = p_conversation_id
        and (conversation.buyer_id = p_user_id or conversation.seller_id = p_user_id)
    )
  order by message.id asc
  limit least(greatest(p_limit, 1), 200);
$$;

revoke all on function public.get_market_chat_conversations(bigint) from public, anon, authenticated;
revoke all on function public.get_market_chat_messages(bigint, bigint, integer) from public, anon, authenticated;
grant execute on function public.get_market_chat_conversations(bigint) to service_role;
grant execute on function public.get_market_chat_messages(bigint, bigint, integer) to service_role;

-- A single public version row contains no chat data. It is the postgres_changes
-- fallback for projects where realtime.send is temporarily unavailable.
create table if not exists public.market_chat_versions (
  id boolean primary key default true check (id),
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.market_chat_versions enable row level security;
grant select on public.market_chat_versions to anon, authenticated;
drop policy if exists "market chat version is publicly readable" on public.market_chat_versions;
create policy "market chat version is publicly readable"
  on public.market_chat_versions for select to anon, authenticated using (true);
insert into public.market_chat_versions(id) values (true) on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'market_chat_versions'
  ) then
    alter publication supabase_realtime add table public.market_chat_versions;
  end if;
end;
$$;

create or replace function public.notify_market_chat_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_conversation_id bigint;
begin
  target_conversation_id := case when tg_table_name = 'market_messages' then new.conversation_id else new.id end;
  insert into public.market_chat_versions(id, version, updated_at)
  values (true, 1, clock_timestamp())
  on conflict (id) do update
    set version = public.market_chat_versions.version + 1,
        updated_at = excluded.updated_at;

  if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
    execute 'select realtime.send($1, $2, $3, $4)'
      using jsonb_build_object('conversationId', target_conversation_id),
        'changed', 'market-chat', false;
  end if;
  return null;
end;
$$;

revoke all on function public.notify_market_chat_change() from public, anon, authenticated;

drop trigger if exists market_conversations_realtime_insert on public.market_conversations;
create trigger market_conversations_realtime_insert
after insert on public.market_conversations
for each row execute function public.notify_market_chat_change();

drop trigger if exists market_messages_realtime_change on public.market_messages;
create trigger market_messages_realtime_change
after insert or update of read_at on public.market_messages
for each row execute function public.notify_market_chat_change();
