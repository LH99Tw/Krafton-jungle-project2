import { createClient } from 'npm:@supabase/supabase-js@2'
import bcrypt from 'npm:bcryptjs@3.0.2'

const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? 'http://localhost:5173'
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const secureCookie = Deno.env.get('SESSION_COOKIE_SECURE') !== 'false'

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

const corsHeaders = {
  'Access-Control-Allow-Origin': frontendOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-csrf-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  Vary: 'Origin',
}

const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'Tistory API',
    version: '1.0.0',
    description: 'Tistory clone backend API deployed on Supabase Edge Functions.',
  },
  paths: {
    '/auth/signup': {
      post: {
        summary: 'Create a user and sign in',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'nickname', 'password', 'passwordConfirm'],
                properties: {
                  email: { type: 'string', format: 'email', maxLength: 255 },
                  nickname: { type: 'string', minLength: 2, maxLength: 30 },
                  password: { type: 'string', minLength: 8, maxLength: 72 },
                  passwordConfirm: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'User created and signed in' },
          '400': { description: 'Validation error' },
          '403': { description: 'Invalid CSRF token' },
          '409': { description: 'Email already exists' },
        },
      },
    },
    '/auth/login': {
      post: {
        summary: 'Sign in with email and password',
        responses: {
          '200': { description: 'Signed in' },
          '400': { description: 'Validation error' },
          '401': { description: 'Invalid credentials' },
          '403': { description: 'Invalid CSRF token' },
        },
      },
    },
    '/auth/logout': {
      post: {
        summary: 'Destroy the current session',
        responses: { '204': { description: 'Signed out' } },
      },
    },
    '/me': {
      get: {
        summary: 'Get the current user and blog',
        responses: {
          '200': { description: 'Current user' },
          '401': { description: 'Unauthenticated' },
        },
      },
    },
    '/auth/csrf': {
      get: {
        summary: 'Issue a CSRF token',
        responses: {
          '200': {
            description: 'CSRF token issued',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: { csrfToken: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health': {
      get: {
        summary: 'Check API health',
        responses: { '200': { description: 'API is healthy' } },
      },
    },
  },
}

const responseHeaders = (extra: HeadersInit = {}) => ({
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
})

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(headers),
  })

const apiError = (
  status: number,
  code: string,
  message: string,
  fields?: Record<string, string>,
) => json({ error: { code, message, ...(fields ? { fields } : {}) } }, status)

