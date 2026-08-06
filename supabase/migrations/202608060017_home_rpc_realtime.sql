-- Screen-level read models keep all database work inside Postgres so an Edge
-- request pays for one Data API round trip instead of one trip per carousel.

create or replace function public.post_card_json(p_post_id bigint, p_user_id bigint default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', post.id,
    'url', '/post/' || post.id,
    'title', post.title,
    'excerpt', case when char_length(post.content) > 160 then left(post.content, 160) || '…' else post.content end,
    'status', post.status,
    'category', case when post.category_id is null then null else jsonb_build_object('id', post.category_id, 'name', post.category_name) end,
    'classifications', coalesce((
      select jsonb_agg(jsonb_build_object('id', classification.id, 'name', classification.name) order by link.position)
      from public.post_classifications link
      join public.blog_classifications classification on classification.id = link.classification_id
      where link.post_id = post.id
    ), '[]'::jsonb),
    'viewCount', post.view_count,
    'likeCount', (select count(*) from public.post_likes relation where relation.post_id = post.id),
    'bookmarkCount', (select count(*) from public.post_bookmarks relation where relation.post_id = post.id),
    'commentCount', (select count(*) from public.post_comments relation where relation.post_id = post.id and relation.deleted_at is null),
    'isLiked', p_user_id is not null and exists (select 1 from public.post_likes relation where relation.post_id = post.id and relation.user_id = p_user_id),
    'isBookmarked', p_user_id is not null and exists (select 1 from public.post_bookmarks relation where relation.post_id = post.id and relation.user_id = p_user_id),
    'author', jsonb_build_object('id', post.owner_id, 'nickname', post.author_nickname),
    'blog', jsonb_build_object('id', post.blog_id, 'name', post.blog_name, 'slug', post.blog_slug),
    'publishedAt', post.published_at,
    'createdAt', post.created_at,
    'updatedAt', post.updated_at
  )
  from public.post_details post
  where post.id = p_post_id;
$$;

create or replace function public.market_item_card_json(
  p_item_id bigint,
  p_user_id bigint default null,
  p_storage_base text default ''
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', item.id,
    'url', '/market/' || item.id,
    'seller', jsonb_build_object('id', seller.id, 'nickname', seller.nickname),
    'title', item.title,
    'description', item.description,
    'category', item.category,
    'tags', to_jsonb(item.tags),
    'condition', item.condition,
    'pricePoints', item.price_points,
    'status', item.status,
    'likeCount', item.like_count,
    'isLiked', p_user_id is not null and exists (
      select 1 from public.market_item_likes relation where relation.item_id = item.id and relation.user_id = p_user_id
    ),
    'images', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', image.id,
        'url', rtrim(p_storage_base, '/') || '/' || image.storage_path,
        'position', image.position
      ) order by image.position)
      from public.market_item_images image where image.item_id = item.id
    ), '[]'::jsonb),
    'thumbnailUrl', (
      select rtrim(p_storage_base, '/') || '/' || image.storage_path
      from public.market_item_images image where image.item_id = item.id order by image.position limit 1
    ),
    'createdAt', item.created_at,
    'updatedAt', item.updated_at,
    'deletedAt', item.deleted_at,
    'purgeAfter', item.purge_after
  )
  from public.market_item_details item
  join public.users seller on seller.id = item.seller_id
  where item.id = p_item_id;
$$;

