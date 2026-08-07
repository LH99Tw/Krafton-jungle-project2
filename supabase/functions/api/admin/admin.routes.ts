import bcrypt from 'npm:bcryptjs@3.0.2'
import {
  apiError, corsHeaders, getSession, json, randomToken, requireCsrfSession, sessionCookie, sha256, supabase, supabaseUrl,
} from '../shared.ts'
import { rotateUserSession } from '../auth/auth.repository.ts'
import { claimPostImages, purgePostImages, validateRichDocument } from '../post-images.ts'

type AdminContext = { id: number; passwordHash: string; sessionHash: string }
const metrics = ['PUBLISHED_POSTS', 'MARKET_LISTINGS', 'COMPLETED_TRADES', 'NEW_USERS', 'WITHDRAWN_USERS'] as const
type Metric = typeof metrics[number]

const positive = (value: string | null, fallback: number, max = 100) => {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null
}
const pageJson = (page: number, size: number, totalItems: number) => ({ page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 })
const safeSearch = (value: string) => value.replaceAll(',', ' ').replaceAll('%', '').trim()

const requireAdmin = async (request: Request, csrf = false): Promise<{ admin?: AdminContext; error?: Response }> => {
  const session = csrf ? await requireCsrfSession(request) : await getSession(request)
  if (!session?.user_id) return { error: apiError(session ? 401 : (csrf ? 403 : 401), session ? 'UNAUTHENTICATED' : (csrf ? 'CSRF_TOKEN_INVALID' : 'UNAUTHENTICATED'), session ? '관리자 로그인이 필요합니다.' : (csrf ? 'CSRF 토큰이 유효하지 않습니다.' : '관리자 로그인이 필요합니다.')) }
  const { data } = await supabase.from('users').select('id,role,password_hash,account_status').eq('id', session.user_id).maybeSingle()
  if (!data || data.role !== 'ADMIN' || data.account_status !== 'ACTIVE') return { error: apiError(403, 'FORBIDDEN', '관리자 권한이 필요합니다.') }
  return { admin: { id: data.id, passwordHash: data.password_hash, sessionHash: session.sessionHash } }
}

const audit = async (adminId: number, action: string, targetType: string, targetId: string | number, before?: unknown, after?: unknown, reason?: string) => {
  const { error } = await supabase.from('admin_audit_logs').insert({
    admin_user_id: adminId, action, target_type: targetType, target_id: String(targetId),
    before_value: before ?? null, after_value: after ?? null, reason: reason?.trim() || null,
  })
  if (error) console.error('Failed to write admin audit log', error)
}

const verifyAdminPassword = async (admin: AdminContext, body: Record<string, unknown>) => {
  const password = typeof body.adminPassword === 'string' ? body.adminPassword : ''
  return password && await bcrypt.compare(password, admin.passwordHash)
}

const syncNoticeEvent = async (postId: number) => {
  const { data: post } = await supabase.from('post_details').select('id,title,content,status,published_at,deleted_at,blog_slug,is_event,event_title,event_description,event_cta_label').eq('id', postId).maybeSingle()
  if (!post || post.blog_slug !== 'admin' || post.status !== 'PUBLISHED' || post.deleted_at || !post.is_event) {
    await supabase.from('home_banners').delete().eq('post_id', postId)
    return
  }
  const values = { post_id: post.id, eyebrow: 'NOTICE · EVENT', title: post.event_title || post.title, description: post.event_description || String(post.content ?? '').replace(/\s+/g, ' ').slice(0, 240), cta_label: post.event_cta_label || '자세히 보기', cta_url: `/notice/${post.id}`, starts_at: post.published_at ?? new Date().toISOString(), ends_at: null, position: 0, is_active: true, updated_at: new Date().toISOString() }
  const { error } = await supabase.from('home_banners').upsert(values, { onConflict: 'post_id' })
  if (error) throw error
}

const adminLogin = async (request: Request) => {
  const csrfSession = await requireCsrfSession(request)
  if (!csrfSession) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const loginId = typeof body?.loginId === 'string' ? body.loginId.trim().toLowerCase() : ''
  const password = typeof body?.password === 'string' ? body.password : ''
  if (!loginId || !password) return apiError(400, 'VALIDATION_ERROR', '아이디와 비밀번호를 입력해 주세요.')
  const { data: user } = await supabase.from('users').select('id,login_id,nickname,password_hash,role,account_status').eq('login_id', loginId).maybeSingle()
  if (!user || user.role !== 'ADMIN' || user.account_status !== 'ACTIVE' || !(await bcrypt.compare(password, user.password_hash))) {
    return apiError(401, 'INVALID_CREDENTIALS', '관리자 아이디 또는 비밀번호가 올바르지 않습니다.')
  }
  const nextSessionId = randomToken()
  const { error } = await rotateUserSession({ userId: user.id, oldSessionHash: csrfSession.sessionHash, newSessionHash: await sha256(nextSessionId), csrfToken: request.headers.get('x-csrf-token')! })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '관리자 세션을 만들지 못했습니다.')
  return json({ data: { admin: { id: user.id, loginId: user.login_id, nickname: user.nickname } } }, 200, { 'Set-Cookie': sessionCookie(nextSessionId) })
}

