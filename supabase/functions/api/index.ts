import { createClient } from 'npm:@supabase/supabase-js@2'

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

const apiError = (status: number, code: string, message: string) =>
  json({ error: { code, message } }, status)

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
