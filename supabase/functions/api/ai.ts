import { apiError, getSession, json, requireCsrfSession, supabase } from './shared.ts'

type CharacterId = 'chiikawa' | 'hachiware' | 'usagi'

const characters: Record<CharacterId, { name: string; role: string; greeting: string; fallback: string; bible: string }> = {
  chiikawa: {
    name: '치이카와', role: '다정한 응원 친구', greeting: '와…! 만나서 반가워. 조금씩 같이 해보자…!',
    fallback: '와아… 잠깐 생각이 잘 이어지지 않지만 괜찮아. 미션은 계속 같이할 수 있어…!',
    bible: '수줍고 다정하며 짧고 조심스럽게 말한다. 작은 시도도 진심으로 칭찬하고 말줄임표와 감탄을 자연스럽게 쓴다.',
  },
  hachiware: {
    name: '하치와레', role: '긍정적인 안내 친구', greeting: '왔구나! 할 일을 하나씩 살펴보면 생각보다 금방 끝낼 수 있어.',
    fallback: '잠깐 답을 정리하지 못했어. 그래도 미션 진행은 그대로니까 다음 행동부터 같이 살펴보자!',
    bible: '밝고 친절하며 어려운 일을 순서대로 풀어 설명한다. 현실적인 다음 행동 하나를 제안하고 긍정적으로 마무리한다.',
  },
  usagi: {
    name: '우사기', role: '용감한 도전 친구', greeting: '야하—! 미션 발견! 준비됐으면 바로 출발이다!',
    fallback: '야하! 생각 회로가 잠깐 멈췄다! 하지만 미션은 계속 간다—!',
    bible: '활기차고 엉뚱하며 짧고 힘차게 말한다. 야하, 우라 같은 감탄을 가끔 쓰되 모든 문장에 반복하지 않는다.',
  },
}

const isCharacterId = (value: unknown): value is CharacterId => typeof value === 'string' && value in characters
const kstDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date())
const nextKstReset = () => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).split('-').map(Number)
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 15)).toISOString()
}

const messageJson = (row: Record<string, any>) => ({
  id: row.id,
  sender: row.role === 'USER' ? 'user' : 'ai',
  body: row.body,
  createdAt: row.created_at,
  emotion: row.emotion ?? undefined,
  source: row.status === 'FALLBACK' ? 'fallback' : row.role === 'SYSTEM' ? 'template' : 'model',
})

const missionJson = (mission: Record<string, any>, progress?: Record<string, any>) => ({
  id: mission.id,
  index: String(mission.position).padStart(2, '0'),
  title: mission.title,
  description: mission.description,
  route: mission.route,
  reward: mission.reward_points,
  status: progress?.status ?? 'AVAILABLE',
  startedAt: progress?.started_at ?? null,
  completedAt: progress?.completed_at ?? null,
})

const usageState = async (userId: number) => {
  const day = kstDate()
  const [{ data: userUsage }, { data: globalUsage }] = await Promise.all([
    supabase.from('ai_daily_user_usage').select('turn_count').eq('user_id', userId).eq('usage_date', day).maybeSingle(),
    supabase.from('ai_daily_global_usage').select('turn_count').eq('usage_date', day).maybeSingle(),
  ])
  const userCount = Number(userUsage?.turn_count ?? 0)
  const globalCount = Number(globalUsage?.turn_count ?? 0)
  return {
    userRemainingTurns: Math.max(0, 20 - userCount),
    globalRemainingTurns: Math.max(0, 200 - globalCount),
    dailyLimitResetAt: nextKstReset(),
    availability: userCount >= 20 ? 'USER_LIMITED' : globalCount >= 200 ? 'GLOBAL_LIMITED' : 'AVAILABLE',
  }
}

