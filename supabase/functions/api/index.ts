import { apiError, corsHeaders, getSession, getSessionHash, json, requireCsrfSession, supabase, supabaseUrl } from './shared.ts'
import { handleAuthRoute } from './auth/auth.routes.ts'
import { handleSystemRoute } from './system/system.routes.ts'
import { handleMarketRoute } from './market/market.routes.ts'
import { handleBlogManagementRoute } from './blog-management.ts'
import { enrichPosts, handlePostFeatureRoute, parseClassificationIds, replacePostClassifications, validateClassificationOwnership } from './post-features.ts'
import { handleHomeRoute } from './home.ts'
import { handleNotificationRoute } from './notifications.ts'
import { handleAiRoute, recordAiMissionActivity } from './ai.ts'
import { claimPostImages, handlePostImageRoute, purgePostImages, validateRichDocument } from './post-images.ts'
import { handleAdminRoute } from './admin/admin.routes.ts'

const reservedSlugs = new Set(['api', 'login', 'signup', 'feed', 'post', 'blog', 'me', 'new', 'manage', 'ai', 'admin', 'adminpage'])
const slugPattern = /^(?!.*--)[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/

const blogJson = (blog: Record<string, any>, owner?: Record<string, any>) => ({
  id: blog.id,
  name: blog.name,
  slug: blog.slug,
  url: `/blog/${blog.slug}`,
  description: blog.description,
  shopName: blog.shop_name,
  shopDescription: blog.shop_description,
  profileImageUrl: blog.profile_image_path ? `${supabaseUrl}/storage/v1/object/public/blog-profile-images/${blog.profile_image_path}` : null,
  ...(owner ? { owner: { id: owner.id, nickname: owner.nickname } } : {}),
  createdAt: blog.created_at,
  updatedAt: blog.updated_at,
  isOfficial: blog.slug === 'admin',
})

const validateSlug = (raw: string | null) => {
  const slug = (raw ?? '').trim().toLowerCase()
  return { slug, valid: slugPattern.test(slug) && !reservedSlugs.has(slug) }
}

const checkSlug = async (url: URL) => {
  const { slug, valid } = validateSlug(url.searchParams.get('slug'))
  if (!valid) {
    return apiError(400, 'VALIDATION_ERROR', '사용할 수 없는 블로그 주소입니다.', {
      slug: '영문 소문자, 숫자, 하이픈으로 3~30자를 입력해 주세요.',
    })
  }
  const { data, error } = await supabase.from('blogs').select('id').eq('slug', slug).maybeSingle()
  if (error) {
    console.error('Failed to check slug', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  return json({ data: { slug, url: `/blog/${slug}`, available: !data } })
}

const createBlog = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  }
  const input = body as Record<string, unknown>
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const description = typeof input.description === 'string' ? input.description.trim() : ''
  const { slug, valid: validSlug } = validateSlug(typeof input.slug === 'string' ? input.slug : '')
  const fields: Record<string, string> = {}
  if (name.length < 2 || name.length > 30) fields.name = '블로그 이름은 2~30자로 입력해 주세요.'
  if (!validSlug) fields.slug = '사용할 수 없는 블로그 주소입니다.'
  if (description.length > 160) fields.description = '블로그 소개는 160자 이하로 입력해 주세요.'
  if (Object.keys(fields).length) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  }

  const { data, error } = await supabase.from('blogs').insert({
    owner_id: session.user_id,
    name,
    slug,
    description,
  }).select('*').single()
  if (error) {
    if (error.code === '23505' && error.message.includes('owner')) {
      return apiError(409, 'BLOG_ALREADY_EXISTS', '이미 블로그를 보유하고 있습니다.')
    }
    if (error.code === '23505') {
      return apiError(409, 'SLUG_ALREADY_EXISTS', '이미 사용 중인 블로그 주소입니다.')
    }
    console.error('Failed to create blog', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const { data: owner } = await supabase.from('users').select('id, nickname').eq('id', session.user_id).single()
  return json({ data: blogJson(data, owner ?? undefined) }, 201)
}

const getMyBlog = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.from('blogs').select('*').eq('owner_id', session.user_id).maybeSingle()
  if (error) {
    console.error('Failed to read current blog', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  if (!data) return apiError(404, 'BLOG_NOT_FOUND', '블로그를 찾을 수 없습니다.')
  const { data: owner } = await supabase.from('users').select('id, nickname').eq('id', session.user_id).single()
  return json({ data: blogJson(data, owner ?? undefined) })
}

const listBlogs = async (url: URL) => {
  const page = positiveInteger(url.searchParams.get('page'), 1)
  const size = positiveInteger(url.searchParams.get('size'), 10, 50)
  const q = (url.searchParams.get('q') ?? '').trim()
  if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')

  let query = supabase.from('blogs').select('*', { count: 'exact' })
  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(`name.ilike.%${safe}%,description.ilike.%${safe}%,slug.ilike.%${safe}%`)
  }
  const from = (page - 1) * size
  const { data, count, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + size - 1)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '블로그를 불러오지 못했습니다.')
  const ownerIds = [...new Set((data ?? []).map((blog: Record<string, any>) => blog.owner_id))]
  const { data: owners } = ownerIds.length
    ? await supabase.from('users').select('id, nickname').in('id', ownerIds)
    : { data: [] }
  const ownerMap = new Map((owners ?? []).map((owner: Record<string, any>) => [owner.id, owner]))
  const totalItems = count ?? 0
  return json({
    data: (data ?? []).map((blog: Record<string, any>) => blogJson(blog, ownerMap.get(blog.owner_id))),
    pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 },
  })
}

