import { apiError, corsHeaders, getSession, json, requireCsrfSession, supabase } from '../shared.ts'
import { findMarketItem, findSeller, marketItemFields } from './market.repository.ts'

const conditions = ['NEW', 'LIKE_NEW', 'USED'] as const
const statuses = ['SELLING', 'RESERVED', 'SOLD'] as const

const positiveInteger = (value: string | null, fallback: number, max?: number) => {
  if (value === null) return fallback
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 1 || (max !== undefined && parsed > max)) return null
  return parsed
}

const itemJson = (item: Record<string, any>, seller?: Record<string, any>) => ({
  id: item.id,
  url: `/market/${item.id}`,
  seller: seller ?? { id: item.seller_id, nickname: item.seller_nickname },
  title: item.title,
  description: item.description,
  category: item.category,
  condition: item.condition,
  pricePoints: item.price_points,
  status: item.status,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const marketInput = (body: Record<string, unknown>, partial = false) => {
  const fields: Record<string, string> = {}
  const values: Record<string, string | number> = {}
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
  const category = (url.searchParams.get('category') ?? '').trim()
  const condition = url.searchParams.get('condition')
  const status = url.searchParams.get('status') ?? (scope === 'public' ? 'SELLING' : 'ALL')
  if (!page || !size || !['latest', 'price_asc', 'price_desc'].includes(sort) || !['public', 'mine'].includes(scope)) {
    return apiError(400, 'VALIDATION_ERROR', '목록 조건을 확인해 주세요.')
  }
  if ((condition && !conditions.includes(condition as typeof conditions[number])) || (status !== 'ALL' && !statuses.includes(status as typeof statuses[number]))) {
    return apiError(400, 'VALIDATION_ERROR', '필터 값을 확인해 주세요.')
  }

  let sellerId: number | null = null
  if (scope === 'mine') {
    const session = await getSession(request)
    if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
    sellerId = session.user_id
  } else if (status !== 'SELLING') {
    return apiError(400, 'VALIDATION_ERROR', '공개 마켓은 판매 중인 상품만 조회할 수 있습니다.')
  }

  let query = supabase.from('market_items').select(marketItemFields, { count: 'exact' })
  if (sellerId) query = query.eq('seller_id', sellerId)
  if (status !== 'ALL') query = query.eq('status', status)
  if (category) query = query.eq('category', category)
  if (condition) query = query.eq('condition', condition)
  if (q) {
    const safe = q.replaceAll(',', ' ')
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%,category.ilike.%${safe}%`)
  }
  if (sort === 'price_asc') query = query.order('price_points', { ascending: true })
  else if (sort === 'price_desc') query = query.order('price_points', { ascending: false })
  else query = query.order('created_at', { ascending: false })
  query = query.order('id', { ascending: false })

  const from = (page - 1) * size
  const { data, count, error } = await query.range(from, from + size - 1)
  if (error) {
    console.error('Failed to list market items', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '마켓 상품을 불러오지 못했습니다.')
  }
  const sellerIds = [...new Set((data ?? []).map((item: Record<string, any>) => item.seller_id))]
  const { data: sellers } = sellerIds.length
    ? await supabase.from('users').select('id, nickname').in('id', sellerIds)
    : { data: [] }
  const sellerMap = new Map((sellers ?? []).map((seller: Record<string, any>) => [seller.id, seller]))
  const totalItems = count ?? 0
  return json({
    data: (data ?? []).map((item: Record<string, any>) => itemJson(item, sellerMap.get(item.seller_id))),
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
  return json({ data: itemJson(data, seller ?? undefined) }, 201)
}

export const readMarketItem = async (id: number) => {
  const { data, error } = await findMarketItem(id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 불러오지 못했습니다.')
  if (!data) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  const { data: seller } = await findSeller(data.seller_id)
  return json({ data: itemJson(data, seller ?? undefined) })
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
  if (ownership.data!.status === 'SOLD') return apiError(409, 'SOLD_ITEM_IMMUTABLE', '판매 완료된 상품은 수정할 수 없습니다.')
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = marketInput(body as Record<string, unknown>, true)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const { data, error } = await supabase.from('market_items').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id).select(marketItemFields).single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 수정하지 못했습니다.')
  const { data: seller } = await findSeller(session.user_id)
  return json({ data: itemJson(data, seller ?? undefined) })
}

export const deleteMarketItem = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const ownership = await ownedItem(session.user_id, id)
  if (ownership.error) return ownership.error
  if (ownership.data!.status === 'SOLD') return apiError(409, 'SOLD_ITEM_IMMUTABLE', '판매 완료된 상품은 삭제할 수 없습니다.')
  const { error } = await supabase.from('market_items').delete().eq('id', id)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 삭제하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}
