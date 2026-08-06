import { FormEvent, useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, MessageCircle, Plus, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import './ai-mission.css'
import { assetUrl } from './assets'
import { ProgressiveImage } from './ProgressiveImage'

export type AiCapability = 'missions' | 'writing-coach' | 'content-recommendations' | 'market-assistant'
export type AiCharacter = {
  id: 'chiikawa' | 'hachiware' | 'usagi'
  name: string
  role: string
  description: string
  image: string
  accent: string
  accentSoft: string
  capabilities: AiCapability[]
  greeting: string
  success: string[]
  nudge: string
}
export type MissionDefinition = {
  id: 'draft-story' | 'interest-classification' | 'market-visit'
  index: string
  title: string
  description: string
  route: '/write' | '/market'
  action: string
  reward: number
}
export type MissionProgress = { completedAt: string | null; rewardStatus: 'PENDING' }
export type AiMessage = { id: string; sender: 'ai' | 'user'; body: string; createdAt: string }
export type AiCompanionState = {
  version: 1
  characterId: AiCharacter['id'] | null
  messages: Partial<Record<AiCharacter['id'], AiMessage[]>>
  progress: Record<MissionDefinition['id'], MissionProgress>
  dock: 'open' | 'minimized' | 'hidden'
}
export type AiActivity =
  | { type: 'post_saved'; status: 'DRAFT' | 'PUBLISHED'; titleLength: number; contentLength: number; interestClassificationCount: number }
  | { type: 'market_detail_viewed'; itemId: string }

export const AI_ACTIVITY_EVENT = 'tistory:activity'
export const emitAiActivity = (activity: AiActivity) => window.dispatchEvent(new CustomEvent<AiActivity>(AI_ACTIVITY_EVENT, { detail: activity }))

export const AI_CHARACTERS: AiCharacter[] = [
  { id: 'chiikawa', name: '치이카와', role: '다정한 응원 친구', description: '조금 떨려도 괜찮아. 작은 용기를 모아 한 걸음씩 함께해요.', image: assetUrl('ai/chiikawa.webp'), accent: '#ef9bb4', accentSoft: '#3b252d', capabilities: ['missions'], greeting: '와…! 와아… 만나서 반가워. 조금씩, 같이 해보자…!', success: ['해, 해냈어…! 정말 대단해!', '와아…! 완료했어. 같이 기뻐해도 되지?', '용기 냈구나…! 다음 것도 천천히 함께하자.'], nudge: '괜찮아… 아주 작은 것부터 해도 돼. 내가 옆에 있을게!' },
  { id: 'hachiware', name: '하치와레', role: '긍정적인 안내 친구', description: '어려운 미션도 알기 쉽게 풀어주고 밝은 쪽을 찾아줘요.', image: assetUrl('ai/hachiware.webp'), accent: '#80b8d2', accentSoft: '#20333c', capabilities: ['missions'], greeting: '왔구나! 오늘 할 일을 하나씩 살펴보면 생각보다 금방 끝낼 수 있을 거야. 같이 시작해보자!', success: ['됐다! 차근차근 하니까 정말 해냈네!', '완료 확인! 다음 미션도 방법부터 같이 살펴보자.', '좋은 선택이었어! 기록이 제대로 남았어.'], nudge: '어디서 막혔는지 말해주면 순서대로 설명해줄게. 하나씩 하면 괜찮아!' },
  { id: 'usagi', name: '우사기', role: '용감한 도전 친구', description: '망설임 없이 출발하고 미션을 신나는 도전으로 바꿔줘요.', image: assetUrl('ai/usagi.webp'), accent: '#e7c76c', accentSoft: '#3b3420', capabilities: ['missions'], greeting: '야하—! 미션 발견! 준비됐으면 바로 출발이다!', success: ['우라라—! 미션 완료! 다음으로 간다!', '야하! 해냈다! 보상 기록도 꽉 잡아뒀다!', '우라—! 이 기세면 전부 모을 수 있어!'], nudge: '야하! 고민은 짧게, 행동은 빠르게! 버튼부터 눌러보자!' },
]

type AiPalette = { accent: string; soft: string }
const paletteCache = new Map<string, AiPalette>()
const validCharacterIds = new Set(AI_CHARACTERS.map((character) => character.id))
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
  if (!winner) return fallback
  return `#${toHex(winner.r / winner.count)}${toHex(winner.g / winner.count)}${toHex(winner.b / winner.count)}`
}

