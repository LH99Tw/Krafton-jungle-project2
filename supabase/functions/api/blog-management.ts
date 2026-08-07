import { apiError, corsHeaders, getSession, json, requireCsrfSession, supabase, supabaseUrl } from './shared.ts'

const imageUrl = (path?: string | null) => path ? `${supabaseUrl}/storage/v1/object/public/blog-profile-images/${path}` : null
const blogJson = (blog: Record<string, any>) => ({
  id: blog.id, name: blog.name, slug: blog.slug, url: `/blog/${blog.slug}`,
  description: blog.description, shopName: blog.shop_name, shopDescription: blog.shop_description,
  profileImageUrl: imageUrl(blog.profile_image_path),
  createdAt: blog.created_at, updatedAt: blog.updated_at,
})

const ownedBlog = async (request: Request, csrf = false) => {
  const session = csrf ? await requireCsrfSession(request) : await getSession(request)
  if (!session) return { error: apiError(csrf ? 403 : 401, csrf ? 'CSRF_TOKEN_INVALID' : 'UNAUTHENTICATED', csrf ? 'CSRF 토큰이 유효하지 않습니다.' : '로그인이 필요합니다.') }
  if (!session.user_id) return { error: apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.') }
  const { data, error } = await supabase.from('blogs').select('*').eq('owner_id', session.user_id).maybeSingle()
  if (error) return { error: apiError(500, 'INTERNAL_SERVER_ERROR', '블로그를 불러오지 못했습니다.') }
  if (!data) return { error: apiError(409, 'BLOG_REQUIRED', '먼저 블로그를 만들어 주세요.') }
  return { session, blog: data }
}

const updateBlog = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  if (Object.prototype.hasOwnProperty.call(body, 'slug')) return apiError(400, 'IMMUTABLE_FIELD', '블로그 주소는 변경할 수 없습니다.', { slug: '변경할 수 없는 항목입니다.' })
  const values: Record<string, string> = {}
  const fields: Record<string, string> = {}
  if (Object.prototype.hasOwnProperty.call(body, 'name')) {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 30) fields.name = '블로그 이름은 2~30자로 입력해 주세요.'
    else values.name = name
  }
  if (Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (description.length > 160) fields.description = '블로그 설명은 160자 이하로 입력해 주세요.'
    else values.description = description
  }
  if (Object.prototype.hasOwnProperty.call(body, 'shopName')) {
    const shopName = typeof body.shopName === 'string' ? body.shopName.trim() : ''
    if (!shopName || shopName.length > 40) fields.shopName = '상점 이름은 1~40자로 입력해 주세요.'
    else values.shop_name = shopName
  }
  if (Object.prototype.hasOwnProperty.call(body, 'shopDescription')) {
    const shopDescription = typeof body.shopDescription === 'string' ? body.shopDescription.trim() : ''
    if (shopDescription.length > 120) fields.shopDescription = '상점 설명은 120자 이하로 입력해 주세요.'
    else values.shop_description = shopDescription
  }
  if (!Object.keys(values).length && !Object.keys(fields).length) fields.request = '수정할 값을 입력해 주세요.'
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data, error } = await supabase.from('blogs').update({ ...values, updated_at: new Date().toISOString() }).eq('id', ownership.blog.id).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '블로그를 수정하지 못했습니다.')
  return json({ data: blogJson(data) })
}

const uploadProfileImage = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File) || file.type !== 'image/webp' || file.size < 16 || file.size > 2 * 1024 * 1024) {
    return apiError(400, 'INVALID_PROFILE_IMAGE', '512×512 WebP 이미지를 2MB 이하로 업로드해 주세요.')
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return apiError(400, 'INVALID_PROFILE_IMAGE', '유효한 WebP 파일이 아닙니다.')
  const path = `${ownership.session!.user_id}/${crypto.randomUUID()}.webp`
  const { error: uploadError } = await supabase.storage.from('blog-profile-images').upload(path, bytes, { contentType: 'image/webp', upsert: false })
  if (uploadError) return apiError(500, 'PROFILE_IMAGE_UPLOAD_FAILED', '프로필 이미지를 업로드하지 못했습니다.')
  const previous = ownership.blog.profile_image_path as string | null
  const { error: updateError } = await supabase.from('blogs').update({ profile_image_path: path, updated_at: new Date().toISOString() }).eq('id', ownership.blog.id)
  if (updateError) {
    await supabase.storage.from('blog-profile-images').remove([path])
    return apiError(500, 'INTERNAL_SERVER_ERROR', '프로필 이미지를 저장하지 못했습니다.')
  }
  if (previous) await supabase.storage.from('blog-profile-images').remove([previous])
  return json({ data: { profileImageUrl: imageUrl(path) } })
}

