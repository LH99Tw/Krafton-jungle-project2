import { apiError, corsHeaders, getSession, json, requireCsrfSession, supabase, supabaseUrl } from '../shared.ts'
import { findMarketItem, findSeller, marketItemDetailFields, marketItemFields } from './market.repository.ts'

const conditions = ['NEW', 'LIKE_NEW', 'USED'] as const
const statuses = ['SELLING', 'RESERVED', 'SOLD'] as const
const marketImageUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/market-item-images/${path}`

const positiveInteger = (value: string | null, fallback: number, max?: number) => {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) return null
  return parsed
}

export const marketItemJson = (item: Record<string, any>, seller?: Record<string, any>) => ({
  id: item.id,
  url: `/market/${item.id}`,
  seller: seller ?? { id: item.seller_id, nickname: item.seller_nickname },
  title: item.title,
  description: item.description,
  category: item.category,
  tags: item.tags ?? [],
  condition: item.condition,
  pricePoints: item.price_points,
  status: item.status,
  likeCount: Number(item.like_count ?? 0),
  isLiked: false,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
  deletedAt: item.deleted_at,
  purgeAfter: item.purge_after,
})

export const marketDtos = async (request: Request, items: Record<string, any>[], knownUserId?: number | null) => {
  if (!items.length) return []
  const sellerIds = [...new Set(items.map((item) => item.seller_id))]
  const itemIds = items.map((item) => item.id)
  const userId = knownUserId === undefined ? (await getSession(request))?.user_id ?? null : knownUserId
  const [sellerResult, likeResult, imageResult] = await Promise.all([
    supabase.from('users').select('id,nickname').in('id', sellerIds),
    userId
      ? supabase.from('market_item_likes').select('item_id').eq('user_id', userId).in('item_id', itemIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.from('market_item_images').select('id,item_id,storage_path,position').in('item_id', itemIds).order('position'),
  ])
  const { data: sellers, error: sellerError } = sellerResult
  if (sellerError) throw sellerError
  const sellerMap = new Map((sellers ?? []).map((seller: Record<string, any>) => [seller.id, seller]))
  const { data: mine, error: likeError } = likeResult
  if (likeError) throw likeError
  const likedIds = new Set((mine ?? []).map((item: Record<string, any>) => item.item_id))
  const { data: imageRows, error: imageError } = imageResult
  if (imageError) throw imageError
  const imagesByItem = new Map<number, { id: number; url: string; position: number }[]>()
  for (const image of imageRows ?? []) {
    const images = imagesByItem.get(image.item_id) ?? []
    images.push({ id: image.id, url: marketImageUrl(image.storage_path), position: image.position })
    imagesByItem.set(image.item_id, images)
  }
  return items.map((item) => {
    const images = imagesByItem.get(item.id) ?? []
    return { ...marketItemJson(item, sellerMap.get(item.seller_id)), isLiked: likedIds.has(item.id), images, thumbnailUrl: images[0]?.url ?? null }
  })
}

export const getPopularMarketItems = async (request: Request, limit = 5, knownUserId?: number | null) => {
  const { data, error } = await supabase.from('market_item_details').select(marketItemDetailFields)
    .eq('status', 'SELLING').is('deleted_at', null)
    .order('like_count', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(limit)
  if (error) return { data: [], error }
  try { return { data: await marketDtos(request, data ?? [], knownUserId), error: null } }
  catch (error) { return { data: [], error } }
}

const marketInput = (body: Record<string, unknown>, partial = false) => {
  const fields: Record<string, string> = {}
  const values: Record<string, string | number | string[]> = {}
  const definitions = [
    ['title', 100, '상품명은 1~100자로 입력해 주세요.'],
    ['description', 5000, '설명은 1~5,000자로 입력해 주세요.'],
    ['category', 50, '카테고리는 1~50자로 입력해 주세요.'],
  ] as const

  for (const [key, max, message] of definitions) {
    const present = Object.prototype.hasOwnProperty.call(body, key)
    if (!partial || present) {
      const value = typeof body[key] === 'string' ? body[key].trim() : ''
      if (!value || value.length > max) fields[key] = message
      else values[key] = value
    }
  }

  const hasCondition = Object.prototype.hasOwnProperty.call(body, 'condition')
  if (!partial || hasCondition) {
    if (typeof body.condition !== 'string' || !conditions.includes(body.condition as typeof conditions[number])) {
      fields.condition = '상품 상태는 NEW, LIKE_NEW, USED 중 하나여야 합니다.'
    } else values.condition = body.condition
  }

  const hasPrice = Object.prototype.hasOwnProperty.call(body, 'pricePoints')
  if (!partial || hasPrice) {
    if (!Number.isSafeInteger(body.pricePoints) || Number(body.pricePoints) < 1 || Number(body.pricePoints) > 1_000_000_000) {
      fields.pricePoints = '가격은 1~1,000,000,000 사이의 정수 포인트여야 합니다.'
    } else values.price_points = Number(body.pricePoints)
  }

  const hasStatus = Object.prototype.hasOwnProperty.call(body, 'status')
  if (hasStatus) {
    if (typeof body.status !== 'string' || !statuses.includes(body.status as typeof statuses[number])) {
      fields.status = '판매 상태를 확인해 주세요.'
    } else values.status = body.status
  }

  const hasTags = Object.prototype.hasOwnProperty.call(body, 'tags')
  if (!partial || hasTags) {
    if (!Array.isArray(body.tags)) fields.tags = '키워드는 배열로 입력해 주세요.'
    else {
      const tags = [...new Set(body.tags.map((tag) => typeof tag === 'string' ? tag.trim().replace(/^#/, '').toLowerCase() : ''))]
      if (tags.some((tag) => !tag || tag.length > 20) || tags.length > 5) fields.tags = '키워드는 1~20자로 최대 5개까지 입력할 수 있습니다.'
      else values.tags = tags
    }
  }

  if (partial && Object.keys(values).length === 0 && Object.keys(fields).length === 0) {
    fields.request = '수정할 값을 입력해 주세요.'
  }
  return { fields, values }
}

export const listMarketItems = async (request: Request, url: URL) => {
  const page = positiveInteger(url.searchParams.get('page'), 1)
  const size = positiveInteger(url.searchParams.get('size'), 12, 50)
  const sort = url.searchParams.get('sort') ?? 'latest'
  const scope = url.searchParams.get('scope') ?? 'public'
  const q = (url.searchParams.get('q') ?? '').trim()
  const tag = q.startsWith('#') ? q.slice(1).trim().toLowerCase() : ''
  const category = (url.searchParams.get('category') ?? '').trim()
  const condition = url.searchParams.get('condition')
  const status = url.searchParams.get('status') ?? (scope === 'public' ? 'SELLING' : 'ALL')
  const deleted = url.searchParams.get('deleted') ?? 'exclude'
  if (!page || !size || !['latest', 'popular', 'price_asc', 'price_desc'].includes(sort) || !['public', 'mine', 'liked'].includes(scope) || !['exclude', 'only'].includes(deleted)) {
    return apiError(400, 'VALIDATION_ERROR', '목록 조건을 확인해 주세요.')
  }
  if ((condition && !conditions.includes(condition as typeof conditions[number])) || (status !== 'ALL' && !statuses.includes(status as typeof statuses[number]))) {
    return apiError(400, 'VALIDATION_ERROR', '필터 값을 확인해 주세요.')
  }

  let sellerId: number | null = null
  let likedIds: number[] | null = null
  if (scope === 'mine') {
    const session = await getSession(request)
    if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    sellerId = session.user_id
  } else if (scope === 'liked') {
    const session = await getSession(request)
    if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    const { data: likes, error: likesError } = await supabase.from('market_item_likes').select('item_id').eq('user_id', session.user_id)
    if (likesError) return apiError(500, 'INTERNAL_SERVER_ERROR', '찜한 상품을 불러오지 못했습니다.')
    likedIds = (likes ?? []).map((like: Record<string, any>) => Number(like.item_id))
    if (!likedIds.length) return json({ data: [], pagination: { page, size, totalItems: 0, totalPages: 0 } })
  } else if (status !== 'SELLING') {
    return apiError(400, 'VALIDATION_ERROR', '공개 마켓은 판매 중인 상품만 조회할 수 있습니다.')
  }

  let query = supabase.from('market_item_details').select(marketItemDetailFields, { count: 'exact' })
  query = deleted === 'only' ? query.not('deleted_at', 'is', null) : query.is('deleted_at', null)
  if (sellerId) query = query.eq('seller_id', sellerId)
  if (likedIds) query = query.in('id', likedIds)
  if (status !== 'ALL') query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (condition) query = query.eq('condition', condition)
  if (tag) {
    query = query.contains('tags', [tag])
  } else if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`)
  }
  if (sort === 'popular') query = query.order('like_count', { ascending: false }).order('created_at', { ascending: false })
  else if (sort === 'price_asc') query = query.order('price_points', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price_points', { ascending: false })
  else query = query.order('created_at', { ascending: false })
  query = query.order('id', { ascending: false })

  const from = (page - 1) * size
  const { data, count, error } = await query.range(from, from + size - 1)
  if (error) {
    console.error('Failed to list market items', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '마켓 상품을 불러오지 못했습니다.')
  }
  const totalItems = count ?? 0
  let items: Record<string, any>[]
  try { items = await marketDtos(request, data ?? []) }
  catch (error) { console.error('Failed to enrich market items', error); return apiError(500, 'INTERNAL_SERVER_ERROR', '마켓 상품을 불러오지 못했습니다.') }
  return json({
    data: items,
    pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 },
  })
}