const positiveInteger = (value: string | null, fallback: number, max?: number) => {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) return null
  return parsed
}

const getPublicBlog = async (request: Request, slugValue: string, url: URL) => {
  const { slug, valid } = validateSlug(decodeURIComponent(slugValue))
  if (!valid) return apiError(404, 'NOT_FOUND', '블로그를 찾을 수 없습니다.')
  const page = positiveInteger(url.searchParams.get('page'), 1)
  const size = positiveInteger(url.searchParams.get('size'), 10, 50)
  if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')

  const { data, error } = await supabase.rpc('get_public_blog_payload', {
    p_session_hash: await getSessionHash(request),
    p_slug: slug,
    p_page: page,
    p_size: size,
    p_storage_origin: supabaseUrl,
  })
  if (error) {
    console.error('Failed to read public blog payload', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const payload = data as { found?: boolean; data?: Record<string, unknown> } | null
  if (!payload?.found) return apiError(404, 'NOT_FOUND', '블로그를 찾을 수 없습니다.')
  return json({ data: payload.data })
}

const postJson = (post: Record<string, any>, includeContent = false) => ({
  id: post.id,
  url: `/post/${post.id}`,
  title: post.title,
  ...(includeContent ? { content: post.content, contentDocument: post.content_document ?? null } : {
    excerpt: post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content,
  }),
  status: post.status,
  category: post.category_id ? { id: post.category_id, name: post.category_name } : null,
  viewCount: post.view_count,
  author: { id: post.owner_id, nickname: post.author_nickname },
  blog: { id: post.blog_id, name: post.blog_name, slug: post.blog_slug },
  publishedAt: post.published_at,
  createdAt: post.created_at,
  updatedAt: post.updated_at,
  deletedAt: post.deleted_at,
  purgeAfter: post.purge_after,
})

const postInput = (body: Record<string, unknown>, partial = false) => {
  const fields: Record<string, string> = {}
  const result: Record<string, string | number | null> = {}
  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title')
  const hasContent = Object.prototype.hasOwnProperty.call(body, 'content')
  const hasContentText = Object.prototype.hasOwnProperty.call(body, 'contentText')
  const hasContentDocument = Object.prototype.hasOwnProperty.call(body, 'contentDocument')
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')
  const hasCategory = Object.prototype.hasOwnProperty.call(body, 'categoryId')
  if (!partial || hasTitle) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 100) fields.title = '제목은 1~100자로 입력해 주세요.'
    else result.title = title
  }
  if (!partial || hasContent || hasContentText || hasContentDocument) {
    const content = typeof body.contentText === 'string' ? body.contentText.trim() : typeof body.content === 'string' ? body.content.trim() : ''
    if (!content || content.length > 20000) fields.content = '본문은 1~20,000자로 입력해 주세요.'
    else result.content = content
    if (hasContentDocument) {
      const document = validateRichDocument(body.contentDocument)
      if (!document.valid) fields.contentDocument = '지원하지 않는 본문 형식이 포함되어 있습니다.'
      else (result as Record<string, unknown>).content_document = body.contentDocument
    }
  }
  if (!partial || hasStatus) {
    const status = body.status === undefined && !partial ? 'DRAFT' : body.status
    if (status !== 'DRAFT' && status !== 'PUBLISHED') fields.status = '상태 값을 확인해 주세요.'
    else result.status = status
  }
  if (hasCategory) {
    if (body.categoryId !== null && (!Number.isSafeInteger(body.categoryId) || Number(body.categoryId) < 1)) fields.categoryId = '카테고리를 확인해 주세요.'
    else result.category_id = body.categoryId as number | null
  }
  if (partial && !hasTitle && !hasContent && !hasContentText && !hasContentDocument && !hasStatus && !hasCategory) fields.request = '수정할 값을 입력해 주세요.'
  return { fields, values: result }
}

