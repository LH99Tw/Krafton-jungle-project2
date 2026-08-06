import { apiError, getSession, json, requireCsrfSession, supabase } from '../shared.ts'

const transactionJson = (row: Record<string, any>) => ({
  id: row.id,
  orderId: row.order_id,
  type: row.type,
  amount: row.amount,
  balanceAfter: row.balance_after,
  createdAt: row.created_at,
})

const orderJson = (row: Record<string, any>) => ({
  id: row.id,
  itemId: row.item_id,
  buyerId: row.buyer_id,
  sellerId: row.seller_id,
  pricePoints: row.price_points,
  status: row.status,
  paidAt: row.paid_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  item: row.item ? {
    id: row.item.id,
    title: row.item.title,
    imageUrls: row.item.image_urls ?? [],
    status: row.item.status,
  } : undefined,
})

export const readWallet = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data: wallet, error } = await supabase.from('wallets').select('balance, updated_at').eq('user_id', session.user_id).maybeSingle()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '포인트 지갑을 불러오지 못했습니다.')
  if (!wallet) return apiError(404, 'WALLET_NOT_FOUND', '포인트 지갑이 없습니다. 마이그레이션 적용 여부를 확인해 주세요.')
  const { data: transactions, error: historyError } = await supabase.from('wallet_transactions')
    .select('id, order_id, type, amount, balance_after, created_at').eq('user_id', session.user_id)
    .order('id', { ascending: false }).limit(50)
  if (historyError) return apiError(500, 'INTERNAL_SERVER_ERROR', '포인트 내역을 불러오지 못했습니다.')
  return json({ data: { balance: wallet.balance, updatedAt: wallet.updated_at, transactions: (transactions ?? []).map(transactionJson) } })
}

export const chargeWallet = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const body = await request.json().catch(() => null)
  const amount = body && typeof body === 'object' && !Array.isArray(body) ? Number(body.amount) : 0
  if (![10000, 50000, 100000].includes(amount)) return apiError(400, 'VALIDATION_ERROR', '충전 포인트를 확인해 주세요.')
  const { data, error } = await supabase.rpc('charge_wallet_points', { p_user_id: session.user_id, p_amount: amount })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '포인트를 충전하지 못했습니다.')
  return json({ data: { balance: data } }, 201)
}

export const purchaseItem = async (request: Request, itemId: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.rpc('purchase_market_item', { p_item_id: itemId, p_buyer_id: session.user_id }).single()
  if (error) {
    if (error.message.includes('ITEM_NOT_FOUND')) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
    if (error.message.includes('SELF_PURCHASE_NOT_ALLOWED')) return apiError(400, 'SELF_PURCHASE_NOT_ALLOWED', '내 상품은 구매할 수 없습니다.')
    if (error.message.includes('ITEM_NOT_AVAILABLE')) return apiError(409, 'ITEM_NOT_AVAILABLE', '이미 판매되었거나 거래할 수 없는 상품입니다.')
    if (error.message.includes('INSUFFICIENT_POINTS')) return apiError(409, 'INSUFFICIENT_POINTS', '포인트가 부족합니다.')
    console.error('Failed to purchase market item', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '구매를 처리하지 못했습니다.')
  }
  return json({ data: { orderId: data.order_id, balance: data.buyer_balance } }, 201)
}

export const listOrders = async (request: Request, url: URL) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const role = url.searchParams.get('role') ?? 'buyer'
  if (role !== 'buyer' && role !== 'seller') return apiError(400, 'VALIDATION_ERROR', '주문 역할을 확인해 주세요.')
  const column = role === 'buyer' ? 'buyer_id' : 'seller_id'
  const { data, error } = await supabase.from('market_orders')
    .select('*, item:market_items(id, title, image_urls, status)')
    .eq(column, session.user_id).order('id', { ascending: false }).limit(50)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '주문 내역을 불러오지 못했습니다.')
  return json({ data: (data ?? []).map(orderJson) })
}

export const completeOrder = async (request: Request, orderId: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.rpc('complete_market_order', { p_order_id: orderId, p_buyer_id: session.user_id })
  if (error) {
    if (error.message.includes('ORDER_NOT_FOUND')) return apiError(404, 'NOT_FOUND', '주문을 찾을 수 없습니다.')
    if (error.message.includes('ORDER_FORBIDDEN')) return apiError(403, 'FORBIDDEN', '이 주문을 완료할 권한이 없습니다.')
    if (error.message.includes('ORDER_NOT_COMPLETABLE')) return apiError(409, 'ORDER_NOT_COMPLETABLE', '이미 처리된 주문입니다.')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '구매 완료를 처리하지 못했습니다.')
  }
  return json({ data: orderJson(data) })
}
