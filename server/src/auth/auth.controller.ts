import type { Request, Response } from 'express'
import { AuthError, AuthService } from './auth.service.js'
import { SessionService } from './session.service.js'

export class AuthController {
  constructor(private readonly auth: AuthService, private readonly sessions: SessionService) {}
  csrf = (req: Request, res: Response) => res.json({ data: { csrfToken: this.sessions.csrf(req, res) } })
  signup = (req: Request, res: Response) => this.run(res, () => { if (!this.sessions.validCsrf(req)) throw new AuthError(403, 'CSRF 토큰이 유효하지 않습니다.'); const user = this.auth.signup(req.body ?? {}); this.sessions.create(user.id, res); return res.status(201).json({ data: { user } }) })
  login = (req: Request, res: Response) => this.run(res, () => { if (!this.sessions.validCsrf(req)) throw new AuthError(403, 'CSRF 토큰이 유효하지 않습니다.'); const user = this.auth.login(req.body ?? {}); this.sessions.create(user.id, res); return res.json({ data: { user } }) })
  me = (req: Request, res: Response) => this.run(res, () => res.json({ data: { user: this.auth.current(this.sessions.get(req)?.userId) } }))
  logout = (req: Request, res: Response) => { this.sessions.destroy(req, res); return res.status(204).send() }
  private run(res: Response, handler: () => Response) { try { return handler() } catch (error) { if (error instanceof AuthError) return res.status(error.status).json({ error: { message: error.message } }); return res.status(500).json({ error: { message: '요청을 처리하지 못했습니다.' } }) } }
}
