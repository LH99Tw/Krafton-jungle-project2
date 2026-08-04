import { Router } from 'express'
import type { AuthController } from './auth.controller.js'
export const createAuthRouter = (controller: AuthController) => { const router = Router(); router.get('/csrf', controller.csrf); router.post('/signup', controller.signup); router.post('/login', controller.login); router.post('/logout', controller.logout); return router }
