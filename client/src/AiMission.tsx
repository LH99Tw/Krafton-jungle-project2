import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, MessageCircle, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import './ai-mission.css'
import { assetUrl } from './assets'
import { ProgressiveImage } from './ProgressiveImage'

export type AiCharacter = {
  id: 'chiikawa' | 'hachiware' | 'usagi'
  name: string
  role: string
  description: string
  image: string
  accent: string
  greeting: string
  success: string[]
}
export type MissionDefinition = {
  id: 'draft-story' | 'interest-classification' | 'market-visit'
  index: string
  title: string
  description: string
  route: '/write' | '/market'
  reward: number
  status: 'AVAILABLE' | 'ACTIVE' | 'PAUSED' | 'COMPLETED'
  startedAt: string | null
  completedAt: string | null
}
export type AiSuggestedAction = { id: string; label: string; route: string }
export type AiMessage = { id: string; sender: 'ai' | 'user'; body: string; createdAt: string; emotion?: string; source?: 'model' | 'fallback' | 'template'; suggestedAction?: AiSuggestedAction | null; animate?: boolean }
export type AiServerState = {
  characterId: AiCharacter['id'] | null
  consented: boolean
  memorySummary: string
  conversation: { id: number; mode: 'GENERAL' | 'MISSION'; missionId: MissionDefinition['id'] | null } | null
  messages: AiMessage[]
  missions: MissionDefinition[]
  userRemainingTurns: number
  globalRemainingTurns: number
  dailyLimitResetAt: string
  availability: 'AVAILABLE' | 'USER_LIMITED' | 'GLOBAL_LIMITED'
}
export type AiActivity =
  | { type: 'post_saved'; status: 'DRAFT' | 'PUBLISHED'; titleLength: number; contentLength: number; interestClassificationCount: number }
  | { type: 'post_progress'; milestone: 'title' | 'body' | 'classification' }
  | { type: 'market_detail_viewed'; itemId: string }

export const AI_ACTIVITY_EVENT = 'tistory:activity'
export const emitAiActivity = (activity: AiActivity) => window.dispatchEvent(new CustomEvent<AiActivity>(AI_ACTIVITY_EVENT, { detail: activity }))

export const AI_CHARACTERS: AiCharacter[] = [
  { id: 'chiikawa', name: '치이카와', role: '다정한 응원 친구', description: '조금 떨려도 괜찮아. 작은 용기를 모아 한 걸음씩 함께해요.', image: assetUrl('ai/chiikawa.webp'), accent: '#ef9bb4', greeting: '와…! 만나서 반가워. 조금씩 같이 해보자…!', success: ['해, 해냈어…! 정말 대단해!', '와아…! 완료했어. 같이 기뻐해도 되지?'] },
  { id: 'hachiware', name: '하치와레', role: '긍정적인 안내 친구', description: '어려운 미션도 알기 쉽게 풀어주고 밝은 쪽을 찾아줘요.', image: assetUrl('ai/hachiware.webp'), accent: '#80b8d2', greeting: '왔구나! 오늘 할 일을 하나씩 같이 살펴보자!', success: ['됐다! 차근차근 하니까 정말 해냈네!', '완료 확인! 다음 미션도 같이 살펴보자.'] },
  { id: 'usagi', name: '우사기', role: '용감한 도전 친구', description: '망설임 없이 출발하고 미션을 신나는 도전으로 바꿔줘요.', image: assetUrl('ai/usagi.webp'), accent: '#e7c76c', greeting: '야하—! 미션 발견! 준비됐으면 바로 출발이다!', success: ['우라라—! 미션 완료!', '야하! 해냈다! 다음으로 간다!'] },
]

const fallbackMissions: MissionDefinition[] = [
  { id: 'draft-story', index: '01', title: '첫 기록 남기기', description: '제목과 30자 이상의 본문을 작성하고 임시 저장하세요.', route: '/write', reward: 100, status: 'AVAILABLE', startedAt: null, completedAt: null },
  { id: 'interest-classification', index: '02', title: '관심분야 연결하기', description: '관심분야 기반 분류를 하나 이상 선택해 글에 적용하세요.', route: '/write', reward: 150, status: 'AVAILABLE', startedAt: null, completedAt: null },
  { id: 'market-visit', index: '03', title: '취향 상품 발견하기', description: '마켓 목록을 둘러보고 상품 상세 페이지 한 곳을 방문하세요.', route: '/market', reward: 80, status: 'AVAILABLE', startedAt: null, completedAt: null },
]

