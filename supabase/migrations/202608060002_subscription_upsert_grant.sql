grant select, insert, update, delete on table public.subscriptions to service_role;

comment on table public.subscriptions is
  'User-to-blog subscriptions; update privilege supports idempotent API upserts.';
