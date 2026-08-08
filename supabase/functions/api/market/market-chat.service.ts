import { apiError, getSession, json, requireCsrfSession, supabase, supabaseUrl } from '../shared.ts'
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
    buyer_left_at: null,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'item_id,buyer_id' }).select('*').single()
  if (createError) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 만들지 못했습니다.')
  return json({ data: conversationJson(data) }, 201)
}

export const listConversations = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.rpc('get_market_chat_conversations', { p_user_id: session.user_id })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅 목록을 불러오지 못했습니다.')
  return json({ data: (data ?? []).map((item: Record<string, any>) => ({
    ...conversationJson(item),
    item: item.item_id ? { id: item.item_id, title: item.item_title } : null,
    peer: item.peer_id ? {
      id: item.peer_id,
      nickname: item.peer_nickname,
      profileImageUrl: item.peer_profile_image_path
        ? `${supabaseUrl}/storage/v1/object/public/blog-profile-images/${item.peer_profile_image_path}`
        : null,
    } : null,
    lastMessage: item.last_message_id ? {
      id: item.last_message_id,
      body: item.last_message_body,
      senderId: item.last_message_sender_id,
      createdAt: item.last_message_created_at,
    } : null,
    unreadCount: Number(item.unread_count ?? 0),
    pinnedAt: item.pinned_at ?? null,
  })) })
}

export const markConversationRead = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const { error } = await supabase.from('market_messages').update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId).neq('sender_id', access.session!.user_id).is('read_at', null)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '읽음 상태를 저장하지 못했습니다.')
  return new Response(null, { status: 204 })
}

export const listMessages = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId)
  if (access.error) return access.error
  const { data, error } = await supabase.rpc('get_market_chat_messages', {
    p_user_id: access.session!.user_id,
    p_conversation_id: conversationId,
    p_limit: 200,
  })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '메시지를 불러오지 못했습니다.')
  return json({ data: (data ?? []).map((message: Record<string, any>) => ({
    id: message.id,
    conversationId: message.conversation_id,
    senderId: message.sender_id,
    body: message.body,
    readAt: message.read_at,
    createdAt: message.created_at,
    deletedAt: message.deleted_at,
    replyTo: message.reply_to_message_id ? {
      id: message.reply_to_message_id,
      body: message.reply_body,
      senderId: message.reply_sender_id,
    } : null,
    reactions: Array.isArray(message.reactions) ? message.reactions : [],
  })) })
}

export const sendMessage = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const body = await request.json().catch(() => null)
  const message = body && typeof body === 'object' && !Array.isArray(body) && typeof body.body === 'string' ? body.body.trim() : ''
  if (!message || message.length > 1000) return apiError(400, 'VALIDATION_ERROR', '메시지는 1~1,000자로 입력해 주세요.', { body: '메시지 길이를 확인해 주세요.' })
  const replyToMessageId = body && typeof body === 'object' && !Array.isArray(body) && Number.isSafeInteger(Number(body.replyToMessageId))
    ? Number(body.replyToMessageId)
    : null
  if (replyToMessageId) {
    const { data: replied } = await supabase.from('market_messages').select('id')
      .eq('id', replyToMessageId).eq('conversation_id', conversationId).maybeSingle()
    if (!replied) return apiError(400, 'VALIDATION_ERROR', '답장할 메시지를 찾을 수 없습니다.')
  }
  const now = new Date().toISOString()
  const { data, error } = await supabase.from('market_messages').insert({
    conversation_id: conversationId,
    sender_id: access.session!.user_id,
    body: message,
    reply_to_message_id: replyToMessageId,
  }).select('id, conversation_id, sender_id, body, read_at, created_at, reply_to_message_id').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '메시지를 보내지 못했습니다.')
  await supabase.from('market_conversations').update({ updated_at: now, buyer_left_at: null, seller_left_at: null }).eq('id', conversationId)
  return json({ data: {
    id: data.id,
    conversationId: data.conversation_id,
    senderId: data.sender_id,
    body: data.body,
    readAt: data.read_at,
    createdAt: data.created_at,
    replyTo: replyToMessageId ? { id: replyToMessageId } : null,
    reactions: [],
  } }, 201)
}

const allowedReactions = new Set(['HEART', 'CHECK', 'THUMBS_UP', 'SAD', 'COOL', 'LAUGH'])

