import { hashPassword, toPublicUser } from './auth.crypto.js'
import type { LoginInput, PublicUser, SignupInput } from './auth.types.js'
import { InMemoryUserRepository } from './auth.repository.js'

export class AuthError extends Error { constructor(public readonly status: number, message: string) { super(message) } }
export class AuthService {
  constructor(private readonly users: InMemoryUserRepository) {}
  signup(input: SignupInput): PublicUser { const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''; const nickname = typeof input.nickname === 'string' ? input.nickname.trim() : ''; const password = typeof input.password === 'string' ? input.password : ''; if (!/^\S+@\S+\.\S+$/.test(email)) throw new AuthError(400, '올바른 이메일을 입력해 주세요.'); if (nickname.length < 2 || nickname.length > 30) throw new AuthError(400, '닉네임은 2~30자로 입력해 주세요.'); if (password.length < 8 || password.length > 72) throw new AuthError(400, '비밀번호는 8~72자로 입력해 주세요.'); if (password !== input.passwordConfirm) throw new AuthError(400, '비밀번호가 일치하지 않습니다.'); if (this.users.findByEmail(email)) throw new AuthError(409, '이미 가입된 이메일입니다.'); return toPublicUser(this.users.create({ email, nickname, passwordHash: hashPassword(password) })) }
  login(input: LoginInput): PublicUser { const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''; const password = typeof input.password === 'string' ? input.password : ''; const user = this.users.findByEmail(email); if (!user || hashPassword(password) !== user.passwordHash) throw new AuthError(401, '이메일 또는 비밀번호가 올바르지 않습니다.'); return toPublicUser(user) }
  current(id: number | undefined): PublicUser { const user = id === undefined ? undefined : this.users.findById(id); if (!user) throw new AuthError(401, '로그인이 필요합니다.'); return toPublicUser(user) }
}