function useImagePalette(imageUrl: string, fallback: string): AiPalette {
  const [palette, setPalette] = useState<AiPalette>(() => paletteCache.get(imageUrl) ?? { accent: fallback, soft: softFromAccent(fallback) })
  useEffect(() => {
    const cached = paletteCache.get(imageUrl)
    if (cached) { setPalette(cached); return }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas'); canvas.width = 48; canvas.height = 48
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) return
        context.drawImage(image, 0, 0, 48, 48)
        const accent = dominantColorFromPixels(context.getImageData(0, 0, 48, 48).data, fallback)
        const next = { accent, soft: softFromAccent(accent) }; paletteCache.set(imageUrl, next); setPalette(next)
      } catch { setPalette({ accent: fallback, soft: softFromAccent(fallback) }) }
    }
    image.onerror = () => setPalette({ accent: fallback, soft: softFromAccent(fallback) })
    image.src = imageUrl
  }, [fallback, imageUrl])
  return palette
}

export const AI_MISSIONS: MissionDefinition[] = [
  { id: 'draft-story', index: '01', title: '첫 기록 남기기', description: '제목과 30자 이상의 본문을 작성하고 임시 저장하세요.', route: '/write', action: '글 쓰러 가기', reward: 100 },
  { id: 'interest-classification', index: '02', title: '관심분야 연결하기', description: '관심분야 기반 분류를 하나 이상 선택해 글에 적용하세요.', route: '/write', action: '분류 적용하기', reward: 150 },
  { id: 'market-visit', index: '03', title: '취향 상품 발견하기', description: '마켓 목록을 둘러보고 상품 상세 페이지 한 곳을 방문하세요.', route: '/market', action: '마켓 둘러보기', reward: 80 },
]

const emptyProgress = (): AiCompanionState['progress'] => Object.fromEntries(AI_MISSIONS.map((mission) => [mission.id, { completedAt: null, rewardStatus: 'PENDING' }])) as AiCompanionState['progress']
const initialState = (): AiCompanionState => ({ version: 1, characterId: null, messages: {}, progress: emptyProgress(), dock: 'open' })
const storageKey = (userId: number) => `tistory.ai-mission.v1:${userId}`
const message = (sender: AiMessage['sender'], body: string): AiMessage => ({ id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, sender, body, createdAt: new Date().toISOString() })

const loadState = (userId: number) => {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey(userId)) || 'null') as Partial<AiCompanionState> | null
    if (saved?.version !== 1) return initialState()
    const characterId = saved.characterId && validCharacterIds.has(saved.characterId) ? saved.characterId : null
    const messages = characterId && saved.messages?.[characterId] ? { [characterId]: saved.messages[characterId] } : {}
    return { ...initialState(), ...saved, characterId, messages, progress: { ...emptyProgress(), ...saved.progress } }
  } catch { return initialState() }
}

const matchingMissions = (activity: AiActivity): MissionDefinition['id'][] => {
  if (activity.type === 'market_detail_viewed') return ['market-visit']
  const matches: MissionDefinition['id'][] = []
  if (activity.status === 'DRAFT' && activity.titleLength > 0 && activity.contentLength >= 30) matches.push('draft-story')
  if (activity.interestClassificationCount > 0) matches.push('interest-classification')
  return matches
}

