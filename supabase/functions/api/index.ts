import { apiError, corsHeaders, getSession, json, requireCsrfSession, supabase } from './shared.ts'
import { handleAuthRoute } from './auth/auth.routes.ts'
import { handleSystemRoute } from './system/system.routes.ts'

const reservedSlugs = new Set(['api', 'login', 'signup', 'feed', 'post', 'blog', 'me', 'new'])
const slugPattern = /^[a-z0-9-]{3,30}$/

const blogJson = (blog: Record<string, any>, owner?: Record<string, any>) => ({
  id: blog.id,
  name: blog.name,
  slug: blog.slug,
  url: `/blog/${blog.slug}`,
  description: blog.description,
  ...(owner ? { owner: { id: owner.id, nickname: owner.nickname } } : {}),
  createdAt: blog.created_at,
  updatedAt: blog.updated_at,
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
  return json({ data: { slug, available: !data } })
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

  const { data: blog, error } = await supabase.from('blogs').select('*').eq('slug', slug).maybeSingle()
  if (error || !blog) return apiError(404, 'NOT_FOUND', '블로그를 찾을 수 없습니다.')
  const { data: owner } = await supabase.from('users').select('id, nickname').eq('id', blog.owner_id).single()
  const session = await getSession(request)
  const { data: subscription } = session?.user_id
    ? await supabase.from('subscriptions').select('blog_id').eq('user_id', session.user_id).eq('blog_id', blog.id).maybeSingle()
    : { data: null }
  const from = (page - 1) * size
  const to = from + size - 1
  const { data: posts, count, error: postsError } = await supabase
    .from('posts')
    .select('*', { count: 'exact' })
    .eq('blog_id', blog.id)
    .eq('status', 'PUBLISHED')
    .order('published_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
  if (postsError && postsError.code !== '42P01') {
    console.error('Failed to read blog posts', postsError)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const items = (posts ?? []).map((post: Record<string, any>) => ({
    id: post.id,
    url: `/post/${post.id}`,
    title: post.title,
    excerpt: post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content,
    status: post.status,
    viewCount: post.view_count,
    author: owner,
    blog: { id: blog.id, name: blog.name, slug: blog.slug },
    publishedAt: post.published_at,
    createdAt: post.created_at,
    updatedAt: post.updated_at,
  }))
  const totalItems = count ?? 0
  return json({ data: {
    blog: { ...blogJson(blog, owner ?? undefined), isSubscribed: Boolean(subscription) },
    posts: {
      items,
      pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 },
    },
  } })
}

const postJson = (post: Record<string, any>, includeContent = false) => ({
  id: post.id,
  url: `/post/${post.id}`,
  title: post.title,
  ...(includeContent ? { content: post.content } : {
    excerpt: post.content.length > 160 ? `${post.content.slice(0, 160)}…` : post.content,
  }),
  status: post.status,
  viewCount: post.view_count,
  author: { id: post.owner_id, nickname: post.author_nickname },
  blog: { id: post.blog_id, name: post.blog_name, slug: post.blog_slug },
  publishedAt: post.published_at,
  createdAt: post.created_at,
  updatedAt: post.updated_at,
})

const postInput = (body: Record<string, unknown>, partial = false) => {
  const fields: Record<string, string> = {}
  const result: Record<string, string> = {}
  const hasTitle = Object.prototype.hasOwnProperty.call(body, 'title')
  const hasContent = Object.prototype.hasOwnProperty.call(body, 'content')
  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')
  if (!partial || hasTitle) {
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title || title.length > 100) fields.title = '제목은 1~100자로 입력해 주세요.'
    else result.title = title
  }
  if (!partial || hasContent) {
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    if (!content || content.length > 20000) fields.content = '본문은 1~20,000자로 입력해 주세요.'
    else result.content = content
  }
  if (!partial || hasStatus) {
    const status = body.status === undefined && !partial ? 'DRAFT' : body.status
    if (status !== 'DRAFT' && status !== 'PUBLISHED') fields.status = '상태 값을 확인해 주세요.'
    else result.status = status
  }
  if (partial && !hasTitle && !hasContent && !hasStatus) fields.request = '수정할 값을 입력해 주세요.'
  return { fields, values: result }
}

const listPosts = async (request: Request, url: URL) => {
  const scope = url.searchParams.get('scope') ?? 'public'
  const sort = url.searchParams.get('sort') ?? 'latest'
  const page = positiveInteger(url.searchParams.get('page'), 1)
  const size = positiveInteger(url.searchParams.get('size'), 10, 50)
  const q = (url.searchParams.get('q') ?? '').trim()
  const requestedStatus = url.searchParams.get('status')
  if (!['public', 'mine', 'following'].includes(scope) || !['latest', 'popular'].includes(sort) || !page || !size) {
    return apiError(400, 'VALIDATION_ERROR', '목록 조건을 확인해 주세요.')
  }
  if (scope !== 'mine' && requestedStatus !== null) {
    return apiError(400, 'VALIDATION_ERROR', '공개 피드에는 status를 지정할 수 없습니다.')
  }

  let ownerId: number | null = null
  let status = 'PUBLISHED'
  let followedBlogIds: number[] = []
  if (scope === 'mine' || scope === 'following') {
    const session = await getSession(request)
    if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    ownerId = session.user_id
    if (scope === 'mine') {
      status = requestedStatus ?? 'ALL'
      if (!['ALL', 'DRAFT', 'PUBLISHED'].includes(status)) {
        return apiError(400, 'VALIDATION_ERROR', '글 상태를 확인해 주세요.')
      }
    } else {
      const { data, error } = await supabase.from('subscriptions').select('blog_id').eq('user_id', session.user_id)
      if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '구독 피드를 불러오지 못했습니다.')
      followedBlogIds = (data ?? []).map((item: { blog_id: number }) => item.blog_id)
      if (!followedBlogIds.length) {
        return json({ data: [], pagination: { page, size, totalItems: 0, totalPages: 0 } })
      }
    }
  }

  let query = supabase.from('post_details').select('*', { count: 'exact' })
  if (scope === 'public') query = query.eq('status', 'PUBLISHED')
  else if (scope === 'following') query = query.eq('status', 'PUBLISHED').in('blog_id', followedBlogIds)
  else query = query.eq('owner_id', ownerId!)
  if (scope === 'mine' && status !== 'ALL') query = query.eq('status', status)
  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%,author_nickname.ilike.%${safe}%,blog_name.ilike.%${safe}%`)
  }
  if (sort === 'popular') {
    query = query.order('view_count', { ascending: false })
    if (scope !== 'mine') query = query.order('published_at', { ascending: false })
  } else {
    query = query.order(scope === 'mine' ? 'updated_at' : 'published_at', { ascending: false })
  }
  query = query.order('id', { ascending: false })
  const from = (page - 1) * size
  const { data, count, error } = await query.range(from, from + size - 1)
  if (error) {
    console.error('Failed to list posts', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const totalItems = count ?? 0
  return json({
    data: (data ?? []).map((post: Record<string, any>) => postJson(post)),
    pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 },
  })
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
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '구독하지 못했습니다.')
    return json({ data: { subscribed: true } }, 201)
  }
  const { error } = await supabase.from('subscriptions').delete().eq('user_id', session.user_id).eq('blog_id', blog.id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '구독을 취소하지 못했습니다.')
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
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data: blog } = await supabase.from('blogs').select('id, name, slug').eq('owner_id', session.user_id).maybeSingle()
  if (!blog) return apiError(409, 'BLOG_REQUIRED', '먼저 블로그를 만들어 주세요.')
  const publishedAt = values.status === 'PUBLISHED' ? new Date().toISOString() : null
  const { data, error } = await supabase.from('posts').insert({
    blog_id: blog.id,
    title: values.title,
    content: values.content,
    status: values.status,
    published_at: publishedAt,
  }).select('*').single()
  if (error) {
    console.error('Failed to create post', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const { data: user } = await supabase.from('users').select('nickname').eq('id', session.user_id).single()
  return json({ data: postJson({
    ...data,
    blog_name: blog.name,
    blog_slug: blog.slug,
    owner_id: session.user_id,
    author_nickname: user?.nickname,
  }, true) }, 201)
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
  return json({ data: postJson(post, true) })
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
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = postInput(body as Record<string, unknown>, true)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const previous = ownership.data!
  let publishedAt = previous.published_at
  if (values.status === 'PUBLISHED' && previous.status === 'DRAFT') publishedAt = new Date().toISOString()
  if (values.status === 'DRAFT') publishedAt = null
  const { data, error } = await supabase.from('posts').update({
    ...values,
    published_at: publishedAt,
    updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return json({ data: postJson({ ...previous, ...data }, true) })
}

const deletePost = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedPost(session.user_id, id)
  if (ownership.error) return ownership.error
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
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

  const authResponse = handleAuthRoute(request, path)
  if (authResponse) return authResponse

  const systemResponse = handleSystemRoute(request, path)
  if (systemResponse) return systemResponse

  if (request.method === 'POST' && path === '/blogs') return createBlog(request)
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

  return apiError(404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.')
})