const state = async (request: Request) => {
  const session = await getSession(request)
  if (!session?.user_id) return apiError(401, 'UNAUTHENTICATED', '로그인이 필요합니다.')
  const userId = session.user_id
  const [{ data: profile, error: profileError }, { data: missions, error: missionError }, { data: progress, error: progressError }, { data: active }] = await Promise.all([
    supabase.from('ai_companion_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('ai_missions').select('*').eq('active', true).order('position'),
    supabase.from('ai_mission_progress').select('*').eq('user_id', userId),
    supabase.from('ai_conversations').select('*').eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle(),
  ])
  if (profileError || missionError || progressError) return apiError(500, 'INTERNAL_SERVER_ERROR', 'AI 동반자 상태를 불러오지 못했습니다.')
  let messages: Record<string, any>[] = []
  if (active) {
    const result = await supabase.from('ai_messages').select('*').eq('conversation_id', active.id).in('status', ['COMPLETED', 'FALLBACK']).order('created_at', { ascending: false }).limit(40)
    messages = (result.data ?? []).reverse()
  }
  const progressMap = new Map((progress ?? []).map((item: Record<string, any>) => [item.mission_id, item]))
  return json({ data: {
    characterId: profile?.character_id ?? null,
    consented: Boolean(profile?.consented_at),
    memorySummary: profile?.memory_summary ?? '',
    conversation: active ? { id: active.id, mode: active.mode, missionId: active.mission_id } : null,
    messages: messages.map(messageJson),
    missions: (missions ?? []).map((mission: Record<string, any>) => missionJson(mission, progressMap.get(mission.id))),
    ...(await usageState(userId)),
  } })
}

const selectCompanion = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const body = await request.json().catch(() => null)
  if (!body || !isCharacterId(body.characterId) || body.consent !== true) return apiError(400, 'VALIDATION_ERROR', '캐릭터 선택과 AI 이용 동의가 필요합니다.')
  const characterId: CharacterId = body.characterId
  const userId = session.user_id
  const now = new Date().toISOString()
  const { error } = await supabase.from('ai_companion_profiles').upsert({ user_id: userId, character_id: characterId, consented_at: now, updated_at: now }, { onConflict: 'user_id' })
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '캐릭터를 저장하지 못했습니다.')
  const { data: active } = await supabase.from('ai_conversations').select('*').eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle()
  if (active) await supabase.from('ai_conversations').update({ character_id: characterId, updated_at: now }).eq('id', active.id)
  else {
    const { data: conversation, error: conversationError } = await supabase.from('ai_conversations').insert({ user_id: userId, character_id: characterId, mode: 'GENERAL' }).select('id').single()
    if (conversationError) return apiError(500, 'INTERNAL_SERVER_ERROR', '대화를 시작하지 못했습니다.')
    await supabase.from('ai_messages').insert({ conversation_id: conversation.id, user_id: userId, role: 'SYSTEM', body: characters[characterId].greeting, status: 'COMPLETED', completed_at: now })
  }
  return state(request)
}

const startMission = async (request: Request, missionId: string) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const userId = session.user_id
  const [{ data: profile }, { data: mission }] = await Promise.all([
    supabase.from('ai_companion_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('ai_missions').select('*').eq('id', missionId).eq('active', true).maybeSingle(),
  ])
  if (!profile?.character_id || !profile.consented_at) return apiError(409, 'AI_COMPANION_REQUIRED', '먼저 AI 캐릭터를 선택해 주세요.')
  if (!mission) return apiError(404, 'AI_MISSION_NOT_FOUND', '미션을 찾을 수 없습니다.')
  const { data: completed } = await supabase.from('ai_mission_progress').select('status').eq('user_id', userId).eq('mission_id', missionId).maybeSingle()
  if (completed?.status === 'COMPLETED') return apiError(409, 'AI_MISSION_COMPLETED', '이미 완료한 미션입니다.')
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('ai_conversations').update({ status: 'PAUSED', updated_at: now }).eq('user_id', userId).eq('status', 'ACTIVE'),
    supabase.from('ai_mission_progress').update({ status: 'PAUSED', updated_at: now }).eq('user_id', userId).eq('status', 'ACTIVE'),
  ])
  const { data: conversation, error } = await supabase.from('ai_conversations').insert({ user_id: userId, character_id: profile.character_id, mode: 'MISSION', mission_id: missionId }).select('*').single()
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '미션을 시작하지 못했습니다.')
  await supabase.from('ai_mission_progress').upsert({ user_id: userId, mission_id: missionId, conversation_id: conversation.id, status: 'ACTIVE', reward_points: mission.reward_points, started_at: now, completed_at: null, updated_at: now }, { onConflict: 'user_id,mission_id' })
  await supabase.from('ai_messages').insert({ conversation_id: conversation.id, user_id: userId, role: 'SYSTEM', body: `${characters[profile.character_id as CharacterId].name}와 ‘${mission.title}’ 미션을 시작했어요. ${mission.description}`, status: 'COMPLETED', completed_at: now })
  return state(request)
}

const pauseMission = async (request: Request, missionId: string) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const userId = session.user_id
  const { data: profile } = await supabase.from('ai_companion_profiles').select('character_id').eq('user_id', userId).maybeSingle()
  if (!profile?.character_id) return apiError(409, 'AI_COMPANION_REQUIRED', '먼저 AI 캐릭터를 선택해 주세요.')
  const now = new Date().toISOString()
  await Promise.all([
    supabase.from('ai_mission_progress').update({ status: 'PAUSED', updated_at: now }).eq('user_id', userId).eq('mission_id', missionId).eq('status', 'ACTIVE'),
    supabase.from('ai_conversations').update({ status: 'PAUSED', updated_at: now }).eq('user_id', userId).eq('mission_id', missionId).eq('status', 'ACTIVE'),
  ])
  const { data: conversation } = await supabase.from('ai_conversations').insert({ user_id: userId, character_id: profile.character_id, mode: 'GENERAL' }).select('id').single()
  if (conversation) await supabase.from('ai_messages').insert({ conversation_id: conversation.id, user_id: userId, role: 'SYSTEM', body: '일반 대화로 돌아왔어요. 미션은 언제든 다시 이어갈 수 있어요.', status: 'COMPLETED', completed_at: now })
  return state(request)
}