export const createMarketItem = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = marketInput(body as Record<string, unknown>)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data, error } = await supabase.from('market_items').insert({ seller_id: session.user_id, ...values }).select(marketItemFields).single()
  if (error) {
    console.error('Failed to create market item', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 등록하지 못했습니다.')
  }
  const { data: seller } = await findSeller(session.user_id)
  return json({ data: marketItemJson(data, seller ?? undefined) }, 201)
}

export const readMarketItem = async (request: Request, id: number) => {
  const { data, error } = await findMarketItem(id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 불러오지 못했습니다.')
  if (!data || data.deleted_at) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  try { return json({ data: (await marketDtos(request, [data]))[0] }) }
  catch (error) { return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 불러오지 못했습니다.') }
}

const ownedItem = async (userId: number, id: number) => {
  const { data, error } = await findMarketItem(id)
  if (error) return { error: apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.') }
  if (!data) return { error: apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.') }
  if (data.seller_id !== userId) return { error: apiError(403, 'FORBIDDEN', '상품을 수정하거나 삭제할 권한이 없습니다.') }
  return { data }
}

export const updateMarketItem = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  if (ownership.data!.deleted_at) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  if (ownership.data!.status === 'SOLD') return apiError(409, 'SOLD_ITEM_IMMUTABLE', '판매 완료된 상품은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = marketInput(body as Record<string, unknown>, true)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data, error } = await supabase.from('market_items').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select(marketItemFields).single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 수정하지 못했습니다.')
  try { return json({ data: (await marketDtos(request, [data]))[0] }) }
  catch (error) { return apiError(500, 'INTERNAL_SERVER_ERROR', '수정된 상품을 불러오지 못했습니다.') }
}

export const replaceMarketItemImages = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  if (ownership.data!.deleted_at) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  if (ownership.data!.status === 'SOLD') return apiError(409, 'SOLD_ITEM_IMMUTABLE', '판매 완료된 상품은 수정할 수 없습니다.')
  const form = await request.formData().catch(() => null)
  const files = form?.getAll('images') ?? []
  if (files.length < 1 || files.length > 5 || files.some((file) => !(file instanceof File) || file.type !== 'image/webp' || file.size < 16 || file.size > 2 * 1024 * 1024)) {
    return apiError(400, 'INVALID_MARKET_IMAGES', 'WebP 이미지를 장당 2MB 이하, 1~5장 업로드해 주세요.')
  }
  const uploads: { path: string; bytes: Uint8Array }[] = []
  for (const value of files) {
    const file = value as File
    const bytes = new Uint8Array(await file.arrayBuffer())
    const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
    if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return apiError(400, 'INVALID_MARKET_IMAGES', '유효한 WebP 파일만 업로드할 수 있습니다.')
    uploads.push({ path: `${session.user_id}/${id}/${crypto.randomUUID()}.webp`, bytes })
  }
  const uploaded: string[] = []
  for (const image of uploads) {
    const { error } = await supabase.storage.from('market-item-images').upload(image.path, image.bytes, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
    if (error) {
      if (uploaded.length) await supabase.storage.from('market-item-images').remove(uploaded)
      return apiError(500, 'MARKET_IMAGE_UPLOAD_FAILED', '상품 이미지를 업로드하지 못했습니다.')
    }
    uploaded.push(image.path)
  }
  const { data: previous } = await supabase.from('market_item_images').select('storage_path').eq('item_id', id)
  const { error: replaceError } = await supabase.rpc('replace_market_item_images', { p_item_id: id, p_paths: uploaded })
  if (replaceError) {
    await supabase.storage.from('market-item-images').remove(uploaded)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '상품 이미지 정보를 저장하지 못했습니다.')
  }
  const previousPaths = (previous ?? []).map((image: Record<string, any>) => image.storage_path).filter((path: string) => !uploaded.includes(path))
  if (previousPaths.length) await supabase.storage.from('market-item-images').remove(previousPaths)
  const { data: rows } = await supabase.from('market_item_images').select('id,storage_path,position').eq('item_id', id).order('position')
  return json({ data: (rows ?? []).map((image: Record<string, any>) => ({ id: image.id, url: marketImageUrl(image.storage_path), position: image.position })) })
}

export const changeMarketItemLike = async (request: Request, id: number, enabled: boolean) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  if (enabled) {
    const { data: item, error: itemError } = await findMarketItem(id)
    if (itemError) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 확인하지 못했습니다.')
    if (!item || item.deleted_at || item.status !== 'SELLING') return apiError(404, 'NOT_FOUND', '판매 중인 상품을 찾을 수 없습니다.')
    const { error } = await supabase.from('market_item_likes').upsert({ user_id: session.user_id, item_id: id }, { onConflict: 'user_id,item_id', ignoreDuplicates: true })
    return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '좋아요를 저장하지 못했습니다.') : json({ data: { active: true } }, 201)
  }
  const { error } = await supabase.from('market_item_likes').delete().eq('user_id', session.user_id).eq('item_id', id)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '좋아요를 취소하지 못했습니다.') : new Response(null, { status: 204, headers: corsHeaders })
}