const progressMessages: Record<AiCharacter['id'], Record<'title' | 'body' | 'classification', string>> = {
  chiikawa: { title: '와앗, 제목을 정했구나…! 이제 본문을 30자 이상 채워보자.', body: '본문 조건도 채웠어…! 임시저장하면 정말 완료야.', classification: '관심분야를 연결했어…! 이 상태로 글을 저장하면 돼.' },
  hachiware: { title: '좋아, 제목을 정했구나! 이제 본문을 30자 이상 채우면 다음 단계야.', body: '본문 조건도 채웠어! 이제 임시저장하면 미션 완료야.', classification: '관심분야 연결 완료! 이 상태로 글을 저장하면 미션이 끝나.' },
  usagi: { title: '야하! 제목 확보! 이제 본문 30자를 돌파한다—!', body: '우라! 본문 조건 돌파! 임시저장 버튼으로 마무리다!', classification: '관심분야 연결! 이대로 글을 저장하면 완료다—!' },
}

type Requester = <T>(path: string, options?: RequestInit) => Promise<T>
const emptyState = (): AiServerState => ({ characterId: null, consented: false, memorySummary: '', conversation: null, messages: [], missions: fallbackMissions, userRemainingTurns: 20, globalRemainingTurns: 200, dailyLimitResetAt: '', availability: 'AVAILABLE' })

type AiPalette = { accent: string; soft: string }
const paletteCache = new Map<string, AiPalette>()
const hexToRgb = (hex: string) => { const value = hex.replace('#', ''); return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)] }
const toHex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, '0')
const softFromAccent = (accent: string) => { const [r, g, b] = hexToRgb(accent); return `#${toHex(r * .26)}${toHex(g * .26)}${toHex(b * .26)}` }

export function dominantColorFromPixels(pixels: Uint8ClampedArray, fallback: string): string {
  const buckets = new Map<string, { count: number; r: number; g: number; b: number }>()
  for (let index = 0; index < pixels.length; index += 4) {
    const r = pixels[index]; const g = pixels[index + 1]; const b = pixels[index + 2]; const alpha = pixels[index + 3]
    const chroma = Math.max(r, g, b) - Math.min(r, g, b)
    if (alpha < 128 || (r >= 235 && g >= 235 && b >= 235) || (r <= 38 && g <= 38 && b <= 38) || chroma < 12) continue
    const key = `${Math.round(r / 24)}-${Math.round(g / 24)}-${Math.round(b / 24)}`
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 }
    bucket.count += 1; bucket.r += r; bucket.g += g; bucket.b += b; buckets.set(key, bucket)
  }
  const winner = [...buckets.values()].sort((a, b) => b.count - a.count)[0]
  return winner ? `#${toHex(winner.r / winner.count)}${toHex(winner.g / winner.count)}${toHex(winner.b / winner.count)}` : fallback
}

function useImagePalette(imageUrl: string, fallback: string): AiPalette {
  const [palette, setPalette] = useState<AiPalette>(() => paletteCache.get(imageUrl) ?? { accent: fallback, soft: softFromAccent(fallback) })
  useEffect(() => {
    if (!imageUrl) return
    const cached = paletteCache.get(imageUrl); if (cached) { setPalette(cached); return }
    const image = new Image(); image.crossOrigin = 'anonymous'
    image.onload = () => { try { const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48; const context = canvas.getContext('2d', { willReadFrequently: true }); if (!context) return; context.drawImage(image, 0, 0, 48, 48); const accent = dominantColorFromPixels(context.getImageData(0, 0, 48, 48).data, fallback); const next = { accent, soft: softFromAccent(accent) }; paletteCache.set(imageUrl, next); setPalette(next) } catch { /* Keep the configured palette. */ } }
    image.src = imageUrl
  }, [fallback, imageUrl])
  return palette
}

