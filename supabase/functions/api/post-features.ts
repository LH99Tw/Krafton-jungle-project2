import { apiError, corsHeaders, getSession, json, requireCsrfSession, supabase } from './shared.ts'

export type PostDto = Record<string, any>

export const enrichPosts = async (request: Request, posts: PostDto[], knownUserId?: number | null) => {
  if (!posts.length) return posts
  const ids = posts.map((post) => Number(post.id))
  const userId = knownUserId === undefined ? (await getSession(request))?.user_id ?? null : knownUserId
  const { data, error } = await supabase.rpc('enrich_post_summaries', {
    p_post_ids: ids,
    p_user_id: userId,
  })
  if (error) throw error
  const summaryByPost = new Map((data ?? []).map((summary: Record<string, any>) => [Number(summary.post_id), summary]))
  return posts.map((post) => ({
    ...post,
    classifications: summaryByPost.get(Number(post.id))?.classifications ?? [],
    likeCount: Number(summaryByPost.get(Number(post.id))?.like_count ?? 0),
    bookmarkCount: Number(summaryByPost.get(Number(post.id))?.bookmark_count ?? 0),
    commentCount: Number(summaryByPost.get(Number(post.id))?.comment_count ?? 0),
    isLiked: Boolean(summaryByPost.get(Number(post.id))?.is_liked),
    isBookmarked: Boolean(summaryByPost.get(Number(post.id))?.is_bookmarked),
  }))
}

export const parseClassificationIds = (body: Record<string, unknown>) => {
  if (!Object.prototype.hasOwnProperty.call(body, 'classificationIds')) return { present: false, ids: [] as number[], error: '' }
  if (!Array.isArray(body.classificationIds)) return { present: true, ids: [], error: '분류는 배열로 입력해 주세요.' }
  const ids = body.classificationIds.filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0)
  if (ids.length !== body.classificationIds.length || new Set(ids).size !== ids.length || ids.length > 5) {
    return { present: true, ids: [], error: '분류는 중복 없이 최대 5개까지 선택해 주세요.' }
  }
  return { present: true, ids, error: '' }
}

export const validateClassificationOwnership = async (blogId: number, ids: number[]) => {
  if (ids.length) {
    const { data, error } = await supabase.from('blog_classifications').select('id').eq('blog_id', blogId).in('id', ids)
    if (error || (data ?? []).length !== ids.length) return { error: '현재 블로그의 분류만 선택할 수 있습니다.' }
  }
  return { error: '' }
}

export const replacePostClassifications = async (postId: number, blogId: number, ids: number[]) => {
  const validation = await validateClassificationOwnership(blogId, ids)
  if (validation.error) return validation
  const { error: deleteError } = await supabase.from('post_classifications').delete().eq('post_id', postId)
  if (deleteError) return { error: '분류를 저장하지 못했습니다.' }
  if (ids.length) {
    const { error } = await supabase.from('post_classifications').insert(ids.map((classificationId, position) => ({ post_id: postId, classification_id: classificationId, position })))
    if (error) return { error: '분류를 저장하지 못했습니다.' }
  }
  return { error: '' }
}

const publishedPost = async (id: number) => {
  const { data } = await supabase.from('posts').select('id,status,deleted_at').eq('id', id).maybeSingle()
  return data?.status === 'PUBLISHED' && !data.deleted_at ? data : null
}

const toggleRelation = async (request: Request, postId: number, table: 'post_likes' | 'post_bookmarks', enabled: boolean) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  if (!(await publishedPost(postId))) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const query = enabled
    ? supabase.from(table).upsert({ user_id: session.user_id, post_id: postId }, { onConflict: 'user_id,post_id', ignoreDuplicates: true })
    : supabase.from(table).delete().eq('user_id', session.user_id).eq('post_id', postId)
  const { error } = await query
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return enabled ? json({ data: { active: true } }, 201) : new Response(null, { status: 204, headers: corsHeaders })
}

const commentJson = (comment: Record<string, any>, author: Record<string, any>, viewerId?: number | null) => {
  const anonymous = Boolean(comment.is_anonymous) && !comment.deleted_at
  const ownComment = viewerId === comment.author_id
  return {
  id: comment.id,
  postId: comment.post_id,
  parentId: comment.parent_id,
  body: comment.deleted_at ? '삭제된 댓글입니다.' : comment.body,
  author: { id: anonymous && !ownComment ? 0 : author.id, nickname: anonymous ? '익명' : author.nickname },
  anonymous,
  deleted: Boolean(comment.deleted_at),
  createdAt: comment.created_at,
  updatedAt: comment.updated_at,
  }
}