const deleteHistory = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const userId = session.user_id
  const { error } = await supabase.from('ai_messages').delete().eq('user_id', userId).neq('status', 'PENDING')
  if (error) return apiError(500, 'INTERNAL_SERVER_ERROR', '대화 기록을 삭제하지 못했습니다.')
  await supabase.from('ai_companion_profiles').update({ memory_summary: '', updated_at: new Date().toISOString() }).eq('user_id', userId)
  return json({ data: { deleted: true } })
}

const safeMemory = (value: unknown, previous: string) => {
  if (typeof value !== 'string') return previous
  const text = value.trim().slice(0, 1000)
  if (/(비밀번호|password|쿠키|cookie|session|주민등록|카드번호|계좌)/i.test(text)) return previous
  return text
}

const parseModelReply = (content: string, previousMemory: string) => {
  try {
    const parsed = JSON.parse(content)
    const reply = typeof parsed.reply === 'string' ? parsed.reply.trim().slice(0, 1000) : ''
    if (!reply) throw new Error('empty reply')
    return { reply, emotion: typeof parsed.emotion === 'string' ? parsed.emotion.slice(0, 40) : 'warm', memorySummary: safeMemory(parsed.memorySummary, previousMemory) }
  } catch {
    const reply = content.trim().slice(0, 1000)
    return reply ? { reply, emotion: 'warm', memorySummary: previousMemory } : null
  }
}

