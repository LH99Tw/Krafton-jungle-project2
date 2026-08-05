import { apiError, getSession, json, requireCsrfSession, supabase } from '../shared.ts'
import { findMarketItem } from './market.repository.ts'

const conversationJson = (item: Record<string, any>) => ({
  id: item.id,
  itemId: item.item_id,
  buyerId: item.buyer_id,
  sellerId: item.seller_id,
  createdAt: item.created_at,
  updatedAt: item.updated_at,
})

const requireParticipant = async (request: Request, id: number, csrf = false) => {
  const session = csrf ? await requireCsrfSession(request) : await getSession(request)
  if (!session) return { error: apiError(csrf ? 403 : 401, csrf ? 'CSRF_TOKEN_INVALID' : 'UNAUTHENTICATED', csrf ? 'CSRF 토큰이 유효하지 않습니다.' : '로그인이 필요합니다.') }
  if (!session.user_id) return { error: apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.') }
  const { data, error } = await supabase.from('market_conversations').select('*').eq('id', id).maybeSingle()
  if (error) return { error: apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 불러오지 못했습니다.') }
  if (!data) return { error: apiError(404, 'NOT_FOUND', '채팅방을 찾을 수 없습니다.') }
  if (data.buyer_id !== session.user_id && data.seller_id !== session.user_id) return { error: apiError(403, 'FORBIDDEN', '채팅방에 접근할 권한이 없습니다.') }
  return { session, conversation: data }
}

export const startConversation = async (request: Request, itemId: number) => {
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  if (!session.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data: item, error } = await findMarketItem(itemId)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '상품을 불러오지 못했습니다.')
  if (!item) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  if (item.seller_id === session.user_id) return apiError(400, 'SELF_CHAT_NOT_ALLOWED', '내 상품에는 채팅을 시작할 수 없습니다.')
  const { data, error: createError } = await supabase.from('market_conversations').upsert({
    item_id: item.id,
    buyer_id: session.user_id,
    seller_id: item.seller_id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'item_id,buyer_id' }).select('*').single()
  if (createError) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 만들지 못했습니다.')
  return json({ data: conversationJson(data) }, 201)
}

export const listConversations = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.from('market_conversations').select('*')
    .or(`buyer_id.eq.${session.user_id},seller_id.eq.${session.user_id}`)
    .order('updated_at', { ascending: false })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅 목록을 불러오지 못했습니다.')
  return json({ data: (data ?? []).map(conversationJson) })
}

export const listMessages = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId)
  if (access.error) return access.error
  const { data, error } = await supabase.from('market_messages').select('id, conversation_id, sender_id, body, read_at, created_at')
    .eq('conversation_id', conversationId).order('id', { ascending: true }).limit(200)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '메시지를 불러오지 못했습니다.')
  return json({ data: (data ?? []).map((message: Record<string, any>) => ({
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    body: message.body,
    readAt: message.read_at,
    createdAt: message.created_at,
  })) })
}

export const sendMessage = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const body = await request.json().catch(() => null)
  const message = body && typeof body === 'object' && !Array.isArray(body) && typeof body.body === 'string' ? body.body.trim() : ''
  if (!message || message.length > 1000) return apiError(400, 'VALIDATION_ERROR', '메시지는 1~1,000자로 입력해 주세요.', { body: '메시지 길이를 확인해 주세요.' })
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('market_messages').insert({
    conversation_id: conversationId,
    sender_id: access.session!.user_id,
    body: message,
  }).select('id, conversation_id, sender_id, body, read_at, created_at').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '메시지를 보내지 못했습니다.')
  await supabase.from('market_conversations').update({ updated_at: now }).eq('id', conversationId)
  return json({ data: { id: data.id, conversationId: data.conversation_id, senderId: data.sender_id, body: data.body, readAt: data.read_at, createdAt: data.created_at } }, 201)
}
