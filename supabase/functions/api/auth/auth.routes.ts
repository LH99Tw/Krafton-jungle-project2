import { changePassword, decideThirdPartyConsent, issueCsrfToken, login, logout, me, signup, updateInterests, updateNickname, withdrawAccount } from './auth.service.ts'

export const handleAuthRoute = (request: Request, path: string) => {
  if (request.method === 'GET' && path === '/auth/csrf') return issueCsrfToken(request)
  if (request.method === 'POST' && path === '/auth/signup') return signup(request)
  if (request.method === 'PATCH' && path === '/auth/interests') return updateInterests(request)
  if (request.method === 'PATCH' && path === '/auth/profile') return updateNickname(request)
  if (request.method === 'POST' && path === '/auth/login') return login(request)
  if (request.method === 'POST' && path === '/auth/logout') return logout(request)
  if (request.method === 'POST' && path === '/auth/change-password') return changePassword(request)
  if (request.method === 'DELETE' && path === '/me') return withdrawAccount(request)
  if (request.method === 'POST' && path === '/me/third-party-consent') return decideThirdPartyConsent(request)
  if (request.method === 'GET' && path === '/me') return me(request)
  return null
}