const deleteProfileImage = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const previous = ownership.blog.profile_image_path as string | null
  const { error } = await supabase.from('blogs').update({ profile_image_path: null, updated_at: new Date().toISOString() }).eq('id', ownership.blog.id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '프로필 이미지를 삭제하지 못했습니다.')
  if (previous) await supabase.storage.from('blog-profile-images').remove([previous])
  return new Response(null, { status: 204, headers: corsHeaders })
}

const categoryName = (value: unknown) => {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return { name, normalized: name.toLocaleLowerCase('ko-KR') }
}

const listCategories = async (request: Request) => {
  const ownership = await ownedBlog(request)
  if (ownership.error) return ownership.error
  const { data, error } = await supabase.from('blog_categories').select('*').eq('blog_id', ownership.blog.id).order('position')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리를 불러오지 못했습니다.')
  const ids = (data ?? []).map((item: Record<string, any>) => item.id)
  const { data: posts } = ids.length ? await supabase.from('posts').select('category_id, deleted_at').in('category_id', ids) : { data: [] }
  return json({ data: (data ?? []).map((item: Record<string, any>) => ({
    id: item.id, name: item.name, position: item.position, isDefault: item.is_default,
    activePostCount: (posts ?? []).filter((post: Record<string, any>) => post.category_id === item.id && !post.deleted_at).length,
    trashPostCount: (posts ?? []).filter((post: Record<string, any>) => post.category_id === item.id && post.deleted_at).length,
  })) })
}

const createCategory = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null)
  const parsed = categoryName(body?.name)
  if (!parsed.name || parsed.name.length > 30) return apiError(400, 'VALIDATION_ERROR', '카테고리 이름은 1~30자로 입력해 주세요.')
  const { count } = await supabase.from('blog_categories').select('id', { count: 'exact', head: true }).eq('blog_id', ownership.blog.id)
  if ((count ?? 0) >= 30) return apiError(409, 'CATEGORY_LIMIT_REACHED', '카테고리는 최대 30개까지 만들 수 있습니다.')
  const { data, error } = await supabase.from('blog_categories').insert({ blog_id: ownership.blog.id, name: parsed.name, normalized_name: parsed.normalized, position: count ?? 0 }).select('*').single()
  if (error?.code === '23505') return apiError(409, 'CATEGORY_ALREADY_EXISTS', '같은 이름의 카테고리가 이미 있습니다.')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리를 추가하지 못했습니다.')
  return json({ data: { id: data.id, name: data.name, position: data.position, isDefault: false, activePostCount: 0, trashPostCount: 0 } }, 201)
}

const updateCategory = async (request: Request, id: number) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const { data: existing } = await supabase.from('blog_categories').select('is_default').eq('id', id).eq('blog_id', ownership.blog.id).maybeSingle()
  if (!existing) return apiError(404, 'NOT_FOUND', '카테고리를 찾을 수 없습니다.')
  if (existing.is_default) return apiError(409, 'DEFAULT_CATEGORY_PROTECTED', '기본 카테고리인 전체글은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null)
  const parsed = categoryName(body?.name)
  if (!parsed.name || parsed.name.length > 30) return apiError(400, 'VALIDATION_ERROR', '카테고리 이름은 1~30자로 입력해 주세요.')
  const { data, error } = await supabase.from('blog_categories').update({ name: parsed.name, normalized_name: parsed.normalized, updated_at: new Date().toISOString() }).eq('id', id).eq('blog_id', ownership.blog.id).select('*').maybeSingle()
  if (error?.code === '23505') return apiError(409, 'CATEGORY_ALREADY_EXISTS', '같은 이름의 카테고리가 이미 있습니다.')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리를 수정하지 못했습니다.')
  if (!data) return apiError(404, 'NOT_FOUND', '카테고리를 찾을 수 없습니다.')
  return json({ data: { id: data.id, name: data.name, position: data.position, isDefault: false } })
}

