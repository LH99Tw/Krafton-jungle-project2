-- One RPC per read surface. Filtering, authorization, pagination and related
-- aggregates stay inside PostgreSQL so Edge Functions never fan out Data API
-- requests for a single screen.

create or replace function public.get_posts_payload(
  p_session_hash text,
  p_scope text,
  p_sort text,
  p_page integer,
  p_size integer,
  p_query text default '',
  p_status text default null,
  p_deleted text default 'exclude',
  p_category_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select session.user_id
    from public.sessions session
    where session.session_hash = p_session_hash and session.expires_at > now()
    limit 1
  ),
  filtered as (
    select post.*
    from public.post_details post
    where
      case when p_deleted = 'only' then post.deleted_at is not null else post.deleted_at is null end
      and case
        when p_scope = 'public' then post.status = 'PUBLISHED'
        when p_scope = 'mine' then post.owner_id = (select user_id from viewer)
          and (coalesce(p_status, 'ALL') = 'ALL' or post.status = p_status)
        when p_scope = 'following' then post.status = 'PUBLISHED' and exists (
          select 1 from public.subscriptions relation
          where relation.user_id = (select user_id from viewer) and relation.blog_id = post.blog_id
        )
        when p_scope = 'bookmarked' then post.status = 'PUBLISHED' and exists (
          select 1 from public.post_bookmarks relation
          where relation.user_id = (select user_id from viewer) and relation.post_id = post.id
        )
        else false
      end
      and (coalesce(p_query, '') = '' or post.title ilike '%' || p_query || '%'
        or post.content ilike '%' || p_query || '%'
        or post.author_nickname ilike '%' || p_query || '%'
        or post.blog_name ilike '%' || p_query || '%')
      and (p_scope <> 'mine' or p_category_id is null
        or (p_category_id = 'uncategorized' and post.category_id is null)
        or (p_category_id ~ '^[0-9]+$' and post.category_id = p_category_id::bigint))
  ),
  numbered as (
    select post.*,
      row_number() over (order by
        case when p_sort = 'popular' then post.view_count end desc nulls last,
        case when p_sort <> 'popular' and p_scope = 'mine' then post.updated_at end desc nulls last,
        case when p_sort <> 'popular' and p_scope <> 'mine' then post.published_at end desc nulls last,
        case when p_sort = 'popular' and p_scope <> 'mine' then post.published_at end desc nulls last,
        post.id desc
      ) as position,
      count(*) over () as total_items
    from filtered post
  ),
  page_rows as (
    select * from numbered
    where position > (p_page - 1) * p_size and position <= p_page * p_size
  ),
  totals as (select coalesce(max(total_items), (select count(*) from filtered), 0)::bigint total_items from page_rows)
  select jsonb_build_object(
    'authenticated', (select user_id from viewer) is not null,
    'data', coalesce((
      select jsonb_agg(public.post_card_json(row.id, (select user_id from viewer)) || jsonb_build_object(
        'deletedAt', row.deleted_at, 'purgeAfter', row.purge_after
      ) order by row.position)
      from page_rows row
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', p_page, 'size', p_size,
      'totalItems', (select total_items from totals),
      'totalPages', case when (select total_items from totals) = 0 then 0 else ((select total_items from totals) + p_size - 1) / p_size end
    )
  );
$$;

create or replace function public.get_market_payload(
  p_session_hash text,
  p_storage_base text,
  p_scope text,
  p_sort text,
  p_page integer,
  p_size integer,
  p_query text default '',
  p_category text default '',
  p_condition text default null,
  p_status text default 'SELLING',
  p_deleted text default 'exclude'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select session.user_id
    from public.sessions session
    where session.session_hash = p_session_hash and session.expires_at > now()
    limit 1
  ),
  filtered as (
    select item.*
    from public.market_item_details item
    where
      case when p_deleted = 'only' then item.deleted_at is not null else item.deleted_at is null end
      and case
        when p_scope = 'public' then item.status = 'SELLING'
        when p_scope = 'mine' then item.seller_id = (select user_id from viewer)
        when p_scope = 'liked' then exists (
          select 1 from public.market_item_likes relation
          where relation.user_id = (select user_id from viewer) and relation.item_id = item.id
        )
        else false
      end
      and (p_status = 'ALL' or item.status = p_status)
      and (coalesce(p_category, '') = '' or item.category = p_category)
      and (p_condition is null or item.condition = p_condition)
      and (
        coalesce(p_query, '') = ''
        or (left(p_query, 1) = '#' and lower(substring(p_query from 2)) = any(item.tags))
        or (left(p_query, 1) <> '#' and (item.title ilike '%' || p_query || '%'
          or item.description ilike '%' || p_query || '%'
          or item.category ilike '%' || p_query || '%'))
      )
  ),
  numbered as (
    select item.*,
      row_number() over (order by
        case when p_sort = 'popular' then item.like_count end desc nulls last,
        case when p_sort = 'price_asc' then item.price_points end asc nulls last,
        case when p_sort = 'price_desc' then item.price_points end desc nulls last,
        case when p_sort in ('latest', 'popular') then item.created_at end desc nulls last,
        item.id desc
      ) as position,
      count(*) over () as total_items
    from filtered item
  ),
  page_rows as (
    select * from numbered
    where position > (p_page - 1) * p_size and position <= p_page * p_size
  ),
  totals as (select coalesce(max(total_items), (select count(*) from filtered), 0)::bigint total_items from page_rows)
  select jsonb_build_object(
    'authenticated', (select user_id from viewer) is not null,
    'data', coalesce((
      select jsonb_agg(public.market_item_card_json(row.id, (select user_id from viewer), p_storage_base) order by row.position)
      from page_rows row
    ), '[]'::jsonb),
    'pagination', jsonb_build_object(
      'page', p_page, 'size', p_size,
      'totalItems', (select total_items from totals),
      'totalPages', case when (select total_items from totals) = 0 then 0 else ((select total_items from totals) + p_size - 1) / p_size end
    )
  );
$$;

create or replace function public.get_public_blog_payload(
  p_session_hash text,
  p_slug text,
  p_page integer,
  p_size integer,
  p_storage_origin text
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select session.user_id
    from public.sessions session
    where session.session_hash = p_session_hash and session.expires_at > now()
    limit 1
  ),
  target_blog as (
    select blog.*, owner.nickname owner_nickname
    from public.blogs blog join public.users owner on owner.id = blog.owner_id
    where blog.slug = p_slug limit 1
  ),
  post_rows as (
    select post.*,
      row_number() over (order by post.published_at desc, post.id desc) position,
      count(*) over () total_items
    from public.post_details post
    where post.blog_id = (select id from target_blog)
      and post.status = 'PUBLISHED' and post.deleted_at is null
  ),
  selected_posts as (
    select * from post_rows where position > (p_page - 1) * p_size and position <= p_page * p_size
  ),
  market_rows as (
    select item.*,
      row_number() over (order by item.created_at desc, item.id desc) position,
      count(*) over () total_items
    from public.market_item_details item
    where item.seller_id = (select owner_id from target_blog) and item.deleted_at is null
  ),
  selected_market as (select * from market_rows where position <= 8),
  counts as (
    select
      (select count(*) from post_rows)::bigint post_count,
      (select count(*) from market_rows)::bigint market_count
  )
  select jsonb_build_object(
    'found', exists(select 1 from target_blog),
    'data', case when not exists(select 1 from target_blog) then null else jsonb_build_object(
      'blog', (select jsonb_build_object(
        'id', blog.id, 'name', blog.name, 'slug', blog.slug, 'url', '/blog/' || blog.slug,
        'description', blog.description, 'shopName', blog.shop_name, 'shopDescription', blog.shop_description,
        'profileImageUrl', case when blog.profile_image_path is null then null else rtrim(p_storage_origin, '/') || '/storage/v1/object/public/blog-profile-images/' || blog.profile_image_path end,
        'owner', jsonb_build_object('id', blog.owner_id, 'nickname', blog.owner_nickname),
        'createdAt', blog.created_at, 'updatedAt', blog.updated_at,
        'isSubscribed', (select user_id from viewer) is not null and exists (
          select 1 from public.subscriptions relation where relation.blog_id = blog.id and relation.user_id = (select user_id from viewer)
        ),
        'subscriberCount', (select count(*) from public.subscriptions relation where relation.blog_id = blog.id)
      ) from target_blog blog),
      'posts', jsonb_build_object(
        'items', coalesce((select jsonb_agg(public.post_card_json(row.id, (select user_id from viewer)) order by row.position) from selected_posts row), '[]'::jsonb),
        'pagination', jsonb_build_object('page', p_page, 'size', p_size, 'totalItems', (select post_count from counts),
          'totalPages', case when (select post_count from counts) = 0 then 0 else ((select post_count from counts) + p_size - 1) / p_size end)
      ),
      'market', jsonb_build_object(
        'items', coalesce((select jsonb_agg(public.market_item_card_json(row.id, (select user_id from viewer), rtrim(p_storage_origin, '/') || '/storage/v1/object/public/market-item-images') order by row.position) from selected_market row), '[]'::jsonb),
        'pagination', jsonb_build_object('page', 1, 'size', 8, 'totalItems', (select market_count from counts),
          'totalPages', case when (select market_count from counts) = 0 then 0 else ((select market_count from counts) + 7) / 8 end)
      )
    ) end
  );
$$;

revoke all on function public.get_posts_payload(text, text, text, integer, integer, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_market_payload(text, text, text, text, integer, integer, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.get_public_blog_payload(text, text, integer, integer, text) from public, anon, authenticated;
grant execute on function public.get_posts_payload(text, text, text, integer, integer, text, text, text, text) to service_role;
grant execute on function public.get_market_payload(text, text, text, text, integer, integer, text, text, text, text, text) to service_role;
grant execute on function public.get_public_blog_payload(text, text, integer, integer, text) to service_role;
