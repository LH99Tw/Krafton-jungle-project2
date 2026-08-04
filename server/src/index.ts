import cors from 'cors'
import express from 'express'
import { createAuthRouter } from './auth/auth.router.js'
import { AuthController } from './auth/auth.controller.js'
import { InMemoryUserRepository } from './auth/auth.repository.js'
import { AuthService } from './auth/auth.service.js'
import { SessionService } from './auth/session.service.js'

const app = express()
const port = Number(process.env.PORT ?? 4000)
const users = new InMemoryUserRepository()
const sessions = new SessionService()
const auth = new AuthController(new AuthService(users), sessions)

app.use(cors({ origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5175', credentials: true }))
app.use(express.json())
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'tistory-api' }))
app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'tistory-api' }))
app.use('/api/auth', createAuthRouter(auth))
app.get('/api/me', auth.me)

app.listen(port, '0.0.0.0', () => console.log(`tistory-api listening on ${port}`))