const reorderCategories = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.categoryIds) ? body.categoryIds.filter((id: unknown) => Number.isSafeInteger(id)) as number[] : []
  const { data } = await supabase.from('blog_categories').select('id,is_default').eq('blog_id', ownership.blog.id).order('position')
  const current = (data ?? []).map((item: Record<string, any>) => item.id)
  if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.includes(id))) return apiError(400, 'VALIDATION_ERROR', '현재 카테고리 전체 순서를 정확히 보내 주세요.')
  const defaultId = (data ?? []).find((item: Record<string, any>) => item.is_default)?.id
  if (!defaultId || ids[0] !== defaultId) return apiError(409, 'DEFAULT_CATEGORY_PROTECTED', '전체글 카테고리는 항상 첫 번째에 있어야 합니다.')
  for (let index = 1; index < current.length; index++) {
    const { error } = await supabase.from('blog_categories').update({ position: 1000 + index }).eq('id', current[index]).eq('blog_id', ownership.blog.id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리 순서를 저장하지 못했습니다.')
  }
  for (let index = 1; index < ids.length; index++) {
    const { error } = await supabase.from('blog_categories').update({ position: index, updated_at: new Date().toISOString() }).eq('id', ids[index]).eq('blog_id', ownership.blog.id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리 순서를 저장하지 못했습니다.')
  }
  return json({ data: { categoryIds: ids } })
}

const deleteCategory = async (request: Request, id: number) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const { data: category } = await supabase.from('blog_categories').select('id,is_default').eq('id', id).eq('blog_id', ownership.blog.id).maybeSingle()
  if (!category) return apiError(404, 'NOT_FOUND', '카테고리를 찾을 수 없습니다.')
  if (category.is_default) return apiError(409, 'DEFAULT_CATEGORY_PROTECTED', '기본 카테고리인 전체글은 삭제할 수 없습니다.')
  const { count } = await supabase.from('posts').select('id', { count: 'exact', head: true }).eq('category_id', id)
  if (count) return apiError(409, 'CATEGORY_IN_USE', `글 ${count}개가 사용 중인 카테고리는 삭제할 수 없습니다.`, { posts: String(count) })
  const { error } = await supabase.from('blog_categories').delete().eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '카테고리를 삭제하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}

const listClassifications = async (request: Request) => {
  const ownership = await ownedBlog(request)
  if (ownership.error) return ownership.error
  const { data, error } = await supabase.from('blog_classifications').select('*').eq('blog_id', ownership.blog.id).order('position')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류를 불러오지 못했습니다.')
  const ids = (data ?? []).map((item: Record<string, any>) => item.id)
  const { data: links } = ids.length ? await supabase.from('post_classifications').select('classification_id,post_id').in('classification_id', ids) : { data: [] }
  const postIds = [...new Set((links ?? []).map((link: Record<string, any>) => link.post_id))]
  const { data: posts } = postIds.length ? await supabase.from('posts').select('id,deleted_at').in('id', postIds) : { data: [] }
  const postMap = new Map((posts ?? []).map((post: Record<string, any>) => [post.id, post]))
  return json({ data: (data ?? []).map((item: Record<string, any>) => {
    const linked = (links ?? []).filter((link: Record<string, any>) => link.classification_id === item.id).map((link: Record<string, any>) => postMap.get(link.post_id)).filter(Boolean) as Record<string, any>[]
    return { id: item.id, name: item.name, position: item.position, source: item.source ?? 'CUSTOM', activePostCount: linked.filter((post) => !post.deleted_at).length, trashPostCount: linked.filter((post) => post.deleted_at).length }
  }) })
}

const createClassification = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null); const parsed = categoryName(body?.name)
  const source = body?.source === 'INTEREST' ? 'INTEREST' : 'CUSTOM'
  if (!parsed.name || parsed.name.length > 30) return apiError(400, 'VALIDATION_ERROR', '분류 이름은 1~30자로 입력해 주세요.')
  if (source === 'INTEREST') {
    const { data: owner } = await supabase.from('users').select('interests').eq('id', ownership.session!.user_id).maybeSingle()
    const allowed = Array.isArray(owner?.interests) && owner.interests.some((interest: unknown) => typeof interest === 'string' && categoryName(interest).normalized === parsed.normalized)
    if (!allowed) return apiError(400, 'VALIDATION_ERROR', '현재 관심분야에 포함된 항목만 관심분야 분류로 만들 수 있습니다.')
  }
  const { data: existing, error: existingError } = await supabase.from('blog_classifications').select('*').eq('blog_id', ownership.blog.id).eq('normalized_name', parsed.normalized).maybeSingle()
  if (existingError) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류를 확인하지 못했습니다.')
  if (existing) {
    if (source !== 'INTEREST' || existing.source === 'INTEREST') return apiError(409, 'CLASSIFICATION_ALREADY_EXISTS', '같은 이름의 분류가 이미 있습니다.')
    const { data, error } = await supabase.from('blog_classifications').update({ source: 'INTEREST', updated_at: new Date().toISOString() }).eq('id', existing.id).eq('blog_id', ownership.blog.id).select('*').single()
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '관심분야 분류를 연결하지 못했습니다.')
    return json({ data: { id: data.id, name: data.name, position: data.position, source: data.source, activePostCount: 0, trashPostCount: 0 } })
  }
  const { count } = await supabase.from('blog_classifications').select('id', { count: 'exact', head: true }).eq('blog_id', ownership.blog.id)
  if ((count ?? 0) >= 30) return apiError(409, 'CLASSIFICATION_LIMIT_REACHED', '분류는 최대 30개까지 만들 수 있습니다.')
  const { data, error } = await supabase.from('blog_classifications').insert({ blog_id: ownership.blog.id, name: parsed.name, normalized_name: parsed.normalized, position: count ?? 0, source }).select('*').single()
  if (error?.code === '23505') return apiError(409, 'CLASSIFICATION_ALREADY_EXISTS', '같은 이름의 분류가 이미 있습니다.')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류를 추가하지 못했습니다.')
  return json({ data: { id: data.id, name: data.name, position: data.position, source: data.source, activePostCount: 0, trashPostCount: 0 } }, 201)
}