export function useAiMission(userId: number | null) {
  const [state, setState] = useState<AiCompanionState>(() => userId ? loadState(userId) : initialState())
  const [completion, setCompletion] = useState<MissionDefinition | null>(null)
  const skipPersist = useRef(true)
  useEffect(() => { skipPersist.current = true; setState(userId ? loadState(userId) : initialState()); setCompletion(null) }, [userId])
  useEffect(() => { if (!userId || skipPersist.current) { skipPersist.current = false; return } localStorage.setItem(storageKey(userId), JSON.stringify(state)) }, [state, userId])
  useEffect(() => {
    if (!userId) return
    const onActivity = (event: Event) => {
      const missionIds = matchingMissions((event as CustomEvent<AiActivity>).detail)
      if (!missionIds.length) return
      setState((current) => {
        if (!current.characterId) return current
        const newlyCompleted = missionIds.filter((missionId) => !current.progress[missionId].completedAt)
        if (!newlyCompleted.length) return current
        const mission = AI_MISSIONS.find((entry) => entry.id === newlyCompleted[0])!
        const character = AI_CHARACTERS.find((entry) => entry.id === current.characterId)!
        setCompletion(mission)
        const reward = newlyCompleted.reduce((sum, missionId) => sum + AI_MISSIONS.find((entry) => entry.id === missionId)!.reward, 0)
        const body = `${character.success[Math.floor(Math.random() * character.success.length)]} +${reward}P는 지급 예정으로 기록해둘게.`
        const completedAt = new Date().toISOString()
        const progress = { ...current.progress }
        newlyCompleted.forEach((missionId) => { progress[missionId] = { completedAt, rewardStatus: 'PENDING' } })
        return { ...current, dock: 'open', progress, messages: { ...current.messages, [character.id]: [...(current.messages[character.id] ?? []), message('ai', body)] } }
      })
    }
    window.addEventListener(AI_ACTIVITY_EVENT, onActivity)
    return () => window.removeEventListener(AI_ACTIVITY_EVENT, onActivity)
  }, [userId])
  const character = AI_CHARACTERS.find((entry) => entry.id === state.characterId) ?? null
  const currentMission = AI_MISSIONS.find((mission) => !state.progress[mission.id].completedAt) ?? null
  const completedCount = AI_MISSIONS.filter((mission) => state.progress[mission.id].completedAt).length
  const selectCharacter = (id: AiCharacter['id']) => setState((current) => {
    const next = AI_CHARACTERS.find((entry) => entry.id === id)!
    return { ...current, characterId: id, dock: 'open', messages: { ...current.messages, [id]: current.messages[id]?.length ? current.messages[id] : [message('ai', next.greeting)] } }
  })
  const addChat = (body: string) => setState((current) => current.characterId ? { ...current, messages: { ...current.messages, [current.characterId]: [...(current.messages[current.characterId] ?? []), message('user', body)] } } : current)
  const addReply = (body: string) => setState((current) => current.characterId ? { ...current, messages: { ...current.messages, [current.characterId]: [...(current.messages[current.characterId] ?? []), message('ai', body)] } } : current)
  const setDock = (dock: AiCompanionState['dock']) => setState((current) => ({ ...current, dock }))
  return { state, character, currentMission, completedCount, completion, setCompletion, selectCharacter, addChat, addReply, setDock }
}

type Controller = ReturnType<typeof useAiMission>

const replyFor = (text: string, controller: Controller) => {
  const { character, currentMission, completedCount } = controller
  if (!character) return ''
  if (/보상|포인트|\bP\b/i.test(text)) return `완료한 미션 보상은 P 단위로 기록되지만 아직 지갑 연동 전이야. 지금은 모두 ‘지급 예정’ 상태로 안전하게 표시하고 있어.`
  if (/진행|상태|얼마나|완료/.test(text)) return currentMission ? `현재 ${completedCount}/3 완료. 다음은 ‘${currentMission.title}’ 미션이야. ${currentMission.description}` : '세 미션 모두 완료했어. 지급 예정 보상도 빠짐없이 기록됐어!'
  if (/도움|어떻게|방법|미션|막혔/.test(text)) return currentMission ? `${currentMission.description} ${character.nudge}` : '이미 모든 미션을 마쳤어. 다음 모험이 열릴 때까지 기록을 이어가 봐!'
  if (character.id === 'chiikawa') return '와아… 그렇구나. 말해줘서 고마워…! 우리 조금씩 같이 해보자.'
  if (character.id === 'hachiware') return '그렇구나! 이야기해줘서 고마워. 지금 할 수 있는 일을 하나씩 정리하면 더 쉬워질 거야.'
  return '야하—! 재미있는 이야기다! 그 기세로 다음 도전도 바로 찾아보자!'
}