const swaggerAsset = async (path: 'swagger-ui.css' | 'swagger-ui-bundle.js') => {
  const response = await fetch(`https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.32.12/${path}`)
  return new Response(response.body, {
    status: response.status,
    headers: {
      ...corsHeaders,
      'Content-Type': path.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : 'text/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

const readCookie = (request: Request, name: string) => {
  const cookies = request.headers.get('cookie') ?? ''
  for (const item of cookies.split(';')) {
    const [key, ...parts] = item.trim().split('=')
    if (key === name) return decodeURIComponent(parts.join('='))
  }
  return null
}

const sessionCookie = (sessionId: string) => {
  const parts = [
    `session_id=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=604800',
  ]
  if (secureCookie) parts.push('Secure')
  return parts.join('; ')
}

const expiredSessionCookie = () => {
  const parts = ['session_id=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secureCookie) parts.push('Secure')
  return parts.join('; ')
}

const getSession = async (request: Request) => {
  const sessionId = readCookie(request, 'session_id')
  if (!sessionId) return null
  const sessionHash = await sha256(sessionId)
  const { data, error } = await supabase
    .from('sessions')
    .select('session_hash, user_id, csrf_token, expires_at')
    .eq('session_hash', sessionHash)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle()
  if (error) {
    console.error('Failed to read session', error)
    return null
  }
  return data ? { ...data, sessionId, sessionHash } : null
}

const requireCsrfSession = async (request: Request) => {
  const session = await getSession(request)
  const csrfToken = request.headers.get('x-csrf-token')
  if (!session || !csrfToken || session.csrf_token !== csrfToken) return null
  return session
}

type SignupBody = {
  email?: unknown
  nickname?: unknown
  password?: unknown
  passwordConfirm?: unknown
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateSignup = (body: SignupBody) => {
  const fields: Record<string, string> = {}
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const nickname = typeof body.nickname === 'string' ? body.nickname.trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  const passwordConfirm = typeof body.passwordConfirm === 'string'
    ? body.passwordConfirm
    : ''

  if (!email) fields.email = '이메일을 입력해 주세요.'
  else if (email.length > 255 || !emailPattern.test(email)) {
    fields.email = '올바른 이메일 형식이 아닙니다.'
  }

  if (!nickname) fields.nickname = '닉네임을 입력해 주세요.'
  else if (nickname.length < 2 || nickname.length > 30) {
    fields.nickname = '닉네임은 2~30자로 입력해 주세요.'
  }

  if (!password) fields.password = '비밀번호를 입력해 주세요.'
  else if (password.length < 8 || password.length > 72) {
    fields.password = '비밀번호는 8~72자로 입력해 주세요.'
  }

  if (!passwordConfirm) fields.passwordConfirm = '비밀번호 확인을 입력해 주세요.'
  else if (password !== passwordConfirm) {
    fields.passwordConfirm = '비밀번호가 일치하지 않습니다.'
  }

  return { fields, email, nickname, password }
}

const signup = async (request: Request) => {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '서버 설정을 확인해 주세요.')
  }

  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().includes('application/json')) {
    return apiError(400, 'VALIDATION_ERROR', 'JSON 요청을 보내 주세요.')
  }

  const body = await request.json().catch(() => null) as SignupBody | null
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  }

  const { fields, email, nickname, password } = validateSignup(body)
  if (Object.keys(fields).length > 0) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  }

  const sessionId = readCookie(request, 'session_id')
  const csrfToken = request.headers.get('x-csrf-token')
  if (!sessionId || !csrfToken) {
    return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  }

  const sessionHash = await sha256(sessionId)
  const passwordHash = await bcrypt.hash(password, 12)
  const { data, error } = await supabase.rpc('signup_user', {
    p_email: email,
    p_password_hash: passwordHash,
    p_nickname: nickname,
    p_session_hash: sessionHash,
    p_csrf_token: csrfToken,
  })

  if (error) {
    if (error.code === '23505') {
      return apiError(409, 'EMAIL_ALREADY_EXISTS', '이미 가입된 이메일입니다.')
    }
    if (error.message?.includes('CSRF_TOKEN_INVALID')) {
      return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
    }
    console.error('Failed to sign up user', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }

  const user = data?.[0]
  if (!user) {
    console.error('signup_user returned no user')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }

  return json({
    data: {
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      },
      message: '회원가입이 완료되었습니다.',
    },
  }, 201, { 'Set-Cookie': sessionCookie(sessionId) })
}

const login = async (request: Request) => {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.')
  }

  const input = body as Record<string, unknown>
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''
  const fields: Record<string, string> = {}
  if (!email || email.length > 255 || !emailPattern.test(email)) {
    fields.email = '올바른 이메일을 입력해 주세요.'
  }
  if (!password) fields.password = '비밀번호를 입력해 주세요.'
  if (Object.keys(fields).length > 0) {
    return apiError(400, 'VALIDATION_ERROR', '입력값을 확인해 주세요.', fields)
  }

  const csrfSession = await requireCsrfSession(request)
  if (!csrfSession) {
    return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, nickname, password_hash, created_at, updated_at')
    .eq('email', email)
    .maybeSingle()
  const validPassword = user && !error
    ? await bcrypt.compare(password, user.password_hash)
    : false
  if (!validPassword || !user) {
    return apiError(401, 'INVALID_CREDENTIALS', '이메일 또는 비밀번호가 올바르지 않습니다.')
  }

  const newSessionId = randomToken()
  const newSessionHash = await sha256(newSessionId)
  const csrfToken = request.headers.get('x-csrf-token')!
  const { error: sessionError } = await supabase.rpc('login_user_session', {
    p_user_id: user.id,
    p_old_session_hash: csrfSession.sessionHash,
    p_new_session_hash: newSessionHash,
    p_csrf_token: csrfToken,
  })
  if (sessionError) {
    if (sessionError.message?.includes('CSRF_TOKEN_INVALID')) {
      return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
    }
    console.error('Failed to create login session', sessionError)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }

  return json({ data: {
    user: { id: user.id, email: user.email, nickname: user.nickname },
    message: '로그인되었습니다.',
  } }, 200, { 'Set-Cookie': sessionCookie(newSessionId) })
}

const logout = async (request: Request) => {
  const sessionId = readCookie(request, 'session_id')
  if (!sessionId) {
    return new Response(null, { status: 204, headers: { ...corsHeaders, 'Set-Cookie': expiredSessionCookie() } })
  }

  const session = await requireCsrfSession(request)
  if (!session) {
    return apiError(403, 'CSRF_TOKEN_INVALID', 'CSRF 토큰이 유효하지 않습니다.')
  }
  const { error } = await supabase.from('sessions').delete().eq('session_hash', session.sessionHash)
  if (error) {
    console.error('Failed to delete session', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  return new Response(null, { status: 204, headers: { ...corsHeaders, 'Set-Cookie': expiredSessionCookie() } })
}

const me = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) {
    return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }
  const { data: user, error } = await supabase
    .from('users')
    .select('id, email, nickname, created_at, updated_at')
    .eq('id', session.user_id)
    .maybeSingle()
  if (error || !user) {
    return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  }
  const { data: blog, error: blogError } = await supabase
    .from('blogs')
    .select('id, name, slug')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (blogError && blogError.code !== '42P01') {
    console.error('Failed to read current blog', blogError)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }
  return json({ data: {
    user: {
      id: user.id,
      email: user.email,
      nickname: user.nickname,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    blog: blog ?? null,
  } })
}

const issueCsrfToken = async (request: Request) => {
  if (!supabaseUrl || !serviceRoleKey) {
    console.error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing')
    return apiError(500, 'INTERNAL_SERVER_ERROR', '서버 설정을 확인해 주세요.')
  }

  const existingId = readCookie(request, 'session_id')
  const sessionId = existingId ?? randomToken()
  const sessionHash = await sha256(sessionId)
  const csrfToken = randomToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase.from('sessions').upsert(
    {
      session_hash: sessionHash,
      csrf_token: csrfToken,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'session_hash' },
  )

  if (error) {
    console.error('Failed to store CSRF session', error)
    return apiError(500, 'INTERNAL_SERVER_ERROR', '요청을 처리하지 못했습니다.')
  }

  return json(
    { data: { csrfToken } },
    200,
    { 'Set-Cookie': sessionCookie(sessionId) },
  )
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  const url = new URL(request.url)
  const marker = '/functions/v1/api'
  const markerIndex = url.pathname.indexOf(marker)
  const path = markerIndex >= 0
    ? url.pathname.slice(markerIndex + marker.length) || '/'
    : url.pathname

  if (request.method === 'GET' && path === '/auth/csrf') {
    return issueCsrfToken(request)
  }

  if (request.method === 'POST' && path === '/auth/signup') {
    return signup(request)
  }

  if (request.method === 'POST' && path === '/auth/login') return login(request)
  if (request.method === 'POST' && path === '/auth/logout') return logout(request)
  if (request.method === 'GET' && path === '/me') return me(request)

  if (request.method === 'GET' && path === '/swagger-ui.css') {
    return swaggerAsset('swagger-ui.css')
  }

  if (request.method === 'GET' && path === '/swagger-ui-bundle.js') {
    return swaggerAsset('swagger-ui-bundle.js')
  }

  if (request.method === 'GET' && path === '/openapi.json') {
    return json(openApiDocument)
  }

  if (request.method === 'GET' && (path === '/docs' || path === '/docs/')) {
    return Response.redirect(
      'https://krafton-jungle-project2-client.vercel.app/api-docs.html',
      302,
    )
  }

  if (request.method === 'GET' && (path === '/health' || path === '/')) {
    return json({ status: 'ok', service: 'tistory-api', runtime: 'supabase-edge-functions' })
  }

  return apiError(404, 'NOT_FOUND', '요청한 API를 찾을 수 없습니다.')
})
