import { createClient } from 'npm:@supabase/supabase-js@2'

export const frontendOrigin = Deno.env.get('FRONTEND_ORIGIN') ?? 'http://localhost:5173'
export const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
export const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const secureCookie = Deno.env.get('SESSION_COOKIE_SECURE') !== 'false'

export const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export const corsHeaders = {
  'Access-Control-Allow-Origin': frontendOrigin,
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-csrf-token',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  Vary: 'Origin',
}

export const responseHeaders = (extra: HeadersInit = {}) => ({
  ...corsHeaders,
  'Content-Type': 'application/json; charset=utf-8',
  ...extra,
})

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) => new Response(
  JSON.stringify(body),
  { status, headers: responseHeaders(headers) },
)

export const apiError = (status: number, code: string, message: string, fields?: Record<string, string>) =>
  json({ error: { code, message, ...(fields ? { fields } : {}) } }, status)

export const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const readCookie = (request: Request, name: string) => {
  const cookies = request.headers.get('cookie') ?? ''
  for (const item of cookies.split(';')) {
    const [key, ...parts] = item.trim().split('=')
    if (key === name) return decodeURIComponent(parts.join('='))
  }
  return null
}

export const sessionCookie = (sessionId: string) => {
  const parts = [`session_id=${encodeURIComponent(sessionId)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=604800']
  if (secureCookie) parts.push('Secure')
  return parts.join('; ')
}

export const expiredSessionCookie = () => {
  const parts = ['session_id=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0']
  if (secureCookie) parts.push('Secure')
  return parts.join('; ')
}

export type Session = {
  session_hash: string
  user_id: number | null
  csrf_token: string
  expires_at: string
  sessionId: string
  sessionHash: string
}

export const getSession = async (request: Request): Promise<Session | null> => {
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

export const requireCsrfSession = async (request: Request) => {
  const session = await getSession(request)
  const csrfToken = request.headers.get('x-csrf-token')
  if (!session || !csrfToken || session.csrf_token !== csrfToken) return null
  return session
}