function CharacterCard({ entry, index, onSelect }: { entry: AiCharacter; index: number; onSelect: () => void }) {
  const palette = useImagePalette(entry.image, entry.accent)
  return <button className="ai-character-card" style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties} onClick={onSelect}>
    <span className="ai-card-number">0{index + 1}</span><ProgressiveImage eager src={entry.image} alt={`${entry.name}, ${entry.role}`} /><span className="ai-card-shade" /><span className="ai-card-copy"><small>{entry.role}</small><strong>{entry.name}</strong><em>{entry.description}</em><b>이 캐릭터와 시작 <ArrowRight size={16} /></b></span>
  </button>
}

export function AiMissionPage({ controller, nickname, go }: { controller: Controller; nickname: string; go: (route: string) => void }) {
  const { state, character, currentMission, completedCount, selectCharacter, addChat, addReply, setDock } = controller
  const [choosing, setChoosing] = useState(!character)
  const [input, setInput] = useState('')
  const [createNotice, setCreateNotice] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const palette = useImagePalette(character?.image ?? '', character?.accent ?? '#ef9bb4')
  useEffect(() => { if (state.dock === 'hidden') setDock('open') }, [])
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }) }, [state.messages, character])
  useEffect(() => { if (!character) setChoosing(true) }, [character])
  if (choosing || !character) return <main id="main" className="ai-stage ai-casting"><div className="ai-casting-inner">
    <header><p>AI COMPANION · MISSION LAB</p><h1>{nickname}님의<br />동료를 선택하세요.</h1><span>성격과 말투는 달라도 미션 진행도는 그대로 이어집니다.</span></header>
    <div className="ai-character-grid">{AI_CHARACTERS.map((entry, index) => <CharacterCard entry={entry} index={index} onSelect={() => { selectCharacter(entry.id); setChoosing(false) }} key={entry.id} />)}</div>
    <button className="ai-create-character" onClick={() => { setCreateNotice(true); window.setTimeout(() => setCreateNotice(false), 2600) }}><span className="ai-create-icon"><Plus size={20} /></span><span><strong>나만의 AI 캐릭터 생성하기</strong><small>외형과 말투를 직접 설정하는 기능이 곧 추가됩니다.</small></span><em>COMING SOON</em><ArrowRight size={18} /></button>
    {createNotice && <div className="ai-create-notice" role="status"><Sparkles size={15} /> 캐릭터 생성 기능을 준비 중입니다.</div>}
  </div></main>
  const messages = state.messages[character.id] ?? []
  const submit = (event: FormEvent) => { event.preventDefault(); const text = input.trim(); if (!text) return; addChat(text); setInput(''); window.setTimeout(() => addReply(replyFor(text, controller)), 320) }
  return <main id="main" className="ai-stage ai-room" style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties}>
    <section className="ai-portrait-pane"><ProgressiveImage src={character.image} alt="" /><div className="ai-portrait-overlay" /><div className="ai-character-meta"><p>YOUR AI COMPANION</p><h1>{character.name}</h1><span>{character.role}</span><div><i /> missions 활성화</div></div><button className="ai-switch" onClick={() => setChoosing(true)}><RotateCcw size={14} /> 캐릭터 변경</button></section>
    <section className="ai-chat-pane"><header><div><span className="ai-online" /><div><strong>{character.name}</strong><small>당신의 활동을 함께 보고 있어요</small></div></div><span>{completedCount}/3 COMPLETE</span></header><div className="ai-chat-log" ref={logRef}>{messages.map((entry) => <div className={`ai-bubble ${entry.sender}`} key={entry.id}>{entry.sender === 'ai' && <ProgressiveImage src={character.image} alt="" />}<p>{entry.body}</p></div>)}</div><form className="ai-chat-form" onSubmit={submit}><input value={input} onChange={(event) => setInput(event.target.value)} maxLength={300} placeholder={`${character.name}에게 무엇이든 말해보세요`} /><button aria-label="메시지 보내기" disabled={!input.trim()}><Send size={17} /></button></form><div className="ai-suggests"><button onClick={() => { addChat('지금 미션 어떻게 해?'); addReply(replyFor('지금 미션 어떻게 해?', controller)) }}>미션 도움</button><button onClick={() => { addChat('진행 상태 알려줘'); addReply(replyFor('진행 상태 알려줘', controller)) }}>진행 상황</button><button onClick={() => { addChat('보상은 어떻게 받아?'); addReply(replyFor('보상은 어떻게 받아?', controller)) }}>보상 질문</button></div></section>
    <aside className="ai-mission-pane"><header><p>MISSION QUEUE</p><span>{completedCount} / {AI_MISSIONS.length}</span></header>{currentMission ? <div className="ai-current-mission"><small>NEXT MISSION · {currentMission.index}</small><h2>{currentMission.title}</h2><p>{currentMission.description}</p><strong>+{currentMission.reward}P <em>지급 예정</em></strong><button onClick={() => go(currentMission.route)}>{currentMission.action} <ArrowRight size={16} /></button></div> : <div className="ai-all-clear"><Sparkles size={28} /><h2>오늘의 미션 완료</h2><p>모든 예정 보상이 기록됐어요.</p></div>}<div className="ai-mission-list">{AI_MISSIONS.map((mission) => { const done = Boolean(state.progress[mission.id].completedAt); return <div className={done ? 'done' : currentMission?.id === mission.id ? 'active' : ''} key={mission.id}><span>{done ? <Check size={14} /> : mission.index}</span><div><strong>{mission.title}</strong><small>+{mission.reward}P · 지급 예정</small></div></div> })}</div><footer>현재는 프론트엔드 미션 기록만 제공하며<br />실제 포인트 잔액은 변경하지 않습니다.</footer></aside>
  </main>
}