export function useAiMission(userId: number | null, api: Requester) {
  const [state, setState] = useState<AiServerState>(emptyState)
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [completion, setCompletion] = useState<MissionDefinition | null>(null)
  const [dock, setDock] = useState<'open' | 'minimized' | 'hidden'>('open')
  const previousCompleted = useRef(new Set<string>())
  const hydrated = useRef(false)
  const applyState = useCallback((next: AiServerState) => {
    const newlyCompleted = next.missions.find((mission) => mission.status === 'COMPLETED' && !previousCompleted.current.has(mission.id))
    previousCompleted.current = new Set(next.missions.filter((mission) => mission.status === 'COMPLETED').map((mission) => mission.id))
    if (hydrated.current && newlyCompleted) { setCompletion(newlyCompleted); setDock('open') }
    hydrated.current = true
    setState(next)
  }, [])
  const refresh = useCallback(async () => {
    if (!userId) { setState(emptyState()); return }
    setLoading(true)
    try { applyState(await api<AiServerState>('/ai/state')) } catch (cause) { setError((cause as Error).message) } finally { setLoading(false) }
  }, [api, applyState, userId])
  useEffect(() => { previousCompleted.current = new Set(); hydrated.current = false; setError(''); void refresh() }, [refresh, userId])
  useEffect(() => {
    const onActivity = (event: Event) => {
      const activity = (event as CustomEvent<AiActivity>).detail
      if (activity.type !== 'post_progress') { window.setTimeout(() => void refresh(), 120); return }
      setState((current) => {
        const missionId = current.conversation?.missionId
        const relevant = (missionId === 'draft-story' && activity.milestone !== 'classification') || (missionId === 'interest-classification' && activity.milestone === 'classification')
        const id = `local:${missionId}:${activity.milestone}`
        if (!relevant || current.messages.some((message) => message.id === id)) return current
        const characterId = current.characterId ?? 'hachiware'
        const body = progressMessages[characterId][activity.milestone]
        return { ...current, messages: [...current.messages, { id, sender: 'ai', body, source: 'template', createdAt: new Date().toISOString(), animate: true }] }
      })
    }
    window.addEventListener(AI_ACTIVITY_EVENT, onActivity)
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, onActivity)
  }, [refresh])
  const selectCharacter = async (characterId: AiCharacter['id']) => { setLoading(true); setError(''); try { applyState(await api<AiServerState>('/ai/companion', { method: 'PATCH', body: JSON.stringify({ characterId, consent: true }) })); setDock('open') } catch (cause) { setError((cause as Error).message) } finally { setLoading(false) } }
  const startMission = async (mission: MissionDefinition) => { setLoading(true); setError(''); try { applyState(await api<AiServerState>(`/ai/missions/${mission.id}/start`, { method: 'POST' })); setDock('open'); return true } catch (cause) { setError((cause as Error).message); return false } finally { setLoading(false) } }
  const pauseMission = async (missionId: string) => { setLoading(true); setError(''); try { applyState(await api<AiServerState>(`/ai/missions/${missionId}/pause`, { method: 'POST' })) } catch (cause) { setError((cause as Error).message) } finally { setLoading(false) } }
  const clearHistory = async () => { setLoading(true); setError(''); try { await api('/ai/history', { method: 'DELETE' }); await refresh() } catch (cause) { setError((cause as Error).message) } finally { setLoading(false) } }
  const sendMessage = async (body: string) => { setSending(true); setError(''); const optimistic: AiMessage = { id: crypto.randomUUID(), sender: 'user', body, createdAt: new Date().toISOString() }; setState((current) => ({ ...current, messages: [...current.messages, optimistic] })); try { const result = await api<{ reply: string; emotion: string; source: 'model' | 'fallback'; suggestedAction: AiSuggestedAction | null; userRemainingTurns: number; globalRemainingTurns: number; availability: AiServerState['availability']; dailyLimitResetAt: string }>('/ai/messages', { method: 'POST', body: JSON.stringify({ body, idempotencyKey: optimistic.id, context: { pathname: window.location.pathname } }) }); setState((current) => ({ ...current, userRemainingTurns: result.userRemainingTurns, globalRemainingTurns: result.globalRemainingTurns, availability: result.availability, dailyLimitResetAt: result.dailyLimitResetAt, messages: [...current.messages, { id: crypto.randomUUID(), sender: 'ai', body: result.reply, emotion: result.emotion, source: result.source, suggestedAction: result.suggestedAction, animate: true, createdAt: new Date().toISOString() }] })) } catch (cause) { setState((current) => ({ ...current, messages: current.messages.filter((message) => message.id !== optimistic.id) })); setError((cause as Error).message); await refresh() } finally { setSending(false) } }
  const character = AI_CHARACTERS.find((item) => item.id === state.characterId) ?? null
  const currentMission = state.missions.find((mission) => mission.id === state.conversation?.missionId) ?? null
  const completedCount = state.missions.filter((mission) => mission.status === 'COMPLETED').length
  const latestSuggestedAction = [...state.messages].reverse().find((message) => message.sender === 'ai' && message.suggestedAction)?.suggestedAction ?? null
  return { state, character, currentMission, completedCount, latestSuggestedAction, loading, sending, error, completion, dock, refresh, selectCharacter, startMission, pauseMission, clearHistory, sendMessage, setCompletion, setDock }
}

