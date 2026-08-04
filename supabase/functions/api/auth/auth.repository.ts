import { supabase } from '../shared.ts'

export const saveCsrfSession = (sessionHash: string, csrfToken: string, expiresAt: string) =>
  supabase.from('sessions').upsert(
    { session_hash: sessionHash, csrf_token: csrfToken, expires_at: expiresAt, updated_at: new Date().toISOString() },
    { onConflict: 'session_hash' },
  )

export const createUser = (input: {
  email: string
  passwordHash: string
  nickname: string
  sessionHash: string
  csrfToken: string
}) => supabase.rpc('signup_user', {
  p_email: input.email,
  p_password_hash: input.passwordHash,
  p_nickname: input.nickname,
  p_session_hash: input.sessionHash,
  p_csrf_token: input.csrfToken,
})

export const findUserByEmail = (email: string) =>
  supabase.from('users').select('id, email, nickname, password_hash').eq('email', email).maybeSingle()

export const rotateUserSession = (input: {
  userId: number
  oldSessionHash: string
  newSessionHash: string
  csrfToken: string
}) => supabase.rpc('login_user_session', {
  p_user_id: input.userId,
  p_old_session_hash: input.oldSessionHash,
  p_new_session_hash: input.newSessionHash,
  p_csrf_token: input.csrfToken,
})

export const deleteSession = (sessionHash: string) =>
  supabase.from('sessions').delete().eq('session_hash', sessionHash)

export const findCurrentUser = (userId: number) =>
  supabase.from('users').select('id, email, nickname, created_at, updated_at').eq('id', userId).maybeSingle()

export const findCurrentBlog = (userId: number) =>
  supabase.from('blogs').select('id, name, slug').eq('owner_id', userId).maybeSingle()
