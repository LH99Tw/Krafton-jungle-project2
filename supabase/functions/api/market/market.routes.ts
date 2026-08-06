import { apiError } from '../shared.ts'
import { changeMarketItemLike, createMarketItem, deleteMarketItem, listMarketItems, permanentlyDeleteMarketItem, readMarketItem, replaceMarketItemImages, restoreMarketItem, updateMarketItem } from './market.service.ts'
import { listConversations, listMessages, sendMessage, startConversation } from './market-chat.service.ts'
import { chargeWallet, completeOrder, listOrders, purchaseItem, readWallet } from './market-transaction.service.ts'

export const handleMarketRoute = (request: Request, path: string, url: URL) => {
  if (path === '/market/wallet' && request.method === 'GET') return readWallet(request)
  if (path === '/market/wallet/charge' && request.method === 'POST') return chargeWallet(request)
  if (path === '/market/orders' && request.method === 'GET') return listOrders(request, url)
  const completeOrderMatch = path.match(/^\/market\/orders\/(\d+)\/complete$/)
  if (completeOrderMatch && request.method === 'POST') {
    const orderId = Number(completeOrderMatch[1])
    if (!Number.isSafeInteger(orderId) || orderId < 1) return apiError(404, 'NOT_FOUND', '주문을 찾을 수 없습니다.')
    return completeOrder(request, orderId)
  }
  if (path === '/market/conversations' && request.method === 'GET') return listConversations(request)
  const conversationMatch = path.match(/^\/market\/conversations\/(\d+)\/messages$/)
  if (conversationMatch) {
    const conversationId = Number(conversationMatch[1])
    if (!Number.isSafeInteger(conversationId) || conversationId < 1) return apiError(404, 'NOT_FOUND', '채팅방을 찾을 수 없습니다.')
    if (request.method === 'GET') return listMessages(request, conversationId)
    if (request.method === 'POST') return sendMessage(request, conversationId)
  }
  const startChatMatch = path.match(/^\/market\/items\/(\d+)\/conversations$/)
  if (startChatMatch && request.method === 'POST') {
    const itemId = Number(startChatMatch[1])
    if (!Number.isSafeInteger(itemId) || itemId < 1) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
    return startConversation(request, itemId)
  }
  const purchaseMatch = path.match(/^\/market\/items\/(\d+)\/purchase$/)
  if (purchaseMatch && request.method === 'POST') {
    const itemId = Number(purchaseMatch[1])
    if (!Number.isSafeInteger(itemId) || itemId < 1) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
    return purchaseItem(request, itemId)
  }
  const restoreMatch = path.match(/^\/market\/items\/(\d+)\/restore$/)
  if (restoreMatch && request.method === 'POST') return restoreMarketItem(request, Number(restoreMatch[1]))
  const permanentMatch = path.match(/^\/market\/items\/(\d+)\/permanent$/)
  if (permanentMatch && request.method === 'DELETE') return permanentlyDeleteMarketItem(request, Number(permanentMatch[1]))
  const likeMatch = path.match(/^\/market\/items\/(\d+)\/like$/)
  if (likeMatch && (request.method === 'POST' || request.method === 'DELETE')) return changeMarketItemLike(request, Number(likeMatch[1]), request.method === 'POST')
  const imagesMatch = path.match(/^\/market\/items\/(\d+)\/images$/)
  if (imagesMatch && request.method === 'PUT') return replaceMarketItemImages(request, Number(imagesMatch[1]))
  if (path === '/market/items') {
    if (request.method === 'GET') return listMarketItems(request, url)
    if (request.method === 'POST') return createMarketItem(request)
  }

  const match = path.match(/^\/market\/items\/(\d+)$/)
  if (!match) return null
  const id = Number(match[1])
  if (!Number.isSafeInteger(id) || id < 1) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  if (request.method === 'GET') return readMarketItem(request, id)
  if (request.method === 'PATCH') return updateMarketItem(request, id)
  if (request.method === 'DELETE') return deleteMarketItem(request, id)
  return null
}