const updateClassification = async (request: Request, id: number) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null); const parsed = categoryName(body?.name)
  if (!parsed.name || parsed.name.length > 30) return apiError(400, 'VALIDATION_ERROR', '분류 이름은 1~30자로 입력해 주세요.')
  const { data, error } = await supabase.from('blog_classifications').update({ name: parsed.name, normalized_name: parsed.normalized, updated_at: new Date().toISOString() }).eq('id', id).eq('blog_id', ownership.blog.id).select('*').maybeSingle()
  if (error?.code === '23505') return apiError(409, 'CLASSIFICATION_ALREADY_EXISTS', '같은 이름의 분류가 이미 있습니다.')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류를 수정하지 못했습니다.')
  return data ? json({ data: { id: data.id, name: data.name, position: data.position } }) : apiError(404, 'NOT_FOUND', '분류를 찾을 수 없습니다.')
}

const reorderClassifications = async (request: Request) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.classificationIds) ? body.classificationIds.filter((id: unknown) => Number.isSafeInteger(id)) as number[] : []
  const { data, error: readError } = await supabase.from('blog_classifications').select('id').eq('blog_id', ownership.blog.id).order('position')
  if (readError) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류 순서를 불러오지 못했습니다.')
  const current = (data ?? []).map((item: Record<string, any>) => item.id)
  if (ids.length !== current.length || new Set(ids).size !== ids.length || ids.some((id) => !current.includes(id))) return apiError(400, 'VALIDATION_ERROR', '현재 분류 전체 순서를 정확히 보내 주세요.')
  for (let index = 0; index < current.length; index++) {
    const { error } = await supabase.from('blog_classifications').update({ position: 1000 + index }).eq('id', current[index]).eq('blog_id', ownership.blog.id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류 순서를 저장하지 못했습니다.')
  }
  for (let index = 0; index < ids.length; index++) {
    const { error } = await supabase.from('blog_classifications').update({ position: index, updated_at: new Date().toISOString() }).eq('id', ids[index]).eq('blog_id', ownership.blog.id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '분류 순서를 저장하지 못했습니다.')
  }
  return json({ data: { classificationIds: ids } })
}

const deleteClassification = async (request: Request, id: number) => {
  const ownership = await ownedBlog(request, true)
  if (ownership.error) return ownership.error
  const { data: item } = await supabase.from('blog_classifications').select('id').eq('id', id).eq('blog_id', ownership.blog.id).maybeSingle()
  if (!item) return apiError(404, 'NOT_FOUND', '분류를 찾을 수 없습니다.')
  const { count } = await supabase.from('post_classifications').select('post_id', { count: 'exact', head: true }).eq('classification_id', id)
  if (count) return apiError(409, 'CLASSIFICATION_IN_USE', `글 ${count}개가 사용 중인 분류는 삭제할 수 없습니다.`)
  const { error } = await supabase.from('blog_classifications').delete().eq('id', id)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '분류를 삭제하지 못했습니다.') : new Response(null, { status: 204, headers: corsHeaders })
}