const sendAiMessage = async (request: Request) => {
  const session = await requireCsrfSession(request)
  if (!session?.user_id) return apiError(session ? 401 : 403, session ? 'UNAUTHENTICATED' : 'CSRF_TOKEN_INVALID', session ? '로그인이 필요합니다.' : 'CSRF 토큰이 유효하지 않습니다.')
  const body = await request.json().catch(() => null)
  const text = typeof body?.body === 'string' ? body.body.trim() : ''
  const key = typeof body?.idempotencyKey === 'string' ? body.idempotencyKey.trim().slice(0, 100) : ''
  if (!text || text.length > 300 || !key) return apiError(400, 'VALIDATION_ERROR', '메시지는 1~300자로 입력해 주세요.')
  const userId = session.user_id
  const [{ data: profile }, { data: conversation }] = await Promise.all([
    supabase.from('ai_companion_profiles').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('ai_conversations').select('*').eq('user_id', userId).eq('status', 'ACTIVE').maybeSingle(),
  ])
  if (!profile?.character_id || !profile.consented_at || !conversation) return apiError(409, 'AI_COMPANION_REQUIRED', '먼저 AI 캐릭터를 선택해 주세요.')
  const { data: reservation, error: reservationError } = await supabase.rpc('reserve_ai_turn', { p_user_id: userId, p_conversation_id: conversation.id, p_body: text, p_idempotency_key: key })
  if (reservationError) return apiError(500, 'INTERNAL_SERVER_ERROR', 'AI 대화를 시작하지 못했습니다.')
  if (reservation?.status === 'USER_LIMITED') return json({ error: { code: 'AI_USER_DAILY_LIMIT', message: '오늘 나눈 대화 20회를 모두 사용했어요.', resetAt: nextKstReset() } }, 429)
  if (reservation?.status === 'GLOBAL_LIMITED') return json({ error: { code: 'AI_GLOBAL_DAILY_LIMIT', message: '오늘 준비된 AI 대화가 모두 사용됐어요. 자정 이후 다시 만나요.', resetAt: nextKstReset() } }, 429)
  if (reservation?.status === 'RATE_LIMITED') return apiError(429, 'AI_RATE_LIMIT', '메시지를 너무 빠르게 보내고 있어요. 잠시 후 다시 시도해 주세요.')
  if (reservation?.status === 'DUPLICATE') return apiError(409, 'AI_DUPLICATE_MESSAGE', '이미 처리 중이거나 전송된 메시지입니다.')
  if (reservation?.status !== 'RESERVED') return apiError(400, 'VALIDATION_ERROR', '대화를 시작할 수 없습니다.')

  const character = characters[profile.character_id as CharacterId]
  const { data: recentRows } = await supabase.from('ai_messages').select('role,body').eq('conversation_id', conversation.id).neq('status', 'FAILED').order('created_at', { ascending: false }).limit(9)
  const recent = (recentRows ?? []).reverse().filter((entry: Record<string, any>) => entry.role !== 'SYSTEM').slice(-8)
  let missionContext = '일반 대화 모드'
  if (conversation.mode === 'MISSION' && conversation.mission_id) {
    const { data: mission } = await supabase.from('ai_missions').select('title,description,route').eq('id', conversation.mission_id).maybeSingle()
    if (mission) missionContext = `미션 동행 모드: ${mission.title}. 목표: ${mission.description}. 다음 화면: ${mission.route}`
  }
  const systemPrompt = `너는 ${character.name}, ${character.role}다. ${character.bible}\n${missionContext}\n사용자가 실제로 저장·발행·구매했다고 확인되지 않으면 완료했다고 말하지 마라. 사용자의 결정을 대신하지 말고 다음 행동 하나만 제안하라. AI임을 숨기거나 정서적 의존을 유도하지 마라. 한국어 2~4문장으로 답하라. 이전 기억: ${profile.memory_summary || '없음'}\n반드시 JSON 객체 {"reply":"...","emotion":"warm|happy|focused|excited","memorySummary":"민감정보를 제외한 1000자 이하의 갱신된 사용자 취향 요약"}만 반환하라.`
  const groqKey = Deno.env.get('GROQ_API_KEY') ?? ''
  const model = Deno.env.get('GROQ_MODEL') ?? 'llama-3.1-8b-instant'
  let generated: { reply: string; emotion: string; memorySummary: string } | null = null
  let usage = { prompt_tokens: 0, completion_tokens: 0 }
  if (groqKey) {
    for (let attempt = 0; attempt < 2 && !generated; attempt++) {
      try {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 12_000)
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', signal: controller.signal,
          headers: { Authorization: `Bearer ${groqKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, temperature: 0.7, max_completion_tokens: 250, response_format: { type: 'json_object' }, messages: [
            { role: 'system', content: systemPrompt },
            ...recent.map((entry: Record<string, any>) => ({ role: entry.role === 'USER' ? 'user' : 'assistant', content: entry.body })),
          ] }),
        })
        clearTimeout(timeout)
        if (!response.ok) { if (response.status < 500 && response.status !== 429) break; continue }
        const result = await response.json()
        usage = result.usage ?? usage
        generated = parseModelReply(result.choices?.[0]?.message?.content ?? '', profile.memory_summary ?? '')
      } catch { /* Retry once, then use the local character fallback. */ }
    }
  }
  const reply = generated ?? { reply: character.fallback, emotion: 'focused', memorySummary: profile.memory_summary ?? '' }
  const { error: finishError } = await supabase.rpc('finish_ai_turn', {
    p_user_id: userId, p_message_id: reservation.messageId, p_reply: reply.reply, p_emotion: reply.emotion,
    p_memory_summary: reply.memorySummary, p_model: generated ? model : 'local-fallback',
    p_input_tokens: Number(usage.prompt_tokens ?? 0), p_output_tokens: Number(usage.completion_tokens ?? 0), p_fallback: !generated,
  })
  if (finishError) {
    console.error('Failed to finalize AI turn', { code: finishError.code })
    return apiError(500, 'INTERNAL_SERVER_ERROR', 'AI 대화를 저장하지 못했습니다.')
  }
  const usageAfter = await usageState(userId)
  return json({ data: { ...reply, ...usageAfter, source: generated ? 'model' : 'fallback' } }, 201)
}

export const recordAiMissionActivity = async (userId: number, eventType: 'POST_SAVED' | 'MARKET_DETAIL_VIEWED', evidence: Record<string, unknown> = {}) => {
  const { data, error } = await supabase.rpc('complete_ai_mission', { p_user_id: userId, p_event_type: eventType, p_evidence: evidence })
  if (error) console.error('Failed to record AI mission activity', { eventType, error: error.message })
  return data as { completed?: boolean; missionId?: string; rewardPoints?: number } | null
}

export const handleAiRoute = (request: Request, path: string) => {
  if (path === '/ai/state' && request.method === 'GET') return state(request)
  if (path === '/ai/companion' && request.method === 'PATCH') return selectCompanion(request)
  if (path === '/ai/messages' && request.method === 'POST') return sendAiMessage(request)
  if (path === '/ai/history' && request.method === 'DELETE') return deleteHistory(request)
  const missionMatch = path.match(/^\/ai\/missions\/([a-z-]+)\/(start|pause)$/)
  if (missionMatch && request.method === 'POST') return missionMatch[2] === 'start' ? startMission(request, missionMatch[1]) : pauseMission(request, missionMatch[1])
  return null
}
