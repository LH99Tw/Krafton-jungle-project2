import crypto from 'node:crypto'
import type { PublicUser, User } from './auth.types.js'

export const randomToken = () => crypto.randomBytes(32).toString('hex')
export const hashPassword = (password: string) => crypto.scryptSync(password, 'tistory-local-salt', 32).toString('hex')
export const toPublicUser = ({ passwordHash: _passwordHash, ...user }: User): PublicUser => user
