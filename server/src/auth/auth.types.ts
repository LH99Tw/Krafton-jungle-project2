export type User = { id: number; email: string; nickname: string; passwordHash: string }
export type PublicUser = Omit<User, 'passwordHash'>
export type SignupInput = { email?: unknown; nickname?: unknown; password?: unknown; passwordConfirm?: unknown }
export type LoginInput = { email?: unknown; password?: unknown }