export function AiCompanionDock({ controller, path, go }: { controller: Controller; path: string; go: (route: string) => void }) {
  const { state, character, currentMission, completion, setCompletion, setDock } = controller
  const palette = useImagePalette(character?.image ?? '', character?.accent ?? '#ef9bb4')
  const wasHidden = state.dock === 'hidden'
  if (!character || path === '/ai' || (wasHidden && !completion)) return null
  if (state.dock === 'minimized' && !completion) return <button className="ai-dock-min" aria-label="AI 동반자 열기" style={{ '--ai-accent': palette.accent } as React.CSSProperties} onClick={() => setDock('open')}><ProgressiveImage src={character.image} alt="" /><MessageCircle size={16} /></button>
  const mission = completion ?? currentMission
  return <aside className={`ai-dock${completion ? ' success' : ''}`} style={{ '--ai-accent': palette.accent, '--ai-soft': palette.soft } as React.CSSProperties} aria-live="polite"><ProgressiveImage src={character.image} alt="" /><div><small>{completion ? 'MISSION COMPLETE' : `WITH ${character.name}`}</small><strong>{completion ? `${mission?.title} 완료!` : mission?.title ?? '오늘의 미션 완료'}</strong><p>{completion ? character.success[0] : mission?.description ?? '새 미션이 열릴 때까지 기록을 이어가요.'}</p><button onClick={() => go('/ai')}>AI 공간 열기 <ArrowRight size={13} /></button></div><div className="ai-dock-controls"><button aria-label="최소화" onClick={() => { setCompletion(null); setDock('minimized') }}><ChevronDown size={15} /></button><button aria-label="닫기" onClick={() => { setCompletion(null); setDock('hidden') }}><X size={15} /></button></div></aside>
}
