import { apiError, corsHeaders, getSession, getSessionHash, json, requireCsrfSession, supabase, supabaseUrl } from './shared.ts'

const bannerDto = (banner: Record<string, any>) => ({
  id: banner.id, eyebrow: banner.eyebrow, title: banner.title, description: banner.description,
  imageUrl: banner.image_url, ctaLabel: banner.cta_label, ctaUrl: banner.cta_url,
  startsAt: banner.starts_at, endsAt: banner.ends_at, position: banner.position,
  isActive: banner.is_active, createdAt: banner.created_at, updatedAt: banner.updated_at,
})

export const getHome = async (request: Request) => {
  const sessionHash = await getSessionHash(request)
  const storageBase = `${supabaseUrl}/storage/v1/object/public/market-item-images`
  const { data, error } = await supabase.rpc('get_home_payload', {
    p_session_hash: sessionHash,
    p_storage_base: storageBase,
  })
  if (error) {
    console.error('Failed to read home payload', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '홈 콘텐츠를 불러오지 못했습니다.')
  }
  return json({ data })
}

const requireAdmin = async (request: Request, csrf = false) => {
  const session = csrf ? await requireCsrfSession(request) : await getSession(request)
  if (!session) return { error: apiError(csrf ? 403 : 401, csrf ? 'CSRF_TOKEN_INVALID' : 'UNAUTHENTICATED', csrf ? 'CSRF 토큰이 유효하지 않습니다.' : '로그인이 필요합니다.') }
  if (!session.user_id) return { error: apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.') }
  const { data: user } = await supabase.from('users').select('role').eq('id', session.user_id).maybeSingle()
  if (user?.role !== 'ADMIN') return { error: apiError(403, 'FORBIDDEN', '운영진 권한이 필요합니다.') }
  return { session }
}

const bannerInput = (body: Record<string, unknown>, partial = false) => {
  const fields: Record<string, string> = {}; const values: Record<string, any> = {}
  const stringField = (input: string, output: string, max: number, required = false) => {
    if (!partial || Object.prototype.hasOwnProperty.call(body, input)) {
      const value = typeof body[input] === 'string' ? body[input].trim() : ''
      if ((required && !value) || value.length > max) fields[input] = `${input} 값을 확인해 주세요.`
      else values[output] = value || null
    }
  }
  stringField('eyebrow', 'eyebrow', 50)
  stringField('title', 'title', 120, true)
  stringField('description', 'description', 300)
  stringField('imageUrl', 'image_url', 2000)
  stringField('ctaLabel', 'cta_label', 40)
  stringField('ctaUrl', 'cta_url', 2000, true)
  for (const [input, output] of [['startsAt', 'starts_at'], ['endsAt', 'ends_at']] as const) {
    if (!partial || Object.prototype.hasOwnProperty.call(body, input)) {
      const raw = body[input]
      if (input === 'endsAt' && raw == null) values[output] = null
      else if (typeof raw !== 'string' || Number.isNaN(Date.parse(raw))) fields[input] = 'ISO 8601 날짜를 입력해 주세요.'
      else values[output] = new Date(raw).toISOString()
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'position')) {
    if (!Number.isInteger(body.position) || Number(body.position) < 0 || Number(body.position) > 99) fields.position = '순서는 0~99 정수여야 합니다.'
    else values.position = body.position
  } else if (!partial) values.position = 0
  if (Object.prototype.hasOwnProperty.call(body, 'isActive')) {
    if (typeof body.isActive !== 'boolean') fields.isActive = '활성 여부를 확인해 주세요.'
    else values.is_active = body.isActive
  } else if (!partial) values.is_active = true
  if (!partial) {
    values.eyebrow = values.eyebrow ?? 'NOTICE · EVENT'
    values.description = values.description ?? ''
    values.cta_label = values.cta_label ?? '자세히 보기'
  }
  if (partial && !Object.keys(values).length && !Object.keys(fields).length) fields.request = '수정할 값을 입력해 주세요.'
  return { fields, values }
}

const manageBanners = async (request: Request, id?: number) => {
  const admin = await requireAdmin(request, request.method !== 'GET')
  if (admin.error) return admin.error
  if (request.method === 'GET') {
    const { data, error } = await supabase.from('home_banners').select('*').order('position').order('id')
    return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '배너를 불러오지 못했습니다.') : json({ data: (data ?? []).map(bannerDto) })
  }
  if (request.method === 'DELETE' && id) {
    const { error } = await supabase.from('home_banners').delete().eq('id', id)
    return error ? apiError(500, 'INTERNAL_SERVER_ERROR', '배너를 삭제하지 못했습니다.') : new Response(null, { status: 204, headers: corsHeaders })
  }
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, values } = bannerInput(body, request.method === 'PATCH')
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const query = request.method === 'POST'
    ? supabase.from('home_banners').insert(values).select('*').single()
    : supabase.from('home_banners').update({ ...values, updated_at: new Date().toISOString() }).eq('id', id!).select('*').maybeSingle()
  const { data, error } = await query
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '배너를 저장하지 못했습니다.')
  if (!data) return apiError(404, 'NOT_FOUND', '배너를 찾을 수 없습니다.')
  return json({ data: bannerDto(data) }, request.method === 'POST' ? 201 : 200)
}

export const handleHomeRoute = (request: Request, path: string) => {
  if (path === '/home' && request.method === 'GET') return getHome(request)
  if (path === '/home/banners' && request.method === 'GET') return activeBanners().then(({ data, error }) => error ? apiError(500, 'INTERNAL_SERVER_ERROR', '배너를 불러오지 못했습니다.') : json({ data }))
  if (path === '/admin/home-banners') return manageBanners(request)
  const match = path.match(/^\/admin\/home-banners\/(\d+)$/)
  if (match && (request.method === 'PATCH' || request.method === 'DELETE')) return manageBanners(request, Number(match[1]))
  return null
}