const dashboard = async (request: Request) => {
  const ownership = await ownedBlog(request)
  if (ownership.error) return ownership.error
  const ownerId = ownership.session!.user_id
  const [posts, market, subscribers, recentPosts, recentMarket] = await Promise.all([
    supabase.from('posts').select('status, deleted_at').eq('blog_id', ownership.blog.id),
    supabase.from('market_items').select('status, deleted_at').eq('seller_id', ownerId),
    supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('blog_id', ownership.blog.id),
    supabase.from('post_details').select('*').eq('owner_id', ownerId).is('deleted_at', null).order('updated_at', { ascending: false }).limit(5),
    supabase.from('market_items').select('*').eq('seller_id', ownerId).is('deleted_at', null).order('created_at', { ascending: false }).limit(5),
  ])
  if (posts.error || market.error || recentPosts.error || recentMarket.error) return apiError(500, 'INTERNAL_SERVER_ERROR', '관리 현황을 불러오지 못했습니다.')
  const postRows = posts.data ?? []; const marketRows = market.data ?? []
  return json({ data: {
    blog: blogJson(ownership.blog),
    counts: {
      posts: { total: postRows.filter((x) => !x.deleted_at).length, published: postRows.filter((x) => !x.deleted_at && x.status === 'PUBLISHED').length, draft: postRows.filter((x) => !x.deleted_at && x.status === 'DRAFT').length, trash: postRows.filter((x) => x.deleted_at).length },
      market: { total: marketRows.filter((x) => !x.deleted_at).length, selling: marketRows.filter((x) => !x.deleted_at && x.status === 'SELLING').length, reserved: marketRows.filter((x) => !x.deleted_at && x.status === 'RESERVED').length, sold: marketRows.filter((x) => !x.deleted_at && x.status === 'SOLD').length, trash: marketRows.filter((x) => x.deleted_at).length },
      subscribers: subscribers.count ?? 0,
    },
    recentPosts: (recentPosts.data ?? []).map((post: Record<string, any>) => ({ id: post.id, title: post.title, status: post.status, category: post.category_id ? { id: post.category_id, name: post.category_name } : null, updatedAt: post.updated_at, viewCount: post.view_count })),
    recentMarketItems: (recentMarket.data ?? []).map((item: Record<string, any>) => ({ id: item.id, title: item.title, category: item.category, pricePoints: item.price_points, status: item.status, createdAt: item.created_at })),
  } })
}

export const handleBlogManagementRoute = (request: Request, path: string) => {
  if (path === '/blogs/me/dashboard' && request.method === 'GET') return dashboard(request)
  if (path === '/blogs/me' && request.method === 'PATCH') return updateBlog(request)
  if (path === '/blogs/me/profile-image' && request.method === 'POST') return uploadProfileImage(request)
  if (path === '/blogs/me/profile-image' && request.method === 'DELETE') return deleteProfileImage(request)
  if (path === '/blogs/me/categories') {
    if (request.method === 'GET') return listCategories(request)
    if (request.method === 'POST') return createCategory(request)
  }
  if (path === '/blogs/me/categories/order' && request.method === 'PATCH') return reorderCategories(request)
  if (path === '/blogs/me/classifications') {
    if (request.method === 'GET') return listClassifications(request)
    if (request.method === 'POST') return createClassification(request)
  }
  if (path === '/blogs/me/classifications/order' && request.method === 'PATCH') return reorderClassifications(request)
  const classificationMatch = path.match(/^\/blogs\/me\/classifications\/(\d+)$/)
  if (classificationMatch && request.method === 'PATCH') return updateClassification(request, Number(classificationMatch[1]))
  if (classificationMatch && request.method === 'DELETE') return deleteClassification(request, Number(classificationMatch[1]))
  const match = path.match(/^\/blogs\/me\/categories\/(\d+)$/)
  if (!match) return null
  const id = Number(match[1])
  if (request.method === 'PATCH') return updateCategory(request, id)
  if (request.method === 'DELETE') return deleteCategory(request, id)
  return null
}
