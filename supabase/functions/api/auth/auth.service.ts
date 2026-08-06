import bcrypt from 'npm:bcryptjs@3.0.2'
import {
  apiError, corsHeaders, expiredSessionCookie, getSession, getSessionHash, json, randomToken, readCookie,
  requireCsrfSession, serviceRoleKey, sessionCookie, sha256, supabase, supabaseUrl,
} from '../shared.ts'
import {
  createUser, deleteSession, findCurrentBlog, findCurrentUser, findUserByEmail,
  rotateUserSession, saveCsrfSession, saveThirdPartyConsent, saveUserInterests,
} from './auth.repository.ts'

type SignupBody = { email?: unknown; nickname?: unknown; password?: unknown; passwordConfirm?: unknown; interests?: unknown }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const interestCatalog = ['보컬로이드', '마스코트', '버추얼', '소설', '게임', '애니메이션/만화', '2.5차원/3D', '작품 카테고리', '아이돌 캐릭터', '자작 캐릭터', '원작', '공식', '수집', '1차 창작', '2차 창작', '고양이상', '덤앤더머', '깐머', '수인', '흑막', '강아지상', '오드아이', '금발/백발', '신뢰&유대', '구원 서사', '스승&제자', '주종', '장발남', '순애', '삼각관계', '계약 관계', '뱀상', '흑발', '혐관', '짝사랑', '서사 중심', '콤비', '앙숙', '덮머', '햇살캐', '어른스러운', '신중한', '순수한', '별난', '다정한', '낙천적', '내성적', '폭력적인', '집착적', '애정결핍인', '위선적', '소심한', '불안정한', '냉소적', '냉담한', '쾌활한', '댕댕이', '퇴폐미', '능글맞은', '멘헤라', '얀데레', '츤데레', '정의로운']

const parseInterests = (value: unknown) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter((item) => interestCatalog.includes(item)))].slice(0, 8)
  : []

const validateInterestUpdate = (value: unknown) => {
  if (!Array.isArray(value)) return { interests: [], error: '관심분야 목록을 입력해 주세요.' }
  const normalized = value.map((item) => typeof item === 'string' ? item.trim() : '')
  if (normalized.length < 1 || normalized.length > 8) return { interests: [], error: '관심분야는 1개 이상 8개 이하로 선택해 주세요.' }
  if (normalized.some((item) => !interestCatalog.includes(item))) return { interests: [], error: '지원하지 않는 관심분야가 포함되어 있습니다.' }
  if (new Set(normalized).size !== normalized.length) return { interests: [], error: '같은 관심분야를 중복해서 선택할 수 없습니다.' }
  return { interests: normalized, error: '' }
}

const validateSignup = (body: SignupBody) => {
  const fields: Record<string, string> = {}
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const passwordConfirm = typeof body.passwordConfirm === 'string' ? body.passwordConfirm : ''
  if (!email) fields.email = '이메일을 입력해 주세요.'
  else if (email.length > 255 || !emailPattern.test(email)) fields.email = '올바른 이메일 형식이 아닙니다.'
  if (!nickname) fields.nickname = '닉네임을 입력해 주세요.'
  else if (nickname.length < 2 || nickname.length > 30) fields.nickname = '닉네임은 2~30자로 입력해 주세요.'
  if (!password) fields.password = '비밀번호를 입력해 주세요.'
  else if (password.length < 8 || password.length > 72) fields.password = '비밀번호는 8~72자로 입력해 주세요.'
  if (!passwordConfirm) fields.passwordConfirm = '비밀번호 확인을 입력해 주세요.'
  else if (password !== passwordConfirm) fields.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  const interests = parseInterests(body.interests)
  if (!interests.length) fields.interests = '관심분야를 하나 이상 선택해 주세요.'
  return { fields, email, nickname, password, interests }
}

export const issueCsrfToken = async (request: Request) => {
  if (!supabaseUrl || !serviceRoleKey) return apiError(500, 'INTERNAL_SERVER_ERROR', '서버 설정을 확인해 주세요.')
  const existing = await getSession(request)
  if (existing) {
    return json({ data: { csrfToken: existing.csrf_token } }, 200, { 'Set-Cookie': sessionCookie(existing.sessionId) })
  }
  const sessionId = randomToken()
  const csrfToken = randomToken()
  const { error } = await saveCsrfSession(
    await sha256(sessionId),
    csrfToken,
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  )
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return json({ data: { csrfToken } }, 200, { 'Set-Cookie': sessionCookie(sessionId) })
}

