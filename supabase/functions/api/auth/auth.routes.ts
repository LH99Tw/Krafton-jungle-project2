import { issueCsrfToken, login, logout, me, signup } from './auth.service.ts'

export const handleAuthRoute = (request: Request, path: string) => {
  if (request.method === 'GET' && path === '/auth/csrf') return issueCsrfToken(request)
  if (request.method === 'POST' && path === '/auth/signup') return signup(request)
  if (request.method === 'POST' && path === '/auth/login') return login(request)
  if (request.method === 'POST' && path === '/auth/logout') return logout(request)
  if (request.method === 'GET' && path === '/me') return me(request)
  return null
}