const adminMe = async (request: Request) => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const { data } = await supabase.from('users').select('id,login_id,nickname').eq('id', auth.admin!.id).maybeSingle()
  if (!data) return apiError(401, 'UNAUTHENTICATED', '관리자 세션을 확인할 수 없습니다.')
  return json({ data: { admin: { id: data.id, loginId: data.login_id, nickname: data.nickname } } })
}

const kstDay = (value: string) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const dashboard = async (request: Request, url: URL) => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const requested = [...new Set((url.searchParams.get('metrics') ?? 'PUBLISHED_POSTS').split(',').filter((item): item is Metric => metrics.includes(item as Metric)))]
  if (!requested.length) return apiError(400, 'VALIDATION_ERROR', '지표를 하나 이상 선택해 주세요.')
  const endDay = kstDay(new Date().toISOString())
  const end = new Date(`${endDay}T00:00:00+09:00`)
  const start = new Date(end.getTime() - 29 * 86400000)
  const queries: Record<Metric, PromiseLike<any>> = {
    PUBLISHED_POSTS: supabase.from('posts').select('published_at').eq('status', 'PUBLISHED').gte('published_at', start.toISOString()),
    MARKET_LISTINGS: supabase.from('market_items').select('created_at').gte('created_at', start.toISOString()),
    COMPLETED_TRADES: supabase.from('market_orders').select('paid_at').in('status', ['PAID', 'COMPLETED']).gte('paid_at', start.toISOString()),
    NEW_USERS: supabase.from('users').select('created_at').neq('role', 'ADMIN').gte('created_at', start.toISOString()),
    WITHDRAWN_USERS: supabase.from('users').select('withdrawn_at').eq('account_status', 'WITHDRAWN').gte('withdrawn_at', start.toISOString()),
  }
  const dates = Array.from({ length: 30 }, (_, index) => kstDay(new Date(start.getTime() + index * 86400000).toISOString()))
  const series = await Promise.all(requested.map(async (metric) => {
    const { data, error } = await queries[metric]
    if (error) throw error
    const field = metric === 'PUBLISHED_POSTS' ? 'published_at' : metric === 'COMPLETED_TRADES' ? 'paid_at' : metric === 'WITHDRAWN_USERS' ? 'withdrawn_at' : 'created_at'
    const counts = new Map<string, number>()
    for (const row of data ?? []) if (row[field]) counts.set(kstDay(row[field]), (counts.get(kstDay(row[field])) ?? 0) + 1)
    return { metric, points: dates.map((date) => ({ date, value: counts.get(date) ?? 0 })) }
  })).catch((error) => { console.error('Admin dashboard failed', error); return null })
  return series ? json({ data: { startDate: dates[0], endDate: dates.at(-1), series } }) : apiError(500, 'INTERNAL_SERVER_ERROR', '요약 지표를 불러오지 못했습니다.')
}

