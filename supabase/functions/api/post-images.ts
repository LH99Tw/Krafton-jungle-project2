import { apiError, corsHeaders, json, requireCsrfSession, supabase, supabaseUrl } from './shared.ts'

const MAX_IMAGES = 5
const imageUrl = (path: string) => `${supabaseUrl}/storage/v1/object/public/post-images/${path}`

export type RichDocument = { type: 'doc'; content?: RichNode[] }
type RichNode = { type: string; attrs?: Record<string, unknown>; content?: RichNode[]; text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> }

const allowedNodes = new Set(['doc', 'paragraph', 'heading', 'text', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'horizontalRule', 'hardBreak', 'richImage', 'imageGroup'])
const allowedMarks = new Set(['bold', 'italic', 'strike', 'highlight', 'code', 'link'])

export const validateRichDocument = (value: unknown) => {
  const imageIds: string[] = []
  const visit = (node: unknown, depth: number, inGroup = false): boolean => {
    if (!node || typeof node !== 'object' || Array.isArray(node) || depth > 30) return false
    const item = node as RichNode
    if (!allowedNodes.has(item.type)) return false
    if (item.type === 'text' && typeof item.text !== 'string') return false
    if (item.marks && (!Array.isArray(item.marks) || item.marks.some((mark) => !mark || !allowedMarks.has(mark.type) || (mark.type === 'link' && (typeof mark.attrs?.href !== 'string' || !/^(https?:\/\/|mailto:)/i.test(mark.attrs.href)))))) return false
    if (item.type === 'heading' && ![1, 2, 3].includes(Number(item.attrs?.level))) return false
    if (item.type === 'richImage') {
      const id = item.attrs?.imageId
      if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || typeof item.attrs?.src !== 'string' || !String(item.attrs.src).startsWith(`${supabaseUrl}/storage/v1/object/public/post-images/`)) return false
      if (!['left', 'center', 'right'].includes(String(item.attrs?.align)) || Number(item.attrs?.width) < 25 || Number(item.attrs?.width) > 100) return false
      imageIds.push(id)
    }
    if (item.type === 'imageGroup') {
      if (inGroup || !Array.isArray(item.content) || item.content.length < 2 || item.content.length > 3 || item.content.some((child) => child.type !== 'richImage')) return false
      return item.content.every((child) => visit(child, depth + 1, true))
    }
    return !item.content || (Array.isArray(item.content) && item.content.every((child) => visit(child, depth + 1, inGroup)))
  }
  if (!visit(value, 0) || (value as RichNode).type !== 'doc' || imageIds.length > MAX_IMAGES || new Set(imageIds).size !== imageIds.length) {
    return { valid: false, imageIds: [] as string[] }
  }
  return { valid: true, imageIds }
}

export const claimPostImages = async (ownerId: number, postId: number, draftKey: string, imageIds: string[]) => {
  const { data, error } = imageIds.length ? await supabase.from('post_images').select('id,post_id,draft_key').eq('owner_id', ownerId).in('id', imageIds) : { data: [], error: null }
  if (error || (data ?? []).length !== imageIds.length || (data ?? []).some((image: Record<string, unknown>) => image.post_id && Number(image.post_id) !== postId) || (data ?? []).some((image: Record<string, unknown>) => !image.post_id && image.draft_key !== draftKey)) {
    return { error: '현재 글에 업로드한 이미지만 사용할 수 있습니다.' }
  }
  if (imageIds.length) {
    const { error: updateError } = await supabase.from('post_images').update({ post_id: postId }).eq('owner_id', ownerId).in('id', imageIds)
    if (updateError) return { error: '이미지를 글에 연결하지 못했습니다.' }
  }
  const { data: stale } = await supabase.from('post_images').select('id,storage_path').eq('owner_id', ownerId).eq('post_id', postId)
  const unused = (stale ?? []).filter((image: Record<string, unknown>) => !imageIds.includes(String(image.id)))
  if (unused.length) {
    await supabase.storage.from('post-images').remove(unused.map((image: Record<string, unknown>) => String(image.storage_path)))
    await supabase.from('post_images').delete().in('id', unused.map((image: Record<string, unknown>) => String(image.id)))
  }
  return { error: '' }
}

