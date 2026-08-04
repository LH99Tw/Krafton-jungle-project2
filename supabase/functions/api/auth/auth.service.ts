import bcrypt from 'npm:bcryptjs@3.0.2'
import {
  apiError, corsHeaders, expiredSessionCookie, getSession, json, randomToken, readCookie,
  requireCsrfSession, serviceRoleKey, sessionCookie, sha256, supabaseUrl,
} from '../shared.ts'
import {
  createUser, deleteSession, findCurrentBlog, findCurrentUser, findUserByEmail,
  rotateUserSession, saveCsrfSession,
} from './auth.repository.ts'

type SignupBody = { email?: unknown; nickname?: unknown; password?: unknown; passwordConfirm?: unknown }
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  return { fields, email, nickname, password }
}

export const issueCsrfToken = async (request: Request) => {
  if (!supabaseUrl || !serviceRoleKey) return apiError(500, 'INTERNAL_SERVER_ERROR', '서버 설정을 확인해 주세요.')
  const sessionId = readCookie(request, 'session_id') ?? randomToken()
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
  const { fields, email, nickname, password } = validateSignup(body)
  if (Object.keys(fields).length) return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  const sessionId = readCookie(request, 'session_id')
  const csrfToken = request.headers.get('x-csrf-token')
  if (!sessionId || !csrfToken) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  const { data, error } = await createUser({ email, nickname, csrfToken, sessionHash: await sha256(sessionId), passwordHash: await bcrypt.hash(password, 12) })
  if (error) {
    if (error.code === '23505') return apiError(409, 'EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.')
    if (error.message?.includes('CSRF_TOKEN_INVALID')) return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  const user = data?.[0]
  if (!user) return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return json({ data: { user: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.created_at, updatedAt: user.updated_at }, message: '회원가입이 완료되었습니다.' } }, 201, { 'Set-Cookie': sessionCookie(sessionId) })
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
  return json({ data: { user: { id: user.id, email: user.email, nickname: user.nickname }, message: '로그인되었습니다.' } }, 200, { 'Set-Cookie': sessionCookie(newSessionId) })
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
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data: user, error } = await findCurrentUser(session.user_id)
  if (error || !user) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const { data: blog, error: blogError } = await findCurrentBlog(user.id)
  if (blogError && blogError.code !== '42P01') return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  return json({ data: { user: { id: user.id, email: user.email, nickname: user.nickname, createdAt: user.created_at, updatedAt: user.updated_at }, blog: blog ?? null } })
}