create or replace function public.get_home_payload(
  p_session_hash text default null,
  p_storage_base text default ''
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
  popular as (
    select post.id, post.blog_id, post.view_count, post.published_at
    from public.post_details post
    where post.status = 'PUBLISHED' and post.deleted_at is null
    order by post.view_count desc, post.published_at desc, post.id desc
    limit 30
  ),
  recent as (
    select post.id, post.published_at
    from public.post_details post
    where post.status = 'PUBLISHED' and post.deleted_at is null
      and post.published_at >= now() - interval '30 days'
    order by post.published_at desc, post.id desc
    limit 30
  ),
  latest_blogs as (
    select blog.* from public.blogs blog order by blog.created_at desc, blog.id desc limit 16
  ),
  creator_rows as (
    select blog.id,
      jsonb_build_object(
        'blog', jsonb_build_object(
          'id', blog.id,
          'name', blog.name,
          'slug', blog.slug,
          'owner', jsonb_build_object('id', owner.id, 'nickname', owner.nickname)
        ),
        'subscriberCount', (select count(*) from public.subscriptions relation where relation.blog_id = blog.id),
        'isSubscribed', (select user_id from viewer) is not null and exists (
          select 1 from public.subscriptions relation
          where relation.blog_id = blog.id and relation.user_id = (select user_id from viewer)
        ),
        'posts', coalesce((
          select jsonb_agg(public.post_card_json(card.id, (select user_id from viewer)) order by card.view_count desc, card.published_at desc)
          from (select * from popular candidate where candidate.blog_id = blog.id order by candidate.view_count desc, candidate.published_at desc limit 2) card
        ), '[]'::jsonb)
      ) as payload,
      (select count(*) from public.subscriptions relation where relation.blog_id = blog.id) as subscriber_count
    from latest_blogs blog
    join public.users owner on owner.id = blog.owner_id
    where exists (select 1 from popular candidate where candidate.blog_id = blog.id)
  ),
  popular_json as (
    select coalesce(jsonb_agg(public.post_card_json(item.id, (select user_id from viewer)) order by item.view_count desc, item.published_at desc), '[]'::jsonb) value
    from popular item
  ),
  recent_json as (
    select coalesce(jsonb_agg(public.post_card_json(item.id, (select user_id from viewer)) order by item.published_at desc), '[]'::jsonb) value
    from recent item
  )
  select jsonb_build_object(
    'banners', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', banner.id, 'eyebrow', banner.eyebrow, 'title', banner.title,
        'description', banner.description, 'imageUrl', banner.image_url,
        'ctaLabel', banner.cta_label, 'ctaUrl', banner.cta_url,
        'startsAt', banner.starts_at, 'endsAt', banner.ends_at,
        'position', banner.position, 'isActive', banner.is_active,
        'createdAt', banner.created_at, 'updatedAt', banner.updated_at
      ) order by banner.position, banner.id)
      from public.home_banners banner
      where banner.is_active and banner.starts_at <= now() and (banner.ends_at is null or banner.ends_at > now())
    ), '[]'::jsonb),
    'popularPosts', (select coalesce(jsonb_agg(element), '[]'::jsonb) from jsonb_array_elements((select value from popular_json)) with ordinality entry(element, position) where position <= 5),
    'categoryPosts', (select coalesce(jsonb_agg(element), '[]'::jsonb) from jsonb_array_elements((select value from popular_json)) with ordinality entry(element, position) where position <= 14),
    'trendingPosts', (select coalesce(jsonb_agg(element order by score desc), '[]'::jsonb) from (
      select element,
        ((element->>'viewCount')::bigint + (element->>'likeCount')::bigint * 3 + (element->>'commentCount')::bigint * 4 + (element->>'bookmarkCount')::bigint * 2) score
      from jsonb_array_elements((select value from recent_json)) element
      order by score desc
      limit 5
    ) ranked),
    'latestPosts', (select coalesce(jsonb_agg(element), '[]'::jsonb) from jsonb_array_elements((select value from recent_json)) with ordinality entry(element, position) where position <= 5),
    'marketItems', coalesce((
      select jsonb_agg(public.market_item_card_json(item.id, (select user_id from viewer), p_storage_base) order by item.like_count desc, item.created_at desc, item.id desc)
      from (select * from public.market_item_details where status = 'SELLING' and deleted_at is null order by like_count desc, created_at desc, id desc limit 5) item
    ), '[]'::jsonb),
    'creators', coalesce((select jsonb_agg(payload order by subscriber_count desc, id desc) from (select * from creator_rows order by subscriber_count desc, id desc limit 4) selected), '[]'::jsonb)
  );
$$;

create or replace function public.get_session_context(p_session_hash text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'user', jsonb_build_object(
      'id', app_user.id,
      'email', app_user.email,
      'nickname', app_user.nickname,
      'interests', to_jsonb(app_user.interests),
      'createdAt', app_user.created_at,
      'updatedAt', app_user.updated_at
    ),
    'requiresThirdPartyConsent', app_user.third_party_consent_decided_at is null,
    'blog', case when blog.id is null then null else jsonb_build_object('id', blog.id, 'name', blog.name, 'slug', blog.slug) end
  )
  from public.sessions session
  join public.users app_user on app_user.id = session.user_id
  left join public.blogs blog on blog.owner_id = app_user.id
  where session.session_hash = p_session_hash and session.expires_at > now()
  limit 1;
$$;

revoke all on function public.post_card_json(bigint, bigint) from public, anon, authenticated;
revoke all on function public.market_item_card_json(bigint, bigint, text) from public, anon, authenticated;
revoke all on function public.get_home_payload(text, text) from public, anon, authenticated;
revoke all on function public.get_session_context(text) from public, anon, authenticated;
grant execute on function public.get_home_payload(text, text) to service_role;
grant execute on function public.get_session_context(text) to service_role;

-- Realtime is an invalidation signal only. No application row data is sent.
create or replace function public.broadcast_content_invalidation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform realtime.send(
    jsonb_build_object('surface', tg_argv[0], 'version', extract(epoch from clock_timestamp())::bigint),
    'invalidate',
    'content-cache',
    false
  );
  return null;
end;
$$;

revoke all on function public.broadcast_content_invalidation() from public, anon, authenticated;

do $$
declare target record;
begin
  for target in select * from (values
    ('posts', 'posts'), ('post_likes', 'posts'), ('post_bookmarks', 'posts'),
    ('post_comments', 'posts'), ('post_classifications', 'posts'),
    ('market_items', 'market'), ('market_item_likes', 'market'), ('market_item_images', 'market'),
    ('blogs', 'blogs'), ('subscriptions', 'blogs'), ('home_banners', 'home')
  ) as entries(table_name, surface)
  loop
    execute format('drop trigger if exists content_invalidation on public.%I', target.table_name);
    execute format(
      'create trigger content_invalidation after insert or update or delete on public.%I for each statement execute function public.broadcast_content_invalidation(%L)',
      target.table_name, target.surface
    );
  end loop;
end;
$$;
