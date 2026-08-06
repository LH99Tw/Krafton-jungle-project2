import { apiError, getSession, json, requireCsrfSession, supabase } from './shared.ts'

const positiveInteger = (value: string | null, fallback: number, max: number) => {
  if (value === null) return fallback
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 && parsed <= max ? parsed : null
}

const notificationJson = (row: Record<string, any>, actor: Record<string, any>, post: Record<string, any>) => ({
  id: row.id,
  type: row.type,
  actor: { id: actor.id, nickname: actor.nickname },
  post: { id: post.id, title: post.title },
  commentId: row.comment_id,
  read: Boolean(row.read_at),
  readAt: row.read_at,
  createdAt: row.created_at,
})

const listNotifications = async (request: Request, url: URL) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const page = positiveInteger(url.searchParams.get('page'), 1, 10000)
  const size = positiveInteger(url.searchParams.get('size'), 20, 100)
  if (!page || !size) return apiError(400, 'VALIDATION_ERROR', '페이지 값을 확인해 주세요.')
  const from = (page - 1) * size
  const [rowsResult, unreadResult] = await Promise.all([
    supabase.from('notifications').select('*', { count: 'exact' }).eq('recipient_id', session.user_id).order('created_at', { ascending: false }).order('id', { ascending: false }).range(from, from + size - 1),
    supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', session.user_id).is('read_at', null),
  ])
  if (rowsResult.error || unreadResult.error) return apiError(500, 'INTERNAL_SERVER_ERROR', '알림을 불러오지 못했습니다.')
  const rows = rowsResult.data ?? []
  const actorIds = [...new Set(rows.map((row: Record<string, any>) => row.actor_id))]
  const postIds = [...new Set(rows.map((row: Record<string, any>) => row.post_id))]
  const [actorsResult, postsResult] = await Promise.all([
    actorIds.length ? supabase.from('users').select('id,nickname').in('id', actorIds) : Promise.resolve({ data: [], error: null }),
    postIds.length ? supabase.from('posts').select('id,title').in('id', postIds) : Promise.resolve({ data: [], error: null }),
  ])
  if (actorsResult.error || postsResult.error) return apiError(500, 'INTERNAL_SERVER_ERROR', '알림 정보를 불러오지 못했습니다.')
  const actorMap = new Map((actorsResult.data ?? []).map((actor: Record<string, any>) => [actor.id, actor]))
  const postMap = new Map((postsResult.data ?? []).map((post: Record<string, any>) => [post.id, post]))
  const totalItems = rowsResult.count ?? 0
  return json({ data: {
    items: rows.map((row: Record<string, any>) => notificationJson(row, actorMap.get(row.actor_id) ?? { id: row.actor_id, nickname: '알 수 없음' }, postMap.get(row.post_id) ?? { id: row.post_id, title: '삭제된 글' })),
    unreadCount: unreadResult.count ?? 0,
    pagination: { page, size, totalItems, totalPages: totalItems ? Math.ceil(totalItems / size) : 0 },
  } })
}

const readNotification = async (request: Request, id: number) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const { data, error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id).eq('recipient_id', session.user_id).select('id').maybeSingle()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '알림을 읽음 처리하지 못했습니다.')
  return data ? json({ data: { id, read: true } }) : apiError(404, 'NOT_FOUND', '알림을 찾을 수 없습니다.')
}

const readAllNotifications = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const { error } = await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', session.user_id).is('read_at', null)
  return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '알림을 읽음 처리하지 못했습니다.') : json({ data: { read: true } })
}

export const handleNotificationRoute = (request: Request, path: string, url: URL) => {
  if (path === '/notifications' && request.method === 'GET') return listNotifications(request, url)
  if (path === '/notifications/read-all' && request.method === 'PATCH') return readAllNotifications(request)
  const match = path.match(/^\/notifications\/(\d+)\/read$/)
  if (match && request.method === 'PATCH') return readNotification(request, Number(match[1]))
  return null
}
