import { apiError } from '../shared.ts'
import { createMarketItem, deleteMarketItem, listMarketItems, readMarketItem, updateMarketItem } from './market.service.ts'

export const handleMarketRoute = (request: Request, path: string, url: URL) => {
  if (path === '/market/items') {
    if (request.method === 'GET') return listMarketItems(request, url)
    if (request.method === 'POST') return createMarketItem(request)
  }

  const match = path.match(/^\/market\/items\/(\d+)$/)
  if (!match) return null
  const id = Number(match[1])
  if (!Number.isSafeInteger(id) || id < 1) return apiError(404, 'NOT_FOUND', '상품을 찾을 수 없습니다.')
  if (request.method === 'GET') return readMarketItem(id)
  if (request.method === 'PATCH') return updateMarketItem(request, id)
  if (request.method === 'DELETE') return deleteMarketItem(request, id)
  return null
}
