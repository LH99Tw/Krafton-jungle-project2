create index if not exists market_messages_unread_idx
  on public.market_messages (conversation_id, sender_id, read_at)
  where read_at is null;