export const deleteMarketItem = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  const now = new Date(); const purgeAfter = new Date(now.getTime() + 30 * 86400000)
  const { error } = await supabase.from('market_items').update({ deleted_at: now.toISOString(), purge_after: purgeAfter.toISOString(), updated_at: now.toISOString() }).eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 삭제하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const restoreMarketItem = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  if (!ownership.data!.deleted_at || !ownership.data!.purge_after) return apiError(409, 'NOT_IN_TRASH', '복원할 수 있는 휴지통 상품이 아닙니다.')
  const { error } = await supabase.from('market_items').update({ deleted_at: null, purge_after: null, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 복원하지 못했습니다.')
  return json({ data: { restored: true } })
}

export const permanentlyDeleteMarketItem = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  if (!ownership.data!.deleted_at) return apiError(409, 'NOT_IN_TRASH', '휴지통에 있는 상품만 영구 삭제할 수 있습니다.')
  const { data: images } = await supabase.from('market_item_images').select('storage_path').eq('item_id', id)
  const { count } = await supabase.from('market_conversations').select('id', { count: 'exact', head: true }).eq('item_id', id)
  if (count) {
    const { error } = await supabase.from('market_items').update({ title: '[삭제된 상품]', description: '삭제된 상품입니다.', category: '삭제됨', tags: [], purge_after: null, updated_at: new Date().toISOString() }).eq('id', id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 영구 삭제하지 못했습니다.')
    await supabase.from('market_item_images').delete().eq('item_id', id)
  } else {
    const { error } = await supabase.from('market_items').delete().eq('id', id)
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 영구 삭제하지 못했습니다.')
  }
  const paths = (images ?? []).map((image: Record<string, any>) => image.storage_path)
  if (paths.length) await supabase.storage.from('market-item-images').remove(paths)
  return new Response(null, { status: 204, headers: corsHeaders })
}
