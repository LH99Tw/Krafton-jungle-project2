-- Use the first image attached to a rich post as its home/list thumbnail.
-- The uploaded image URL is already stored in the validated TipTap document.

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
    'thumbnailUrl', (
      select image_node #>> '{attrs,src}'
      from jsonb_path_query(coalesce(post.content_document, '{}'::jsonb), '$.** ? (@.type == "richImage")') image_node
      where coalesce(image_node #>> '{attrs,src}', '') <> ''
      limit 1
    ),
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

revoke all on function public.post_card_json(bigint, bigint) from public, anon, authenticated;
grant execute on function public.post_card_json(bigint, bigint) to service_role;
