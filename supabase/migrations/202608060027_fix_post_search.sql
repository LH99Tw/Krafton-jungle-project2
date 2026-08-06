create or replace function public.get_posts_payload_v2(
  p_session_hash text, p_scope text, p_sort text, p_page integer, p_size integer,
  p_query text default '', p_interest text default '', p_status text default null,
  p_deleted text default 'exclude', p_category_id text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with viewer as (
    select session.user_id from public.sessions session
    where session.session_hash = p_session_hash and session.expires_at > now() limit 1
  ),
  filtered as (
    select post.id, post.blog_id, post.category_id, category.name category_name,
      post.title, post.content, post.status, post.view_count, post.published_at,
      post.created_at, post.updated_at, post.deleted_at, post.purge_after,
      blog.name blog_name, blog.slug blog_slug, blog.owner_id, author.nickname author_nickname
    from public.posts post
    join public.blogs blog on blog.id = post.blog_id
    join public.users author on author.id = blog.owner_id
    left join public.blog_categories category on category.id = post.category_id
    where (case when p_deleted = 'only' then post.deleted_at is not null else post.deleted_at is null end)
      and case
        when p_scope = 'public' then post.status = 'PUBLISHED'
        when p_scope = 'mine' then blog.owner_id = (select user_id from viewer)
          and (coalesce(p_status, 'ALL') = 'ALL' or post.status = p_status)
        when p_scope = 'following' then post.status = 'PUBLISHED' and exists (
          select 1 from public.subscriptions relation
          where relation.user_id = (select user_id from viewer) and relation.blog_id = post.blog_id)
        when p_scope = 'bookmarked' then post.status = 'PUBLISHED' and exists (
          select 1 from public.post_bookmarks relation
          where relation.user_id = (select user_id from viewer) and relation.post_id = post.id)
        else false end
      and (coalesce(p_query, '') = '' or post.title ilike '%' || p_query || '%'
        or post.content ilike '%' || p_query || '%' or author.nickname ilike '%' || p_query || '%'
        or blog.name ilike '%' || p_query || '%' or exists (
          select 1 from public.post_classifications link
          join public.blog_classifications classification on classification.id = link.classification_id
          where link.post_id = post.id and classification.source = 'INTEREST'
            and classification.name ilike '%' || p_query || '%'))
      and (coalesce(p_interest, '') = '' or exists (
        select 1 from public.post_classifications link
        join public.blog_classifications classification on classification.id = link.classification_id
        where link.post_id = post.id and classification.source = 'INTEREST'
          and lower(trim(classification.name)) = lower(trim(p_interest))))
      and (p_scope <> 'mine' or p_category_id is null
        or (p_category_id = 'uncategorized' and post.category_id is null)
        or (p_category_id ~ '^[0-9]+$' and post.category_id = p_category_id::bigint))
  ),
  numbered as (
    select row.*, row_number() over (order by
      case when p_sort = 'popular' then row.view_count end desc nulls last,
      case when p_sort <> 'popular' and p_scope = 'mine' then row.updated_at end desc nulls last,
      case when p_sort <> 'popular' and p_scope <> 'mine' then row.published_at end desc nulls last,
      case when p_sort = 'popular' and p_scope <> 'mine' then row.published_at end desc nulls last,
      row.id desc) position, count(*) over () total_items
    from filtered row
  ),
  page_rows as (
    select * from numbered where position > (p_page - 1) * p_size and position <= p_page * p_size
  ),
  cards as (
    select row.position, jsonb_build_object(
      'id', row.id, 'url', '/post/' || row.id, 'title', row.title,
      'excerpt', case when char_length(row.content) > 160 then left(row.content, 160) || '…' else row.content end,
      'status', row.status,
      'category', case when row.category_id is null then null else jsonb_build_object('id', row.category_id, 'name', row.category_name) end,
      'classifications', coalesce((select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by link.position)
        from public.post_classifications link join public.blog_classifications c on c.id = link.classification_id where link.post_id = row.id), '[]'::jsonb),
      'viewCount', row.view_count,
      'likeCount', (select count(*) from public.post_likes relation where relation.post_id = row.id),
      'bookmarkCount', (select count(*) from public.post_bookmarks relation where relation.post_id = row.id),
      'commentCount', (select count(*) from public.post_comments relation where relation.post_id = row.id and relation.deleted_at is null),
      'isLiked', (select user_id from viewer) is not null and exists (select 1 from public.post_likes relation where relation.post_id = row.id and relation.user_id = (select user_id from viewer)),
      'isBookmarked', (select user_id from viewer) is not null and exists (select 1 from public.post_bookmarks relation where relation.post_id = row.id and relation.user_id = (select user_id from viewer)),
      'author', jsonb_build_object('id', row.owner_id, 'nickname', row.author_nickname),
      'blog', jsonb_build_object('id', row.blog_id, 'name', row.blog_name, 'slug', row.blog_slug),
      'publishedAt', row.published_at, 'createdAt', row.created_at, 'updatedAt', row.updated_at,
      'deletedAt', row.deleted_at, 'purgeAfter', row.purge_after
    ) card from page_rows row
  ),
  total as (select count(*)::bigint value from filtered)
  select jsonb_build_object(
    'authenticated', (select user_id from viewer) is not null,
    'data', coalesce((select jsonb_agg(card order by position) from cards), '[]'::jsonb),
    'pagination', jsonb_build_object('page', p_page, 'size', p_size, 'totalItems', (select value from total),
      'totalPages', case when (select value from total) = 0 then 0 else ((select value from total) + p_size - 1) / p_size end)
  );
$$;

revoke all on function public.get_posts_payload_v2(text,text,text,integer,integer,text,text,text,text,text) from public, anon, authenticated;
grant execute on function public.get_posts_payload_v2(text,text,text,integer,integer,text,text,text,text,text) to service_role;