const dashboardDetails = async (request: Request, url: URL) => {
  const auth = await requireAdmin(request)
  if (auth.error) return auth.error
  const metric = url.searchParams.get('metric') as Metric
  const page = positive(url.searchParams.get('page'), 1); const size = positive(url.searchParams.get('size'), 20, 50)
  if (!metrics.includes(metric) || !page || !size) return apiError(400, 'VALIDATION_ERROR', '상세 조회 조건을 확인해 주세요.')
  const q = safeSearch(url.searchParams.get('q') ?? ''); const from = (page - 1) * size
  let query: any
  if (metric === 'PUBLISHED_POSTS') {
    query = supabase.from('post_details').select('*', { count: 'exact' }).eq('status', 'PUBLISHED').is('deleted_at', null)
    if (q) query = query.or(`title.ilike.%${q}%,author_nickname.ilike.%${q}%,blog_name.ilike.%${q}%`)
    query = query.order('published_at', { ascending: false })
  } else if (metric === 'MARKET_LISTINGS') {
    query = supabase.from('market_item_details').select('*', { count: 'exact' }).is('deleted_at', null)
    if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`)
    query = query.order('created_at', { ascending: false })
  } else if (metric === 'COMPLETED_TRADES') {
    query = supabase.from('market_orders').select('*', { count: 'exact' }).in('status', ['PAID', 'COMPLETED'])
    if (q && /^\d+$/.test(q)) query = query.or(`id.eq.${q},item_id.eq.${q},buyer_id.eq.${q},seller_id.eq.${q}`)
    query = query.order('paid_at', { ascending: false })
  } else {
    query = supabase.from('users').select('id,email,nickname,account_status,created_at,withdrawn_at', { count: 'exact' }).neq('role', 'ADMIN')
    if (metric === 'WITHDRAWN_USERS') query = query.eq('account_status', 'WITHDRAWN').order('withdrawn_at', { ascending: false })
    else query = query.order('created_at', { ascending: false })
    if (q) query = query.or(`email.ilike.%${q}%,nickname.ilike.%${q}%`)
  }
  const { data, count, error } = await query.range(from, from + size - 1)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '상세 목록을 불러오지 못했습니다.') : json({ data: data ?? [], pagination: pageJson(page, size, count ?? 0) })
}

const listPosts = async (request: Request, url: URL, notices = false) => {
  const auth = await requireAdmin(request); if (auth.error) return auth.error
  const page = positive(url.searchParams.get('page'), 1); const size = positive(url.searchParams.get('size'), 20, 50)
  if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')
  const q = safeSearch(url.searchParams.get('q') ?? ''); const deleted = url.searchParams.get('deleted') ?? 'exclude'; const status = url.searchParams.get('status') ?? 'ALL'
  let query: any = supabase.from('post_details').select('*', { count: 'exact' })
  if (notices) {
    const { data: blog } = await supabase.from('blogs').select('id').eq('slug', 'admin').maybeSingle()
    if (!blog) return apiError(500, 'ADMIN_BLOG_MISSING', '관리자 블로그가 준비되지 않았습니다.')
    query = query.eq('blog_id', blog.id)
  }
  query = deleted === 'only' ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (status !== 'ALL') query = query.eq('status', status)
  if (q) query = query.or(`title.ilike.%${q}%,author_nickname.ilike.%${q}%,blog_name.ilike.%${q}%`)
  const from = (page - 1) * size; const { data, count, error } = await query.order('updated_at', { ascending: false }).range(from, from + size - 1)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '글을 불러오지 못했습니다.') : json({ data: data ?? [], pagination: pageJson(page, size, count ?? 0) })
}

const createNotice = async (request: Request) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const body = await request.json().catch(() => null) as Record<string, unknown> | null
  const title = typeof body?.title === 'string' ? body.title.trim() : ''; const content = typeof body?.contentText === 'string' ? body.contentText.trim() : typeof body?.content === 'string' ? body.content.trim() : ''
  const status = body?.status === 'PUBLISHED' ? 'PUBLISHED' : 'DRAFT'
  const isEvent = body?.isEvent === true
  const eventTitle = typeof body?.eventTitle === 'string' ? body.eventTitle.trim() : ''
  const eventDescription = typeof body?.eventDescription === 'string' ? body.eventDescription.trim() : ''
  const eventCtaLabel = typeof body?.eventCtaLabel === 'string' ? body.eventCtaLabel.trim() : ''
  if (!title || title.length > 100 || !content || content.length > 20000) return apiError(400, 'VALIDATION_ERROR', '제목과 본문을 확인해 주세요.')
  if (isEvent && (!eventTitle || eventTitle.length > 120 || !eventDescription || eventDescription.length > 300 || !eventCtaLabel || eventCtaLabel.length > 40)) return apiError(400, 'VALIDATION_ERROR', '이벤트 제목, 설명, 버튼 문구를 확인해 주세요.')
  const document = validateRichDocument(body?.contentDocument)
  if (!document.valid) return apiError(400, 'VALIDATION_ERROR', '본문 문서 형식을 확인해 주세요.')
  const draftKey = typeof body?.draftKey === 'string' && /^[0-9a-f-]{36}$/i.test(body.draftKey) ? body.draftKey : ''
  if (document.imageIds.length && !draftKey) return apiError(400, 'VALIDATION_ERROR', '이미지 초안 정보를 확인해 주세요.')
  const { data: blog } = await supabase.from('blogs').select('id').eq('slug', 'admin').maybeSingle()
  if (!blog) return apiError(500, 'ADMIN_BLOG_MISSING', '관리자 블로그가 준비되지 않았습니다.')
  const { data: category } = await supabase.from('blog_categories').select('id').eq('blog_id', blog.id).eq('is_default', true).maybeSingle()
  const { data, error } = await supabase.from('posts').insert({ blog_id: blog.id, category_id: category?.id ?? null, title, content, content_document: body?.contentDocument ?? null, is_event: isEvent, event_title: isEvent ? eventTitle : null, event_description: isEvent ? eventDescription : null, event_cta_label: isEvent ? eventCtaLabel : null, status, published_at: status === 'PUBLISHED' ? new Date().toISOString() : null }).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '공지 글을 저장하지 못했습니다.')
  if (document.imageIds.length) { const claimed = await claimPostImages(auth.admin!.id, data.id, draftKey, document.imageIds); if (claimed.error) { await supabase.from('posts').delete().eq('id', data.id); return apiError(400, 'VALIDATION_ERROR', claimed.error) } }
  try { await syncNoticeEvent(data.id) } catch (error) { console.error('Failed to sync notice event', error); return apiError(500, 'INTERNAL_SERVER_ERROR', '이벤트 배너를 연결하지 못했습니다.') }
  await audit(auth.admin!.id, 'CREATE_NOTICE', 'post', data.id, null, data)
  return json({ data }, 201)
}

const uploadPostImage = async (request: Request, postId: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: post } = await supabase.from('post_details').select('id,owner_id').eq('id', postId).is('deleted_at', null).maybeSingle()
  if (!post) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const form = await request.formData().catch(() => null); const file = form?.get('file'); const width = Number(form?.get('width')); const height = Number(form?.get('height'))
  if (!(file instanceof File) || file.type !== 'image/webp' || file.size < 16 || file.size > 2 * 1024 * 1024 || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) return apiError(400, 'INVALID_POST_IMAGE', '2MB 이하의 유효한 WebP 이미지를 업로드해 주세요.')
  const { count } = await supabase.from('post_images').select('id', { count: 'exact', head: true }).eq('post_id', postId)
  if ((count ?? 0) >= 5) return apiError(409, 'POST_IMAGE_LIMIT', '글에는 이미지를 최대 5장까지 넣을 수 있습니다.')
  const bytes = new Uint8Array(await file.arrayBuffer()); const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return apiError(400, 'INVALID_POST_IMAGE', '유효한 WebP 파일이 아닙니다.')
  const id = crypto.randomUUID(); const draftKey = crypto.randomUUID(); const storagePath = `${post.owner_id}/${draftKey}/${id}.webp`
  const { error: uploadError } = await supabase.storage.from('post-images').upload(storagePath, bytes, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (uploadError) return apiError(500, 'POST_IMAGE_UPLOAD_FAILED', '이미지를 업로드하지 못했습니다.')
  const { error } = await supabase.from('post_images').insert({ id, owner_id: post.owner_id, post_id: postId, draft_key: draftKey, storage_path: storagePath, width, height, byte_size: file.size })
  if (error) { await supabase.storage.from('post-images').remove([storagePath]); return apiError(500, 'POST_IMAGE_UPLOAD_FAILED', '이미지를 저장하지 못했습니다.') }
  await audit(auth.admin!.id, 'UPLOAD_POST_IMAGE', 'post', postId, null, { imageId: id })
  return json({ data: { id, url: `${supabaseUrl}/storage/v1/object/public/post-images/${storagePath}`, width, height } }, 201)
}

const updatePost = async (request: Request, id: number, noticeOnly = false) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('post_details').select('*').eq('id', id).maybeSingle()
  if (!before || (noticeOnly && before.blog_slug !== 'admin')) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  if (before.deleted_at) return apiError(409, 'IN_TRASH', '휴지통의 글은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return apiError(400, 'VALIDATION_ERROR', '수정 값을 입력해 주세요.')
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('title' in body) { const title = typeof body.title === 'string' ? body.title.trim() : ''; if (!title || title.length > 100) return apiError(400, 'VALIDATION_ERROR', '제목을 확인해 주세요.'); values.title = title }
  if ('contentText' in body || 'content' in body) { const raw = 'contentText' in body ? body.contentText : body.content; const content = typeof raw === 'string' ? raw.trim() : ''; if (!content || content.length > 20000) return apiError(400, 'VALIDATION_ERROR', '본문을 확인해 주세요.'); values.content = content }
  if ('contentDocument' in body) {
    const document = validateRichDocument(body.contentDocument)
    if (!document.valid) return apiError(400, 'VALIDATION_ERROR', '본문 문서 형식을 확인해 주세요.')
    if (document.imageIds.length && noticeOnly) { const draftKey = typeof body.draftKey === 'string' ? body.draftKey : ''; const claimed = await claimPostImages(before.owner_id, id, draftKey, document.imageIds); if (claimed.error) return apiError(400, 'VALIDATION_ERROR', claimed.error) }
    else if (document.imageIds.length) { const { data: images } = await supabase.from('post_images').select('id').eq('post_id', id).in('id', document.imageIds); if ((images ?? []).length !== document.imageIds.length) return apiError(400, 'VALIDATION_ERROR', '현재 글에 연결된 이미지만 사용할 수 있습니다.') }
    values.content_document = body.contentDocument
  }
  if (noticeOnly && 'isEvent' in body) {
    const isEvent = body.isEvent === true; values.is_event = isEvent
    if (isEvent) {
      const eventTitle = typeof body.eventTitle === 'string' ? body.eventTitle.trim() : ''; const eventDescription = typeof body.eventDescription === 'string' ? body.eventDescription.trim() : ''; const eventCtaLabel = typeof body.eventCtaLabel === 'string' ? body.eventCtaLabel.trim() : ''
      if (!eventTitle || eventTitle.length > 120 || !eventDescription || eventDescription.length > 300 || !eventCtaLabel || eventCtaLabel.length > 40) return apiError(400, 'VALIDATION_ERROR', '이벤트 제목, 설명, 버튼 문구를 확인해 주세요.')
      values.event_title = eventTitle; values.event_description = eventDescription; values.event_cta_label = eventCtaLabel
    } else { values.event_title = null; values.event_description = null; values.event_cta_label = null }
  }
  if ('categoryId' in body) {
    if (body.categoryId !== null && (!Number.isSafeInteger(body.categoryId) || Number(body.categoryId) < 1)) return apiError(400, 'VALIDATION_ERROR', '카테고리를 확인해 주세요.')
    if (body.categoryId !== null) {
      const { data: category } = await supabase.from('blog_categories').select('id').eq('id', body.categoryId).eq('blog_id', before.blog_id).maybeSingle()
      if (!category) return apiError(400, 'VALIDATION_ERROR', '해당 블로그의 카테고리만 선택할 수 있습니다.')
    }
    values.category_id = body.categoryId
  }
  if ('status' in body) {
    if (!['DRAFT', 'PUBLISHED'].includes(String(body.status))) return apiError(400, 'VALIDATION_ERROR', '상태를 확인해 주세요.')
    values.status = body.status; values.published_at = body.status === 'PUBLISHED' ? before.published_at ?? new Date().toISOString() : null
  }
  let classificationIds: number[] | null = null
  if ('classificationIds' in body) {
    const ids = Array.isArray(body.classificationIds) ? body.classificationIds.filter((item): item is number => Number.isSafeInteger(item) && Number(item) > 0) : []
    if (!Array.isArray(body.classificationIds) || ids.length !== body.classificationIds.length || ids.length > 5 || new Set(ids).size !== ids.length) return apiError(400, 'VALIDATION_ERROR', '분류는 중복 없이 최대 5개까지 선택해 주세요.')
    if (ids.length) {
      const { data: owned } = await supabase.from('blog_classifications').select('id').eq('blog_id', before.blog_id).in('id', ids)
      if ((owned ?? []).length !== ids.length) return apiError(400, 'VALIDATION_ERROR', '해당 블로그의 분류만 선택할 수 있습니다.')
    }
    classificationIds = ids
  }
  const { data, error } = await supabase.from('posts').update(values).eq('id', id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 수정하지 못했습니다.')
  if (classificationIds) {
    await supabase.from('post_classifications').delete().eq('post_id', id)
    if (classificationIds.length) await supabase.from('post_classifications').insert(classificationIds.map((classificationId, position) => ({ post_id: id, classification_id: classificationId, position })))
  }
  await audit(auth.admin!.id, noticeOnly ? 'UPDATE_NOTICE' : 'UPDATE_POST', 'post', id, before, data)
  if (noticeOnly) { try { await syncNoticeEvent(id) } catch (error) { console.error('Failed to sync notice event', error); return apiError(500, 'INTERNAL_SERVER_ERROR', '이벤트 배너를 연결하지 못했습니다.') } }
  return json({ data })
}

const trashPost = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('posts').select('*').eq('id', id).maybeSingle(); if (!before) return apiError(404, 'NOT_FOUND', '글을 찾을 수 없습니다.')
  const now = new Date(); const after = { deleted_at: now.toISOString(), purge_after: new Date(now.getTime() + 30 * 86400000).toISOString(), updated_at: now.toISOString() }
  const { error } = await supabase.from('posts').update(after).eq('id', id); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 휴지통으로 이동하지 못했습니다.')
  await supabase.from('home_banners').delete().eq('post_id', id)
  await audit(auth.admin!.id, 'TRASH_POST', 'post', id, before, { ...before, ...after }); return new Response(null, { status: 204, headers: corsHeaders })
}

const restorePost = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('posts').select('*').eq('id', id).not('deleted_at', 'is', null).maybeSingle(); if (!before) return apiError(409, 'NOT_IN_TRASH', '휴지통 글이 아닙니다.')
  const { data, error } = await supabase.from('posts').update({ deleted_at: null, purge_after: null, updated_at: new Date().toISOString() }).eq('id', id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 복원하지 못했습니다.'); try { await syncNoticeEvent(id) } catch (eventError) { console.error('Failed to restore notice event', eventError) }; await audit(auth.admin!.id, 'RESTORE_POST', 'post', id, before, data); return json({ data })
}

const purgePost = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; if (!(await verifyAdminPassword(auth.admin!, body))) return apiError(401, 'ADMIN_REAUTH_FAILED', '관리자 비밀번호가 올바르지 않습니다.')
  const { data: before } = await supabase.from('posts').select('*').eq('id', id).not('deleted_at', 'is', null).maybeSingle(); if (!before) return apiError(409, 'NOT_IN_TRASH', '휴지통 글이 아닙니다.')
  await purgePostImages(id); const { error } = await supabase.from('posts').delete().eq('id', id); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '글을 영구 삭제하지 못했습니다.')
  await audit(auth.admin!.id, 'PURGE_POST', 'post', id, before, null); return new Response(null, { status: 204, headers: corsHeaders })
}

const listMarket = async (request: Request, url: URL) => {
  const auth = await requireAdmin(request); if (auth.error) return auth.error
  const page = positive(url.searchParams.get('page'), 1); const size = positive(url.searchParams.get('size'), 20, 50); if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')
  const q = safeSearch(url.searchParams.get('q') ?? ''); const status = url.searchParams.get('status') ?? 'ALL'; const deleted = url.searchParams.get('deleted') ?? 'exclude'
  let query: any = supabase.from('market_item_details').select('*', { count: 'exact' }); query = deleted === 'only' ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (status !== 'ALL') query = query.eq('status', status); if (q) query = query.or(`title.ilike.%${q}%,category.ilike.%${q}%`)
  const from = (page - 1) * size; const { data, count, error } = await query.order('updated_at', { ascending: false }).range(from, from + size - 1)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '판매글을 불러오지 못했습니다.') : json({ data: data ?? [], pagination: pageJson(page, size, count ?? 0) })
}

const updateMarket = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('market_items').select('*').eq('id', id).maybeSingle(); if (!before) return apiError(404, 'NOT_FOUND', '판매글을 찾을 수 없습니다.')
  if (before.status === 'SOLD') return apiError(409, 'SOLD_ITEM_IMMUTABLE', '판매 완료 상품은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return apiError(400, 'VALIDATION_ERROR', '수정 값을 입력해 주세요.')
  const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of ['title', 'description', 'category'] as const) if (key in body) { const value = typeof body[key] === 'string' ? body[key].trim() : ''; if (!value) return apiError(400, 'VALIDATION_ERROR', '필수 값을 확인해 주세요.'); values[key] = value }
  if ('pricePoints' in body) { if (!Number.isSafeInteger(body.pricePoints) || Number(body.pricePoints) < 1) return apiError(400, 'VALIDATION_ERROR', '가격을 확인해 주세요.'); values.price_points = body.pricePoints }
  if ('status' in body) { if (!['SELLING', 'RESERVED'].includes(String(body.status))) return apiError(400, 'VALIDATION_ERROR', '상태를 확인해 주세요.'); values.status = body.status }
  const { data, error } = await supabase.from('market_items').update(values).eq('id', id).select('*').single(); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '판매글을 수정하지 못했습니다.')
  await audit(auth.admin!.id, 'UPDATE_MARKET_ITEM', 'market_item', id, before, data); return json({ data })
}

const trashMarket = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('market_items').select('*').eq('id', id).maybeSingle(); if (!before) return apiError(404, 'NOT_FOUND', '판매글을 찾을 수 없습니다.')
  const now = new Date(); const after = { deleted_at: now.toISOString(), purge_after: new Date(now.getTime() + 30 * 86400000).toISOString(), updated_at: now.toISOString() }
  const { error } = await supabase.from('market_items').update(after).eq('id', id); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '판매글을 휴지통으로 이동하지 못했습니다.')
  await audit(auth.admin!.id, 'TRASH_MARKET_ITEM', 'market_item', id, before, { ...before, ...after }); return new Response(null, { status: 204, headers: corsHeaders })
}

const restoreMarket = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('market_items').select('*').eq('id', id).not('deleted_at', 'is', null).maybeSingle(); if (!before) return apiError(409, 'NOT_IN_TRASH', '휴지통 판매글이 아닙니다.')
  const { data, error } = await supabase.from('market_items').update({ deleted_at: null, purge_after: null, updated_at: new Date().toISOString() }).eq('id', id).select('*').single(); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '판매글을 복원하지 못했습니다.')
  await audit(auth.admin!.id, 'RESTORE_MARKET_ITEM', 'market_item', id, before, data); return json({ data })
}

const purgeMarket = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; if (!(await verifyAdminPassword(auth.admin!, body))) return apiError(401, 'ADMIN_REAUTH_FAILED', '관리자 비밀번호가 올바르지 않습니다.')
  const { data: before } = await supabase.from('market_items').select('*').eq('id', id).not('deleted_at', 'is', null).maybeSingle(); if (!before) return apiError(409, 'NOT_IN_TRASH', '휴지통 판매글이 아닙니다.')
  const { count } = await supabase.from('market_orders').select('id', { count: 'exact', head: true }).eq('item_id', id)
  const { data: images } = await supabase.from('market_item_images').select('storage_path').eq('item_id', id)
  const query = count ? supabase.from('market_items').update({ title: '[삭제된 상품]', description: '삭제된 상품입니다.', category: '삭제됨', tags: [], purge_after: null, updated_at: new Date().toISOString() }).eq('id', id) : supabase.from('market_items').delete().eq('id', id)
  const { error } = await query; if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '판매글을 영구 삭제하지 못했습니다.')
  await supabase.from('market_item_images').delete().eq('item_id', id); const paths = (images ?? []).map((item: any) => item.storage_path); if (paths.length) await supabase.storage.from('market-item-images').remove(paths)
  await audit(auth.admin!.id, 'PURGE_MARKET_ITEM', 'market_item', id, before, count ? { tombstoned: true } : null); return new Response(null, { status: 204, headers: corsHeaders })
}

const listUsers = async (request: Request, url: URL) => {
  const auth = await requireAdmin(request); if (auth.error) return auth.error
  const page = positive(url.searchParams.get('page'), 1); const size = positive(url.searchParams.get('size'), 20, 50); if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')
  const q = safeSearch(url.searchParams.get('q') ?? ''); const status = url.searchParams.get('status') ?? 'ALL'; let query: any = supabase.from('users').select('id,email,nickname,account_status,password_change_required,created_at,withdrawn_at', { count: 'exact' }).neq('role', 'ADMIN')
  if (status !== 'ALL') query = query.eq('account_status', status); if (q) query = query.or(`email.ilike.%${q}%,nickname.ilike.%${q}%`)
  const from = (page - 1) * size; const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, from + size - 1); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '회원을 불러오지 못했습니다.')
  const ids = (data ?? []).map((item: any) => item.id); const { data: wallets } = ids.length ? await supabase.from('wallets').select('user_id,balance').in('user_id', ids) : { data: [] }; const balance = new Map((wallets ?? []).map((item: any) => [item.user_id, item.balance]))
  return json({ data: (data ?? []).map((item: any) => ({ id: item.id, email: item.email, nickname: item.nickname, accountStatus: item.account_status, passwordChangeRequired: item.password_change_required, balance: balance.get(item.id) ?? 0, createdAt: item.created_at, withdrawnAt: item.withdrawn_at })), pagination: pageJson(page, size, count ?? 0) })
}

const updateUser = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: before } = await supabase.from('users').select('id,email,nickname,account_status,created_at,updated_at').eq('id', id).neq('role', 'ADMIN').maybeSingle(); if (!before) return apiError(404, 'NOT_FOUND', '회원을 찾을 수 없습니다.'); if (before.account_status === 'WITHDRAWN') return apiError(409, 'WITHDRAWN_ACCOUNT', '탈퇴 회원은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; if (!body) return apiError(400, 'VALIDATION_ERROR', '수정 값을 입력해 주세요.'); const values: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('email' in body) { const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''; if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return apiError(400, 'VALIDATION_ERROR', '이메일을 확인해 주세요.'); values.email = email }
  if ('nickname' in body) { const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''; if (nickname.length < 2 || nickname.length > 30) return apiError(400, 'VALIDATION_ERROR', '닉네임을 확인해 주세요.'); values.nickname = nickname }
  if ('accountStatus' in body) { if (!['ACTIVE', 'BLOCKED'].includes(String(body.accountStatus))) return apiError(400, 'VALIDATION_ERROR', '계정 상태를 확인해 주세요.'); values.account_status = body.accountStatus }
  const { data, error } = await supabase.from('users').update(values).eq('id', id).select('*').single(); if (error?.code === '23505') return apiError(409, 'EMAIL_ALREADY_EXISTS', '이미 사용 중인 이메일입니다.'); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '회원을 수정하지 못했습니다.')
  if (values.account_status === 'BLOCKED') await supabase.from('sessions').delete().eq('user_id', id); await audit(auth.admin!.id, 'UPDATE_USER', 'user', id, before, data); return json({ data: { id: data.id, email: data.email, nickname: data.nickname, accountStatus: data.account_status } })
}

const resetPassword = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const { data: user } = await supabase.from('users').select('id,account_status').eq('id', id).neq('role', 'ADMIN').maybeSingle(); if (!user || user.account_status === 'WITHDRAWN') return apiError(404, 'NOT_FOUND', '활성 회원을 찾을 수 없습니다.')
  const temporaryPassword = `Tmp!${randomToken().slice(0, 16)}`; const { error } = await supabase.from('users').update({ password_hash: await bcrypt.hash(temporaryPassword, 12), password_change_required: true, updated_at: new Date().toISOString() }).eq('id', id); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '비밀번호를 초기화하지 못했습니다.')
  await supabase.from('sessions').delete().eq('user_id', id); await audit(auth.admin!.id, 'RESET_USER_PASSWORD', 'user', id, null, { passwordChangeRequired: true }); return json({ data: { temporaryPassword } })
}

const setWallet = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const body = await request.json().catch(() => null) as Record<string, unknown> | null; const target = body?.targetBalance; const reason = typeof body?.reason === 'string' ? body.reason.trim() : ''
  if (!Number.isSafeInteger(target) || Number(target) < 0 || reason.length < 2 || reason.length > 200) return apiError(400, 'VALIDATION_ERROR', '목표 잔액과 조정 사유를 확인해 주세요.')
  const { data: user } = await supabase.from('users').select('id').eq('id', id).neq('role', 'ADMIN').maybeSingle(); if (!user) return apiError(404, 'NOT_FOUND', '회원을 찾을 수 없습니다.')
  const { data, error } = await supabase.rpc('set_admin_wallet_balance', { p_admin_id: auth.admin!.id, p_user_id: id, p_target_balance: target, p_reason: reason }); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '포인트를 조정하지 못했습니다.')
  const result = data?.[0] ?? { balance: target, adjustment: 0 }; await audit(auth.admin!.id, 'SET_WALLET_BALANCE', 'user', id, null, result, reason); return json({ data: result })
}

const withdrawUser = async (request: Request, id: number) => {
  const auth = await requireAdmin(request, true); if (auth.error) return auth.error
  const body = await request.json().catch(() => ({})) as Record<string, unknown>; if (!(await verifyAdminPassword(auth.admin!, body))) return apiError(401, 'ADMIN_REAUTH_FAILED', '관리자 비밀번호가 올바르지 않습니다.')
  const { data: before } = await supabase.from('users').select('*').eq('id', id).neq('role', 'ADMIN').maybeSingle(); if (!before) return apiError(404, 'NOT_FOUND', '회원을 찾을 수 없습니다.'); if (before.account_status === 'WITHDRAWN') return apiError(409, 'ALREADY_WITHDRAWN', '이미 탈퇴 처리된 회원입니다.')
  const { error } = await supabase.rpc('withdraw_own_account', { p_user_id: id, p_replacement_password_hash: await bcrypt.hash(randomToken(), 12) }); if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '회원 탈퇴를 처리하지 못했습니다.')
  await audit(auth.admin!.id, 'WITHDRAW_USER', 'user', id, { id: before.id, email: before.email, nickname: before.nickname }, { id, accountStatus: 'WITHDRAWN' }); return new Response(null, { status: 204, headers: corsHeaders })
}

const listAudit = async (request: Request, url: URL) => {
  const auth = await requireAdmin(request); if (auth.error) return auth.error; const page = positive(url.searchParams.get('page'), 1); const size = positive(url.searchParams.get('size'), 50, 100); if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')
  const from = (page - 1) * size; const { data, count, error } = await supabase.from('admin_audit_logs').select('*', { count: 'exact' }).order('created_at', { ascending: false }).range(from, from + size - 1); return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '감사 로그를 불러오지 못했습니다.') : json({ data: data ?? [], pagination: pageJson(page, size, count ?? 0) })
}

export const handleAdminRoute = (request: Request, path: string, url: URL) => {
  if (path === '/admin/auth/login' && request.method === 'POST') return adminLogin(request)
  if (path === '/admin/me' && request.method === 'GET') return adminMe(request)
  if (path === '/admin/dashboard' && request.method === 'GET') return dashboard(request, url)
  if (path === '/admin/dashboard/details' && request.method === 'GET') return dashboardDetails(request, url)
  if (path === '/admin/posts' && request.method === 'GET') return listPosts(request, url)
  if (path === '/admin/notices' && request.method === 'GET') return listPosts(request, url, true)
  if (path === '/admin/notices' && request.method === 'POST') return createNotice(request)
  if (path === '/admin/market-items' && request.method === 'GET') return listMarket(request, url)
  if (path === '/admin/users' && request.method === 'GET') return listUsers(request, url)
  if (path === '/admin/audit-logs' && request.method === 'GET') return listAudit(request, url)
  const post = path.match(/^\/admin\/(posts|notices)\/(\d+)$/); if (post) { const id = Number(post[2]); if (request.method === 'PATCH') return updatePost(request, id, post[1] === 'notices'); if (request.method === 'DELETE') return trashPost(request, id) }
  const postRestore = path.match(/^\/admin\/posts\/(\d+)\/restore$/); if (postRestore && request.method === 'POST') return restorePost(request, Number(postRestore[1]))
  const postImage = path.match(/^\/admin\/posts\/(\d+)\/images$/); if (postImage && request.method === 'POST') return uploadPostImage(request, Number(postImage[1]))
  const postPurge = path.match(/^\/admin\/posts\/(\d+)\/permanent-delete$/); if (postPurge && request.method === 'POST') return purgePost(request, Number(postPurge[1]))
  const market = path.match(/^\/admin\/market-items\/(\d+)$/); if (market) { const id = Number(market[1]); if (request.method === 'PATCH') return updateMarket(request, id); if (request.method === 'DELETE') return trashMarket(request, id) }
  const marketRestore = path.match(/^\/admin\/market-items\/(\d+)\/restore$/); if (marketRestore && request.method === 'POST') return restoreMarket(request, Number(marketRestore[1]))
  const marketPurge = path.match(/^\/admin\/market-items\/(\d+)\/permanent-delete$/); if (marketPurge && request.method === 'POST') return purgeMarket(request, Number(marketPurge[1]))
  const user = path.match(/^\/admin\/users\/(\d+)$/); if (user && request.method === 'PATCH') return updateUser(request, Number(user[1]))
  const password = path.match(/^\/admin\/users\/(\d+)\/password-reset$/); if (password && request.method === 'POST') return resetPassword(request, Number(password[1]))
  const wallet = path.match(/^\/admin\/users\/(\d+)\/wallet$/); if (wallet && request.method === 'PUT') return setWallet(request, Number(wallet[1]))
  const withdraw = path.match(/^\/admin\/users\/(\d+)\/withdraw$/); if (withdraw && request.method === 'POST') return withdrawUser(request, Number(withdraw[1]))
  return null
}
