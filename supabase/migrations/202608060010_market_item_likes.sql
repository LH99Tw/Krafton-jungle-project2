create table public.market_item_likes (
  user_id bigint not null references public.users(id) on delete cascade,
  item_id bigint not null references public.market_items(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, item_id)
);

create index market_item_likes_item_idx on public.market_item_likes (item_id);

alter table public.market_item_likes enable row level security;
revoke all on public.market_item_likes from public, anon, authenticated;
grant select, insert, delete on public.market_item_likes to service_role;

create view public.market_item_details
with (security_invoker = true)
as
select mi.id, mi.seller_id, mi.title, mi.description, mi.category, mi.tags,
  mi.condition, mi.price_points, mi.status, mi.created_at, mi.updated_at,
  mi.deleted_at, mi.purge_after, count(mil.user_id)::bigint as like_count
from public.market_items mi
left join public.market_item_likes mil on mil.item_id = mi.id
group by mi.id;

revoke all on public.market_item_details from public, anon, authenticated;
grant select on public.market_item_details to service_role;