type Controller = ReturnType<typeof useAiMission>

function CharacterCard({ entry, index, disabled, onSelect }: { entry: AiCharacter; index: number; disabled: boolean; onSelect: () => void }) {
  const palette = useImagePalette(entry.image, entry.accent)
  return <button disabled={disabled} className="ai-character-card" style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties} onClick={onSelect}><span className="ai-card-number">0{index + 1}</span><ProgressiveImage eager src={entry.image} alt={`${entry.name}, ${entry.role}`} /><span className="ai-card-shade" /><span className="ai-card-copy"><small>{entry.role}</small><strong>{entry.name}</strong><em>{entry.description}</em><b>이 캐릭터와 시작 <ArrowRight size={16} /></b></span></button>
}

function AiMessageBody({ message }: { message: AiMessage }) {
  const [length, setLength] = useState(message.animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : message.body.length)
  useEffect(() => {
    if (length >= message.body.length) return
    const timer = window.setInterval(() => setLength((current) => Math.min(message.body.length, current + 2)), 18)
    return () => window.clearInterval(timer)
  }, [length, message.body.length])
  return <p>{message.body.slice(0, length)}</p>
}

export function AiMissionPage({ controller, nickname, go }: { controller: Controller; nickname: string; go: (route: string) => void }) {
  const { state, character, currentMission, completedCount, loading, sending, error, selectCharacter, startMission, pauseMission, clearHistory, sendMessage } = controller
  const [choosing, setChoosing] = useState(!character)
  const [consent, setConsent] = useState(false)
  const [input, setInput] = useState('')
  const logRef = useRef<HTMLDivElement>(null)
  const palette = useImagePalette(character?.image ?? '', character?.accent ?? '#ef9bb4')
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }) }, [state.messages, sending])
  useEffect(() => { if (!character) setChoosing(true) }, [character])
  useEffect(() => { if (state.consented) setConsent(true) }, [state.consented])
  if (choosing || !character) return <main id="main" className="ai-stage ai-casting"><div className="ai-casting-inner"><header><p>AI COMPANION · MISSION LAB</p><h1>{nickname}님의<br />동료를 선택하세요.</h1><span>대화는 외부 AI로 처리되며, 최근 대화와 민감정보를 제외한 취향 요약이 저장됩니다.</span></header><div className="ai-character-grid">{AI_CHARACTERS.map((entry, index) => <CharacterCard disabled={!consent || loading} entry={entry} index={index} onSelect={() => void selectCharacter(entry.id).then(() => setChoosing(false))} key={entry.id} />)}</div><label className="ai-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> AI 처리와 대화 저장 범위를 확인했으며 이에 동의합니다.</label>{error && <p className="form-error">{error}</p>}</div></main>
  const submit = (event: FormEvent) => { event.preventDefault(); const text = input.trim(); if (!text || sending || state.availability !== 'AVAILABLE') return; setInput(''); void sendMessage(text) }
  const limitText = state.availability === 'USER_LIMITED' ? '오늘 나눈 대화 20회를 모두 사용했어요.' : state.availability === 'GLOBAL_LIMITED' ? '오늘 준비된 AI 대화가 모두 사용됐어요. 자정 이후 다시 만나요.' : ''
  const globalStatus = state.globalRemainingTurns === 0 ? '오늘 마감' : state.globalRemainingTurns <= 40 ? '마감 임박' : '오늘 AI 대화 여유 있음'
  return <main id="main" className="ai-stage ai-room" style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties}>
    <section className="ai-portrait-pane"><ProgressiveImage src={character.image} alt="" /><div className="ai-portrait-overlay" /><div className="ai-character-meta"><p>YOUR AI COMPANION</p><h1>{character.name}</h1><span>{character.role}</span><div><i /> {state.conversation?.mode === 'MISSION' ? '미션 수행 중' : '일반 대화'}</div></div><button className="ai-switch" onClick={() => setChoosing(true)}><RotateCcw size={14} /> 캐릭터 변경</button></section>
    <section className="ai-chat-pane"><header><div><span className="ai-online" /><div><strong>{character.name}</strong><small>{currentMission ? `‘${currentMission.title}’ 함께 수행 중` : '일반 대화 모드'}</small></div></div><span>내 남은 대화 {state.userRemainingTurns}/20 · {globalStatus}</span></header><div className="ai-chat-log" ref={logRef}>{state.messages.map((entry) => <div className={`ai-bubble ${entry.sender}`} key={entry.id}>{entry.sender === 'ai' && <ProgressiveImage src={character.image} alt="" />}<div className="ai-bubble-content"><AiMessageBody message={entry} />{entry.suggestedAction && <button className="ai-message-action" onClick={() => go(entry.suggestedAction!.route)}>{entry.suggestedAction.label} <ArrowRight size={13} /></button>}</div></div>)}{sending && <div className="ai-bubble ai"><ProgressiveImage src={character.image} alt="" /><p>생각을 정리하고 있어…</p></div>}</div>{limitText && <p className="ai-limit-message" role="status">{limitText}</p>}{error && <p className="form-error">{error}</p>}<form className="ai-chat-form" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={300} disabled={sending || state.availability !== 'AVAILABLE'} placeholder={limitText || `${character.name}에게 무엇이든 말해보세요`} /><button aria-label="메시지 보내기" disabled={!input.trim() || sending || state.availability !== 'AVAILABLE'}><Send size={17} /></button></form><div className="ai-suggests">{currentMission && <><button onClick={() => go(currentMission.route)}>다음 행동 열기</button><button onClick={() => void pauseMission(currentMission.id)}>일반 대화로 돌아가기</button></>}<button disabled={loading} onClick={() => { if (window.confirm('AI 대화 기록과 기억 요약을 삭제할까요?')) void clearHistory() }}>대화 기억 삭제</button></div></section>
    <aside className="ai-mission-pane"><header><p>MISSION QUEUE</p><span>{completedCount} / {state.missions.length}</span></header>{currentMission ? <div className="ai-current-mission"><small>MISSION MODE · {currentMission.index}</small><h2>{currentMission.title}</h2><p>{currentMission.description}</p><strong>+{currentMission.reward}P <em>완료 시 지급</em></strong><button onClick={() => go(currentMission.route)}>같이 수행하기 <ArrowRight size={16} /></button></div> : <div className="ai-all-clear"><Sparkles size={28} /><h2>함께할 미션을 골라보세요</h2><p>카드를 누르면 캐릭터와 미션 모드로 전환됩니다.</p></div>}<div className="ai-mission-list">{state.missions.map((mission) => { const done = mission.status === 'COMPLETED'; return <button disabled={done || loading} className={done ? 'done' : currentMission?.id === mission.id ? 'active' : ''} key={mission.id} onClick={() => void startMission(mission).then((started) => started && go(mission.route))}><span>{done ? <Check size={14} /> : mission.index}</span><div><strong>{mission.title}</strong><small>+{mission.reward}P · {done ? '지급 완료' : '시작하기'}</small></div></button> })}</div><footer>미션 완료는 실제 서비스 활동으로 확인되며<br />보상은 한 번만 지급됩니다.</footer></aside>
  </main>
}

