import type { Request, Response } from 'express'
import { randomToken } from './auth.crypto.js'

type Session = { userId: number; csrfToken: string; expiresAt: number }
export class SessionService {
  private readonly sessions = new Map<string, Session>()
  private readonly maxAge = 7 * 24 * 60 * 60 * 1000
  private cookie(req: Request) { return req.headers.cookie?.split(';').map((v) => v.trim()).find((v) => v.startsWith('session_id='))?.slice(12) ?? null }
  get(req: Request) { const id = this.cookie(req); const value = id ? this.sessions.get(id) : undefined; return id && value && value.expiresAt > Date.now() ? { id, ...value } : null }
  csrf(req: Request, res: Response) { const current = this.get(req); const id = current?.id ?? randomToken(); const csrfToken = current?.csrfToken ?? randomToken(); if (!current) this.sessions.set(id, { userId: 0, csrfToken, expiresAt: Date.now() + this.maxAge }); this.setCookie(res, id); return csrfToken }
  create(userId: number, res: Response) { const id = randomToken(); this.sessions.set(id, { userId, csrfToken: randomToken(), expiresAt: Date.now() + this.maxAge }); this.setCookie(res, id) }
  validCsrf(req: Request) { const current = this.get(req); return current && current.csrfToken === req.header('x-csrf-token') }
  destroy(req: Request, res: Response) { const id = this.cookie(req); if (id) this.sessions.delete(id); res.clearCookie('session_id') }
  private setCookie(res: Response, id: string) { res.cookie('session_id', id, { httpOnly: true, sameSite: 'lax', maxAge: this.maxAge }) }
}
