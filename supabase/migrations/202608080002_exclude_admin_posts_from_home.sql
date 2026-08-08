-- Official notices belong to the notice channel, not ranked home content.
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
  public_posts as (
    select post.*
    from public.post_details post
    where post.status = 'PUBLISHED'
      and post.deleted_at is null
      and post.blog_slug <> 'admin'
  ),
  popular as (
    select post.id, post.blog_id, post.view_count, post.published_at
    from public_posts post
    order by post.view_count desc, post.published_at desc, post.id desc
    limit 30
  ),
  recent as (
    select post.id, post.published_at
    from public_posts post
    where post.published_at >= now() - interval '30 days'
    order by post.published_at desc, post.id desc
    limit 30
  ),
  latest_blogs as (
    select blog.*
    from public.blogs blog
    where blog.slug <> 'admin'
    order by blog.created_at desc, blog.id desc
    limit 16
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
      where banner.post_id is null
        and banner.is_active
        and banner.starts_at <= now()
        and (banner.ends_at is null or banner.ends_at > now())
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

revoke all on function public.get_home_payload(text, text) from public, anon, authenticated;
grant execute on function public.get_home_payload(text, text) to service_role;