const listComments = async (request: Request, postId: number, url: URL) => {
  if (!(await publishedPost(postId))) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
  const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? 50) || 50))
  const from = (page - 1) * size
  const { data, count, error } = await supabase.from('post_comments').select('*', { count: 'exact' }).eq('post_id', postId).order('created_at').order('id').range(from, from + size - 1)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '댓글을 불러오지 못했습니다.')
  const authorIds = [...new Set((data ?? []).map((row: Record<string, any>) => row.author_id))]
  const { data: authors } = authorIds.length ? await supabase.from('users').select('id,nickname').in('id', authorIds) : { data: [] }
  const authorMap = new Map((authors ?? []).map((author: Record<string, any>) => [author.id, author]))
  const totalItems = count ?? 0
  const viewerId = (await getSession(request))?.user_id ?? null
  return json({ data: (data ?? []).map((row: Record<string, any>) => commentJson(row, authorMap.get(row.author_id) ?? { id: row.author_id, nickname: '알 수 없음' }, viewerId)), pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 } })
}

const createComment = async (request: Request, postId: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  if (!(await publishedPost(postId))) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const input = await request.json().catch(() => null)
  const body = typeof input?.body === 'string' ? input.body.trim() : ''
  const parentId = input?.parentId == null ? null : Number(input.parentId)
  const anonymous = input?.anonymous === true
  if (!body || body.length > 1000) return apiError(400, 'VALIDATION_ERROR', '댓글은 1~1,000자로 입력해 주세요.')
  if (parentId !== null) {
    const { data: parent } = await supabase.from('post_comments').select('id,post_id,parent_id,deleted_at').eq('id', parentId).maybeSingle()
    if (!parent || parent.post_id !== postId) return apiError(400, 'INVALID_PARENT_COMMENT', '부모 댓글을 확인해 주세요.')
    if (parent.deleted_at) return apiError(400, 'INVALID_PARENT_COMMENT', '삭제된 댓글에는 답글을 작성할 수 없습니다.')
    if (parent.parent_id) return apiError(400, 'REPLY_DEPTH_EXCEEDED', '답글에는 다시 답글을 작성할 수 없습니다.')
  }
  const { data, error } = await supabase.from('post_comments').insert({ post_id: postId, author_id: session.user_id, parent_id: parentId, body, is_anonymous: anonymous }).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '댓글을 저장하지 못했습니다.')
  const { data: author } = await supabase.from('users').select('id,nickname').eq('id', session.user_id).single()
  return json({ data: commentJson(data, author!, session.user_id) }, 201)
}

const changeComment = async (request: Request, id: number, remove: boolean) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data: comment } = await supabase.from('post_comments').select('*').eq('id', id).maybeSingle()
  if (!comment) return apiError(404, 'NOT_FOUND', '댓글을 찾을 수 없습니다.')
  if (comment.author_id !== session.user_id) return apiError(403, 'FORBIDDEN', '댓글을 변경할 권한이 없습니다.')
  if (comment.deleted_at) return apiError(409, 'COMMENT_DELETED', '이미 삭제된 댓글은 변경할 수 없습니다.')
  if (remove) {
    const { count } = await supabase.from('post_comments').select('id', { count: 'exact', head: true }).eq('parent_id', id)
    const query = count
      ? supabase.from('post_comments').update({ body: '삭제된 댓글입니다.', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', id)
      : supabase.from('post_comments').delete().eq('id', id)
    const { error } = await query
    return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '댓글을 삭제하지 못했습니다.') : new Response(null, { status: 204, headers: corsHeaders })
  }
  const input = await request.json().catch(() => null)
  const body = typeof input?.body === 'string' ? input.body.trim() : ''
  if (!body || body.length > 1000) return apiError(400, 'VALIDATION_ERROR', '댓글은 1~1,000자로 입력해 주세요.')
  const { data, error } = await supabase.from('post_comments').update({ body, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '댓글을 수정하지 못했습니다.')
  const { data: author } = await supabase.from('users').select('id,nickname').eq('id', session.user_id).single()
  return json({ data: commentJson(data, author!, session.user_id) })
}

export const handlePostFeatureRoute = (request: Request, path: string, url: URL) => {
  const relation = path.match(/^\/posts\/(\d+)\/(like|bookmark)$/)
  if (relation && (request.method === 'POST' || request.method === 'DELETE')) return toggleRelation(request, Number(relation[1]), relation[2] === 'like' ? 'post_likes' : 'post_bookmarks', request.method === 'POST')
  const comments = path.match(/^\/posts\/(\d+)\/comments$/)
  if (comments && request.method === 'GET') return listComments(request, Number(comments[1]), url)
  if (comments && request.method === 'POST') return createComment(request, Number(comments[1]))
  const comment = path.match(/^\/comments\/(\d+)$/)
  if (comment && request.method === 'PATCH') return changeComment(request, Number(comment[1]), false)
  if (comment && request.method === 'DELETE') return changeComment(request, Number(comment[1]), true)
  return null
}