export const purgePostImages = async (postId: number) => {
  const { data } = await supabase.from('post_images').select('storage_path').eq('post_id', postId)
  if (data?.length) await supabase.storage.from('post-images').remove(data.map((image: Record<string, unknown>) => String(image.storage_path)))
}

const upload = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const form = await request.formData().catch(() => null)
  const file = form?.get('file'); const draftKey = String(form?.get('draftKey') ?? '')
  const width = Number(form?.get('width')); const height = Number(form?.get('height'))
  if (!(file instanceof File) || file.type !== 'image/webp' || file.size < 16 || file.size > 2 * 1024 * 1024 || !/^[0-9a-f-]{36}$/i.test(draftKey) || !Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) {
    return apiError(400, 'INVALID_POST_IMAGE', '2MB 이하의 유효한 WebP 이미지를 업로드해 주세요.')
  }
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: expired } = await supabase.from('post_images').select('id,storage_path').eq('owner_id', session.user_id).is('post_id', null).lt('created_at', cutoff).limit(50)
  if (expired?.length) {
    await supabase.storage.from('post-images').remove(expired.map((image: Record<string, unknown>) => String(image.storage_path)))
    await supabase.from('post_images').delete().in('id', expired.map((image: Record<string, unknown>) => String(image.id)))
  }
  const { count } = await supabase.from('post_images').select('id', { count: 'exact', head: true }).eq('owner_id', session.user_id).eq('draft_key', draftKey)
  if ((count ?? 0) >= MAX_IMAGES) return apiError(409, 'POST_IMAGE_LIMIT', '글에는 이미지를 최대 5장까지 넣을 수 있습니다.')
  const bytes = new Uint8Array(await file.arrayBuffer())
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 12) !== 'WEBP') return apiError(400, 'INVALID_POST_IMAGE', '유효한 WebP 파일이 아닙니다.')
  const id = crypto.randomUUID(); const path = `${session.user_id}/${draftKey}/${id}.webp`
  const { error: uploadError } = await supabase.storage.from('post-images').upload(path, bytes, { contentType: 'image/webp', cacheControl: '31536000', upsert: false })
  if (uploadError) return apiError(500, 'POST_IMAGE_UPLOAD_FAILED', '이미지를 업로드하지 못했습니다.')
  const { error } = await supabase.from('post_images').insert({ id, owner_id: session.user_id, draft_key: draftKey, storage_path: path, width, height, byte_size: file.size })
  if (error) { await supabase.storage.from('post-images').remove([path]); return apiError(500, 'POST_IMAGE_UPLOAD_FAILED', '이미지를 저장하지 못했습니다.') }
  return json({ data: { id, url: imageUrl(path), width, height } }, 201)
}

const remove = async (request: Request, id: string) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const { data } = await supabase.from('post_images').select('storage_path,post_id').eq('id', id).eq('owner_id', session.user_id).maybeSingle()
  if (!data) return apiError(404, 'NOT_FOUND', '이미지를 찾을 수 없습니다.')
  if (data.post_id) return apiError(409, 'IMAGE_IN_USE', '저장된 글의 이미지는 글을 저장할 때 정리됩니다.')
  await supabase.storage.from('post-images').remove([data.storage_path])
  await supabase.from('post_images').delete().eq('id', id).eq('owner_id', session.user_id)
  return new Response(null, { status: 204, headers: corsHeaders })
}

export const handlePostImageRoute = (request: Request, path: string) => {
  if (path === '/posts/images' && request.method === 'POST') return upload(request)
  const match = path.match(/^\/posts\/images\/([0-9a-f-]{36})$/i)
  if (match && request.method === 'DELETE') return remove(request, match[1])
  return null
}