const listPosts = async (request: Request, url: URL) => {
  const scope = url.searchParams.get('scope') ?? 'public'
  const sort = url.searchParams.get('sort') ?? 'latest'
  const page = positiveInteger(url.searchParams.get('page'), 1)
  const size = positiveInteger(url.searchParams.get('size'), 10, 50)
  const q = (url.searchParams.get('q') ?? '').trim()
  const interest = (url.searchParams.get('interest') ?? '').trim()
  const requestedStatus = url.searchParams.get('status')
  const deleted = url.searchParams.get('deleted') ?? 'exclude'
  const categoryId = (url.searchParams.get('categoryId') ?? '').trim() || null
  if (!['public', 'mine', 'following', 'bookmarked'].includes(scope) || !['latest', 'popular'].includes(sort) || !['exclude', 'only'].includes(deleted) || !page || !size) {
    return apiError(400, 'VALIDATION_ERROR', '목록 조건을 확인해 주세요.')
  }
  if (scope !== 'mine' && requestedStatus !== null) {
    return apiError(400, 'VALIDATION_ERROR', '공개 피드에는 status를 지정할 수 없습니다.')
  }

  const status = scope === 'mine' ? requestedStatus ?? 'ALL' : 'PUBLISHED'
  if (scope === 'mine' && !['ALL', 'DRAFT', 'PUBLISHED'].includes(status)) {
    return apiError(400, 'VALIDATION_ERROR', '글 상태를 확인해 주세요.')
  }
  if (categoryId && categoryId !== 'uncategorized' && (!/^\d+$/.test(categoryId) || Number(categoryId) < 1)) {
    return apiError(400, 'VALIDATION_ERROR', '카테고리를 확인해 주세요.')
  }
  const { data, error } = await supabase.rpc('get_posts_payload_v2', {
    p_session_hash: await getSessionHash(request),
    p_scope: scope,
    p_sort: sort,
    p_page: page,
    p_size: size,
    p_query: q,
    p_interest: interest,
    p_status: status,
    p_deleted: deleted,
    p_category_id: categoryId,
  })
  if (error) {
    console.error('Failed to list posts', { code: error.code, details: error.details, scope, sort, page, size, hasQuery: Boolean(q), hasInterest: Boolean(interest) })
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const payload = data as { authenticated?: boolean; data?: unknown[]; pagination?: Record<string, unknown> } | null
  if (scope !== 'public' && !payload?.authenticated) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  return json({ data: payload?.data ?? [], pagination: payload?.pagination })
}

const changeSubscription = async (request: Request, slugValue: string, subscribe: boolean) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const slug = decodeURIComponent(slugValue).trim().toLowerCase()
  const { data: blog, error: blogError } = await supabase.from('blogs').select('id, owner_id').eq('slug', slug).maybeSingle()
  if (blogError || !blog) return apiError(404, 'BLOG_NOT_FOUND', '블로그를 찾을 수 없습니다.')
  if (blog.owner_id === session.user_id) return apiError(400, 'SELF_SUBSCRIPTION_NOT_ALLOWED', '내 블로그는 구독할 수 없습니다.')

  if (subscribe) {
    const { error } = await supabase.from('subscriptions').upsert({ user_id: session.user_id, blog_id: blog.id })
    if (error) {
      console.error('Failed to subscribe to blog', error)
      return apiError(500, 'INTERNAL_SERVER_ERROR', '구독하지 못했습니다.')
    }
    return json({ data: { subscribed: true } }, 201)
  }
  const { error } = await supabase.from('subscriptions').delete().eq('user_id', session.user_id).eq('blog_id', blog.id)
  if (error) {
    console.error('Failed to unsubscribe from blog', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '구독을 취소하지 못했습니다.')
  }
  return new Response(null, { status: 204, headers: corsHeaders })
}

