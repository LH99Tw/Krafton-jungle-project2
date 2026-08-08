-- Per-user room pinning. Leaving remains a reversible, per-user soft delete.
alter table public.market_conversations
  add column if not exists buyer_pinned_at timestamptz,
  add column if not exists seller_pinned_at timestamptz;

drop function if exists public.get_market_chat_conversations(bigint);
create function public.get_market_chat_conversations(p_user_id bigint)
returns table (
  id bigint, item_id bigint, buyer_id bigint, seller_id bigint,
  created_at timestamptz, updated_at timestamptz, item_title text,
  peer_id bigint, peer_nickname text, peer_profile_image_path text,
  last_message_id bigint, last_message_body text, last_message_sender_id bigint,
  last_message_created_at timestamptz, unread_count bigint, pinned_at timestamptz
)
language sql stable security definer set search_path = public
as $$
  select
    conversation.id, conversation.item_id, conversation.buyer_id, conversation.seller_id,
    conversation.created_at, conversation.updated_at, item.title, peer.id, peer.nickname,
    peer_blog.profile_image_path, last_message.id,
    case when last_message.deleted_at is null then last_message.body else '삭제된 메시지입니다.' end,
    last_message.sender_id, last_message.created_at, coalesce(unread.total, 0),
    case when conversation.buyer_id = p_user_id then conversation.buyer_pinned_at else conversation.seller_pinned_at end
  from public.market_conversations conversation
  join public.market_items item on item.id = conversation.item_id
  join public.users peer on peer.id = case when conversation.buyer_id = p_user_id then conversation.seller_id else conversation.buyer_id end
  left join public.blogs peer_blog on peer_blog.owner_id = peer.id
  left join lateral (
    select message.id, message.body, message.sender_id, message.created_at, message.deleted_at
    from public.market_messages message where message.conversation_id = conversation.id
    order by message.id desc limit 1
  ) last_message on true
  left join lateral (
    select count(*)::bigint as total from public.market_messages message
    where message.conversation_id = conversation.id and message.sender_id <> p_user_id
      and message.read_at is null and message.deleted_at is null
  ) unread on true
  where (conversation.buyer_id = p_user_id and conversation.buyer_left_at is null)
     or (conversation.seller_id = p_user_id and conversation.seller_left_at is null)
  order by
    (case when conversation.buyer_id = p_user_id then conversation.buyer_pinned_at else conversation.seller_pinned_at end) desc nulls last,
    conversation.updated_at desc;
$$;

revoke all on function public.get_market_chat_conversations(bigint) from public, anon, authenticated;
grant execute on function public.get_market_chat_conversations(bigint) to service_role;
