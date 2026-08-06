-- Search the interests explicitly attached to a post. Writer-created custom
-- classifications remain separate from the shared interest taxonomy.

drop function if exists public.get_posts_payload(text, text, text, integer, integer, text, text, text, text);

create function public.get_posts_payload(
  p_session_hash text,
  p_scope text,
  p_sort text,
  p_page integer,
  p_size integer,
  p_query text default '',
  p_interest text default '',
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
      and (
        coalesce(p_query, '') = ''
        or post.title ilike '%' || p_query || '%'
        or post.content ilike '%' || p_query || '%'
        or post.author_nickname ilike '%' || p_query || '%'
        or post.blog_name ilike '%' || p_query || '%'
        or exists (
          select 1
          from public.post_classifications relation
          join public.blog_classifications classification on classification.id = relation.classification_id
          where relation.post_id = post.id
            and classification.source = 'INTEREST'
            and classification.name ilike '%' || p_query || '%'
        )
      )
      and (
        coalesce(p_interest, '') = ''
        or exists (
          select 1
          from public.post_classifications relation
          join public.blog_classifications classification on classification.id = relation.classification_id
          where relation.post_id = post.id
            and classification.source = 'INTEREST'
            and lower(trim(classification.name)) = lower(trim(p_interest))
        )
      )
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
      'page', p_page,
      'size', p_size,
      'totalItems', (select total_items from totals),
      'totalPages', case when (select total_items from totals) = 0 then 0 else ((select total_items from totals) + p_size - 1) / p_size end
    )
  );
$$;

revoke all on function public.get_posts_payload(text, text, text, integer, integer, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.get_posts_payload(text, text, text, integer, integer, text, text, text, text, text) to service_role;