const createPost = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  }
  const { fields, values } = postInput(body as Record<string, unknown>)
  const richDocument = Object.prototype.hasOwnProperty.call(body, 'contentDocument') ? validateRichDocument((body as Record<string, unknown>).contentDocument) : { valid: true, imageIds: [] as string[] }
  const draftKey = typeof (body as Record<string, unknown>).draftKey === 'string' ? String((body as Record<string, unknown>).draftKey) : ''
  if (richDocument.imageIds.length && !/^[0-9a-f-]{36}$/i.test(draftKey)) fields.draftKey = '이미지 초안 정보를 확인해 주세요.'
  const classificationInput = parseClassificationIds(body as Record<string, unknown>)
  if (classificationInput.error) fields.classificationIds = classificationInput.error
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data: blog } = await supabase.from('blogs').select('id, name, slug').eq('owner_id', session.user_id).maybeSingle()
  if (!blog) return apiError(409, 'BLOG_REQUIRED', '먼저 블로그를 만들어 주세요.')
  if (!values.category_id) {
    const { data: defaultCategory, error: defaultCategoryError } = await supabase.from('blog_categories').select('id').eq('blog_id', blog.id).eq('is_default', true).maybeSingle()
    if (defaultCategoryError || !defaultCategory) return apiError(500, 'DEFAULT_CATEGORY_MISSING', '기본 카테고리를 불러오지 못했습니다.')
    values.category_id = defaultCategory.id
  }
  const publishedAt = values.status === 'PUBLISHED' ? new Date().toISOString() : null
  if (values.category_id) {
    const { data: category } = await supabase.from('blog_categories').select('id').eq('id', values.category_id).eq('blog_id', blog.id).maybeSingle()
    if (!category) return apiError(400, 'VALIDATION_ERROR', '현재 블로그의 카테고리를 선택해 주세요.', { categoryId: '유효하지 않은 카테고리입니다.' })
  }
  const classificationValidation = await validateClassificationOwnership(blog.id, classificationInput.ids)
  if (classificationValidation.error) {
    return apiError(400, 'VALIDATION_ERROR', classificationValidation.error, { classificationIds: classificationValidation.error })
  }
  const { data, error } = await supabase.from('posts').insert({
    blog_id: blog.id,
    title: values.title,
    content: values.content,
    status: values.status,
    published_at: publishedAt,
    category_id: values.category_id ?? null,
  }).select('*').single()
  if (error) {
    console.error('Failed to create post', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const classificationResult = await replacePostClassifications(data.id, blog.id, classificationInput.ids)
  if (classificationResult.error) {
    await supabase.from('posts').delete().eq('id', data.id)
    return apiError(400, 'VALIDATION_ERROR', classificationResult.error, { classificationIds: classificationResult.error })
  }
  const imageResult = await claimPostImages(session.user_id, data.id, draftKey, richDocument.imageIds)
  if (imageResult.error) {
    await supabase.from('posts').delete().eq('id', data.id)
    return apiError(400, 'VALIDATION_ERROR', imageResult.error, { contentDocument: imageResult.error })
  }
  const { data: user } = await supabase.from('users').select('nickname').eq('id', session.user_id).single()
  const [created] = await enrichPosts(request, [postJson({
    ...data,
    blog_name: blog.name,
    blog_slug: blog.slug,
    owner_id: session.user_id,
    author_nickname: user?.nickname,
  }, true)])
  const { data: interestClassifications } = classificationInput.ids.length
    ? await supabase.from('blog_classifications').select('id').eq('source', 'INTEREST').in('id', classificationInput.ids)
    : { data: [] }
  await recordAiMissionActivity(session.user_id, 'POST_SAVED', {
    status: values.status,
    titleLength: String(values.title ?? '').trim().length,
    contentLength: String(values.content ?? '').trim().length,
    interestClassificationCount: interestClassifications?.length ?? 0,
  })
  return json({ data: created }, 201)
}

const readPost = async (request: Request, id: number) => {
  const session = await getSession(request)
  const { data, error } = await supabase.rpc('read_post', {
    p_post_id: id,
    p_request_user_id: session?.user_id ?? null,
  })
  if (error) {
    console.error('Failed to read post', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const post = data?.[0]
  if (!post) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const [result] = await enrichPosts(request, [postJson(post, true)])
  return json({ data: result })
}

const ownedPost = async (userId: number, id: number) => {
  const { data, error } = await supabase.from('post_details').select('*').eq('id', id).maybeSingle()
  if (error) return { error: apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.') }
  if (!data) return { error: apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.') }
  if (data.owner_id !== userId) return { error: apiError(403, 'FORBIDDEN', '글을 수정하거나 삭제할 권한이 없습니다.') }
  return { data }
}

const updatePost = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedPost(session.user_id, id)
  if (ownership.error) return ownership.error
  if (ownership.data!.deleted_at) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = postInput(body as Record<string, unknown>, true)
  const hasDocument = Object.prototype.hasOwnProperty.call(body, 'contentDocument')
  const richDocument = hasDocument ? validateRichDocument((body as Record<string, unknown>).contentDocument) : { valid: true, imageIds: [] as string[] }
  const draftKey = typeof (body as Record<string, unknown>).draftKey === 'string' ? String((body as Record<string, unknown>).draftKey) : ''
  if (hasDocument && richDocument.imageIds.length && !/^[0-9a-f-]{36}$/i.test(draftKey)) fields.draftKey = '이미지 초안 정보를 확인해 주세요.'
  const classificationInput = parseClassificationIds(body as Record<string, unknown>)
  if (classificationInput.present) delete fields.request
  if (classificationInput.error) fields.classificationIds = classificationInput.error
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const previous = ownership.data!
  if (Object.prototype.hasOwnProperty.call(values, 'category_id') && !values.category_id) {
    const { data: defaultCategory, error: defaultCategoryError } = await supabase.from('blog_categories').select('id').eq('blog_id', previous.blog_id).eq('is_default', true).maybeSingle()
    if (defaultCategoryError || !defaultCategory) return apiError(500, 'DEFAULT_CATEGORY_MISSING', '기본 카테고리를 불러오지 못했습니다.')
    values.category_id = defaultCategory.id
  }
  if (values.category_id) {
    const { data: category } = await supabase.from('blog_categories').select('id').eq('id', values.category_id).eq('blog_id', previous.blog_id).maybeSingle()
    if (!category) return apiError(400, 'VALIDATION_ERROR', '현재 블로그의 카테고리를 선택해 주세요.', { categoryId: '유효하지 않은 카테고리입니다.' })
  }
  if (classificationInput.present) {
    const classificationValidation = await validateClassificationOwnership(previous.blog_id, classificationInput.ids)
    if (classificationValidation.error) {
      return apiError(400, 'VALIDATION_ERROR', classificationValidation.error, { classificationIds: classificationValidation.error })
    }
  }
  if (hasDocument) {
    const imageResult = await claimPostImages(session.user_id, id, draftKey, richDocument.imageIds)
    if (imageResult.error) return apiError(400, 'VALIDATION_ERROR', imageResult.error, { contentDocument: imageResult.error })
  }
  let publishedAt = previous.published_at
  if (values.status === 'PUBLISHED' && previous.status === 'DRAFT') publishedAt = new Date().toISOString()
  if (values.status === 'DRAFT') publishedAt = null
  const { data, error } = await supabase.from('posts').update({
    ...values,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  if (classificationInput.present) {
    const result = await replacePostClassifications(id, previous.blog_id, classificationInput.ids)
    if (result.error) return apiError(400, 'VALIDATION_ERROR', result.error, { classificationIds: result.error })
  }
  const [updated] = await enrichPosts(request, [postJson({ ...previous, ...data }, true)])
  const activeClassificationIds = classificationInput.present
    ? classificationInput.ids
    : ((await supabase.from('post_classifications').select('classification_id').eq('post_id', id)).data ?? []).map((item: Record<string, any>) => item.classification_id)
  const { data: interestClassifications } = activeClassificationIds.length
    ? await supabase.from('blog_classifications').select('id').eq('source', 'INTEREST').in('id', activeClassificationIds)
    : { data: [] }
  await recordAiMissionActivity(session.user_id, 'POST_SAVED', {
    status: data.status,
    titleLength: String(data.title ?? '').trim().length,
    contentLength: String(data.content ?? '').trim().length,
    interestClassificationCount: interestClassifications?.length ?? 0,
  })
  return json({ data: updated })
}

const deletePost = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedPost(session.user_id, id)
  if (ownership.error) return ownership.error
  const now = new Date(); const purgeAfter = new Date(now.getTime() + 30 * 86400000)
  const { error } = await supabase.from('posts').update({ deleted_at: now.toISOString(), purge_after: purgeAfter.toISOString(), updated_at: now.toISOString() }).eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}

const restorePost = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const ownership = await ownedPost(session.user_id, id)
  if (ownership.error) return ownership.error
  if (!ownership.data!.deleted_at || !ownership.data!.purge_after) return apiError(409, 'NOT_IN_TRASH', '복원할 수 있는 휴지통 글이 아닙니다.')
  const { error } = await supabase.from('posts').update({ deleted_at: null, purge_after: null, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 복원하지 못했습니다.')
  return json({ data: { restored: true } })
}

const permanentlyDeletePost = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const ownership = await ownedPost(session.user_id, id)
  if (ownership.error) return ownership.error
  if (!ownership.data!.deleted_at) return apiError(409, 'NOT_IN_TRASH', '휴지통에 있는 글만 영구 삭제할 수 있습니다.')
  await purgePostImages(id)
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 영구 삭제하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const path = url.pathname
    .replace(/^\/functions\/v1\/api/, '')
    .replace(/^\/api(?=\/|$)/, '') || '/'

  if (Deno.env.get('MAINTENANCE_MODE') === 'true' && !['GET', 'HEAD'].includes(request.method)) {
    return apiError(503, 'MAINTENANCE', '데이터 이전을 위해 잠시 점검 중입니다.', undefined)
  }

  const authResponse = handleAuthRoute(request, path)
  if (authResponse) return authResponse

  const adminResponse = handleAdminRoute(request, path, url)
  if (adminResponse) return adminResponse

  const systemResponse = handleSystemRoute(request, path)
  if (systemResponse) return systemResponse

  const marketResponse = handleMarketRoute(request, path, url)
  if (marketResponse) return marketResponse

  const managementResponse = handleBlogManagementRoute(request, path)
  if (managementResponse) return managementResponse

  const notificationResponse = handleNotificationRoute(request, path, url)
  if (notificationResponse) return notificationResponse

  const aiResponse = handleAiRoute(request, path)
  if (aiResponse) return aiResponse

  const homeResponse = handleHomeRoute(request, path)
  if (homeResponse) return homeResponse

  const postImageResponse = handlePostImageRoute(request, path)
  if (postImageResponse) return postImageResponse

  const featureResponse = handlePostFeatureRoute(request, path, url)
  if (featureResponse) return featureResponse

  if (request.method === 'POST' && path === '/blogs') return createBlog(request)
  if (request.method === 'GET' && path === '/blogs') return listBlogs(url)
  if (request.method === 'GET' && path === '/blogs/check-slug') return checkSlug(url)
  if (request.method === 'GET' && path === '/blogs/me') return getMyBlog(request)
  const blogMatch = path.match(/^\/blogs\/([^/]+)$/)
  if (request.method === 'GET' && blogMatch) return getPublicBlog(request, blogMatch[1], url)
  const subscriptionMatch = path.match(/^\/blogs\/([^/]+)\/subscription$/)
  if (subscriptionMatch && request.method === 'POST') return changeSubscription(request, subscriptionMatch[1], true)
  if (subscriptionMatch && request.method === 'DELETE') return changeSubscription(request, subscriptionMatch[1], false)
  if (request.method === 'GET' && path === '/posts') return listPosts(request, url)
  if (request.method === 'POST' && path === '/posts') return createPost(request)
  const postMatch = path.match(/^\/posts\/(\d+)$/)
  if (postMatch) {
    const postId = Number(postMatch[1])
    if (!Number.isSafeInteger(postId) || postId < 1) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
    if (request.method === 'GET') return readPost(request, postId)
    if (request.method === 'PATCH') return updatePost(request, postId)
    if (request.method === 'DELETE') return deletePost(request, postId)
  }
  const postRestoreMatch = path.match(/^\/posts\/(\d+)\/restore$/)
  if (postRestoreMatch && request.method === 'POST') return restorePost(request, Number(postRestoreMatch[1]))
  const postPermanentMatch = path.match(/^\/posts\/(\d+)\/permanent$/)
  if (postPermanentMatch && request.method === 'DELETE') return permanentlyDeletePost(request, Number(postPermanentMatch[1]))

  return apiError(404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.')
})