export const signup = async (request: Request) => {
  if (!supabaseUrl || !serviceRoleKey) return apiError(500, 'INTERNAL_SERVER_ERROR', '서버 설정을 확인해 주세요.')
  const body = await request.json().catch(() => null) as SignupBody | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const { fields, email, nickname, password, interests } = validateSignup(body)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const sessionId = readCookie(request, 'session_id')
  const csrfToken = request.headers.get('x-csrf-token')
  if (!sessionId || !csrfToken) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  const { data, error } = await createUser({ email, nickname, interests, csrfToken, sessionHash: await sha256(sessionId), passwordHash: await bcrypt.hash(password, 12) })
  if (error) {
    if (error.code === '23505') return apiError(409, 'EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.')
    if (error.message?.includes('CSRF_TOKEN_INVALID')) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const user = data?.[0]
  if (!user) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return json({ data: { user: { id: user.id, email: user.email, nickname: user.nickname, interests, createdAt: user.created_at, updatedAt: user.updated_at }, message: '회원가입이 완료되었습니다.' } }, 201, { 'Set-Cookie': sessionCookie(sessionId) })
}

export const login = async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  const input = body as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const fields: Record<string, string> = {}
  if (!email || email.length > 255 || !emailPattern.test(email)) fields.email = '올바른 이메일을 입력해 주세요.'
  if (!password) fields.password = '비밀번호를 입력해 주세요.'
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const csrfSession = await requireCsrfSession(request)
  if (!csrfSession) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  const { data: user, error } = await findUserByEmail(email)
  if (error || !user || !(await bcrypt.compare(password, user.password_hash))) return apiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
  const newSessionId = randomToken()
  const { error: sessionError } = await rotateUserSession({ userId: user.id, oldSessionHash: csrfSession.sessionHash, newSessionHash: await sha256(newSessionId), csrfToken: request.headers.get('x-csrf-token')! })
  if (sessionError) return sessionError.message?.includes('CSRF_TOKEN_INVALID')
    ? apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
    : apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  const { data: currentUser } = await findCurrentUser(user.id)
  const { data: blog } = await findCurrentBlog(user.id)
  return json({ data: { user: { id: user.id, email: user.email, nickname: user.nickname, interests: currentUser?.interests ?? [] }, blog: blog ?? null, requiresThirdPartyConsent: !user.third_party_consent_decided_at, message: '로그인되었습니다.' } }, 200, { 'Set-Cookie': sessionCookie(newSessionId) })
}

export const decideThirdPartyConsent = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const body = await request.json().catch(() => null) as { accepted?: unknown } | null
  if (!body || typeof body.accepted !== 'boolean') return apiError(400, 'VALIDATION_ERROR', '동의 여부를 확인해 주세요.')
  const { error } = await saveThirdPartyConsent(session.user_id, body.accepted)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '동의 정보를 저장하지 못했습니다.')
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const logout = async (request: Request) => {
  const sessionId = readCookie(request, 'session_id')
  if (!sessionId) return new Response(null, { status: 204, headers: { ...corsHeaders, 'Set-Cookie': expiredSessionCookie() } })
  const session = await requireCsrfSession(request)
  if (!session) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  const { error } = await deleteSession(session.sessionHash)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return new Response(null, { status: 204, headers: { ...corsHeaders, 'Set-Cookie': expiredSessionCookie() } })
}

export const me = async (request: Request) => {
  const sessionHash = await getSessionHash(request)
  if (!sessionHash) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data, error } = await supabase.rpc('get_session_context', { p_session_hash: sessionHash })
  if (error) {
    console.error('Failed to read session context', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  if (!data) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  return json({ data })
}

export const updateInterests = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const body = await request.json().catch(() => null)
  const validation = validateInterestUpdate(body?.interests)
  if (validation.error) return apiError(400, 'VALIDATION_ERROR', validation.error)
  const interests = validation.interests
  const { data, error } = await saveUserInterests(session.user_id, interests)
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '관심분야를 저장하지 못했습니다.')
  return json({ data: { interests: data.interests } })
}
