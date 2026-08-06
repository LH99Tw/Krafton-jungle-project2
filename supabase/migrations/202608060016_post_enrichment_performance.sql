-- Collapse the repeated engagement/classification lookups for a page of posts
-- into one database round trip. The supporting relation indexes already exist.
create or replace function public.enrich_post_summaries(
  p_post_ids bigint[],
  p_user_id bigint default null
)
returns table (
  post_id bigint,
  classifications jsonb,
  like_count bigint,
  bookmark_count bigint,
  comment_count bigint,
  is_liked boolean,
  is_bookmarked boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select requested.post_id,
    coalesce((
      select jsonb_agg(
        jsonb_build_object('id', classification.id, 'name', classification.name)
        order by link.position
      )
      from public.post_classifications link
      join public.blog_classifications classification
        on classification.id = link.classification_id
      where link.post_id = requested.post_id
    ), '[]'::jsonb) as classifications,
    (select count(*) from public.post_likes relation where relation.post_id = requested.post_id) as like_count,
    (select count(*) from public.post_bookmarks relation where relation.post_id = requested.post_id) as bookmark_count,
    (select count(*) from public.post_comments relation where relation.post_id = requested.post_id and relation.deleted_at is null) as comment_count,
    p_user_id is not null and exists (
      select 1 from public.post_likes relation
      where relation.post_id = requested.post_id and relation.user_id = p_user_id
    ) as is_liked,
    p_user_id is not null and exists (
      select 1 from public.post_bookmarks relation
      where relation.post_id = requested.post_id and relation.user_id = p_user_id
    ) as is_bookmarked
  from unnest(coalesce(p_post_ids, '{}'::bigint[])) with ordinality
    as requested(post_id, position)
  order by requested.position;
$$;

revoke all on function public.enrich_post_summaries(bigint[], bigint) from public, anon, authenticated;
grant execute on function public.enrich_post_summaries(bigint[], bigint) to service_role;

comment on function public.enrich_post_summaries(bigint[], bigint) is
  'Returns classifications, engagement counts, and viewer state for a page of posts in one call.';