export function AiCompanionDock({ controller, path, go }: { controller: Controller; path: string; go: (route: string) => void }) {
  const { character, currentMission, latestSuggestedAction, completion, dock, setCompletion, setDock } = controller
  const palette = useImagePalette(character?.image ?? '', character?.accent ?? '#ef9bb4')
  if (!character || path === '/ai' || (dock === 'hidden' && !completion)) return null
  if (dock === 'minimized' && !completion) return <button className="ai-dock-min" aria-label="AI 동반자 열기" style={{ '--ai-accent': palette.accent } as React.CSSProperties} onClick={() => setDock('open')}><ProgressiveImage src={character.image} alt="" /><MessageCircle size={16} /></button>
  const mission = completion ?? currentMission
  return <aside className={`ai-dock${completion ? ' success' : ''}`} style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties} aria-live="polite"><ProgressiveImage src={character.image} alt="" /><div><small>{completion ? 'MISSION COMPLETE' : currentMission ? 'MISSION MODE' : `WITH ${character.name}`}</small><strong>{completion ? `${mission?.title} 완료!` : mission?.title ?? '일반 대화 중'}</strong><p>{completion ? `${character.success[0]} +${mission?.reward ?? 0}P가 지급됐어.` : mission?.description ?? '필요할 때 언제든 이야기해 주세요.'}</p>{!completion && latestSuggestedAction && path !== latestSuggestedAction.route && <button onClick={() => go(latestSuggestedAction.route)}>{latestSuggestedAction.label} <ArrowRight size={13} /></button>}<button onClick={() => go('/ai')}>AI 공간 열기 <ArrowRight size={13} /></button></div><div className="ai-dock-controls"><button aria-label="최소화" onClick={() => { setCompletion(null); setDock('minimized') }}><ChevronDown size={15} /></button><button aria-label="닫기" onClick={() => { setCompletion(null); setDock('hidden') }}><X size={15} /></button></div></aside>
}