export const changeMessageReaction = async (request: Request, conversationId: number, messageId: number, active: boolean) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const body = await request.json().catch(() => null)
  const reaction = body && typeof body === 'object' && !Array.isArray(body) && typeof body.reaction === 'string' ? body.reaction : ''
  if (!allowedReactions.has(reaction)) return apiError(400, 'VALIDATION_ERROR', '지원하지 않는 반응입니다.')
  const { data: message } = await supabase.from('market_messages').select('id, deleted_at')
    .eq('id', messageId).eq('conversation_id', conversationId).maybeSingle()
  if (!message || message.deleted_at) return apiError(404, 'NOT_FOUND', '메시지를 찾을 수 없습니다.')
  if (active) {
    const { error } = await supabase.from('market_message_reactions').upsert({
      message_id: messageId, user_id: access.session!.user_id, reaction,
    }, { onConflict: 'message_id,user_id,reaction', ignoreDuplicates: true })
    if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '반응을 저장하지 못했습니다.')
    return json({ data: { active: true } }, 201)
  }
  const { error } = await supabase.from('market_message_reactions').delete()
    .eq('message_id', messageId).eq('user_id', access.session!.user_id).eq('reaction', reaction)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '반응을 취소하지 못했습니다.')
  return new Response(null, { status: 204 })
}

export const deleteMessage = async (request: Request, conversationId: number, messageId: number) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const { data, error } = await supabase.from('market_messages').update({ deleted_at: new Date().toISOString(), body: '삭제된 메시지입니다.' })
    .eq('id', messageId).eq('conversation_id', conversationId).eq('sender_id', access.session!.user_id)
    .is('deleted_at', null).select('id').maybeSingle()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '메시지를 삭제하지 못했습니다.')
  if (!data) return apiError(404, 'NOT_FOUND', '삭제할 메시지를 찾을 수 없습니다.')
  await supabase.from('market_message_reactions').delete().eq('message_id', messageId)
  return new Response(null, { status: 204 })
}

export const leaveConversation = async (request: Request, conversationId: number) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const column = access.conversation!.buyer_id === access.session!.user_id ? 'buyer_left_at' : 'seller_left_at'
  const { error } = await supabase.from('market_conversations').update({ [column]: new Date().toISOString() }).eq('id', conversationId)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방에서 나가지 못했습니다.')
  return new Response(null, { status: 204 })
}

export const pinConversation = async (request: Request, conversationId: number, pinned: boolean) => {
  const access = await requireParticipant(request, conversationId, true)
  if (access.error) return access.error
  const column = access.conversation!.buyer_id === access.session!.user_id ? 'buyer_pinned_at' : 'seller_pinned_at'
  const { error } = await supabase.from('market_conversations').update({ [column]: pinned ? new Date().toISOString() : null }).eq('id', conversationId)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방 고정 상태를 저장하지 못했습니다.')
  return new Response(null, { status: 204 })
}

export const leaveConversations = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const body = await request.json().catch(() => null)
  const ids = Array.isArray(body?.conversationIds)
    ? [...new Set(body.conversationIds.map(Number).filter((id: number) => Number.isSafeInteger(id) && id > 0))].slice(0, 100)
    : []
  if (!ids.length) return apiError(400, 'VALIDATION_ERROR', '삭제할 채팅방을 선택해 주세요.')
  const { data, error } = await supabase.from('market_conversations').select('id, buyer_id, seller_id').in('id', ids)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 확인하지 못했습니다.')
  const buyerIds = (data ?? []).filter((room) => room.buyer_id === session.user_id).map((room) => room.id)
  const sellerIds = (data ?? []).filter((room) => room.seller_id === session.user_id).map((room) => room.id)
  const now = new Date().toISOString()
  if (buyerIds.length) {
    const { error: buyerError } = await supabase.from('market_conversations').update({ buyer_left_at: now, buyer_pinned_at: null }).in('id', buyerIds)
    if (buyerError) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 삭제하지 못했습니다.')
  }
  if (sellerIds.length) {
    const { error: sellerError } = await supabase.from('market_conversations').update({ seller_left_at: now, seller_pinned_at: null }).in('id', sellerIds)
    if (sellerError) return apiError(500, 'INTERNAL_SERVER_ERROR', '채팅방을 삭제하지 못했습니다.')
  }
  return json({ data: { deletedCount: buyerIds.length + sellerIds.length } })
}
