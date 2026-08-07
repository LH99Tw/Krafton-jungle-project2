export type AiSuggestedAction = { id: string; label: string; route: string }

export type ServiceKnowledge = {
  id: string
  title: string
  summary: string
  conditions: string
  keywords: string[]
  paths: RegExp[]
  action: AiSuggestedAction
}

const knowledge: ServiceKnowledge[] = [
  { id: 'blog-create', title: '블로그 만들기', summary: '로그인한 사용자는 블로그 이름, 주소, 소개를 입력해 자신의 블로그를 만들 수 있다.', conditions: '계정당 블로그 한 개를 만들 수 있다.', keywords: ['블로그 만들', '블로그 생성', '내 블로그'], paths: [/^\/blog\/new$/], action: { id: 'blog-create', label: '블로그 만들기', route: '/blog/new' } },
  { id: 'blog-manage', title: '블로그 관리', summary: '블로그 설정, 관심분야, 카테고리, 글, 상품과 휴지통을 관리할 수 있다.', conditions: '로그인하고 본인 블로그가 있어야 한다.', keywords: ['블로그 관리', '블로그 설정', '블로그 수정'], paths: [/^\/blog\/me\/manage(?:\/.*)?$/], action: { id: 'blog-manage', label: '블로그 관리 열기', route: '/blog/me/manage' } },
  { id: 'post-write', title: '글 작성과 저장', summary: '제목과 본문을 작성해 임시저장하거나 발행할 수 있고 카테고리 하나와 분류를 최대 다섯 개 연결할 수 있다.', conditions: '로그인하고 본인 블로그가 있어야 한다.', keywords: ['글 쓰', '글쓰기', '글은 어떻게', '글을 어떻게', '어떻게 써', '게시글 작성', '임시저장', '임시 저장', '발행'], paths: [/^\/write$/, /^\/post\/\d+\/edit$/], action: { id: 'post-write', label: '새 글 쓰기', route: '/write' } },
  { id: 'categories', title: '글 카테고리', summary: '카테고리는 블로그 안에서 글을 묶는 폴더다. 모든 블로그에는 삭제할 수 없는 전체글이 기본으로 있고 관리 화면에서 사용자 카테고리를 추가하고 정렬할 수 있다.', conditions: '글 하나에는 사용자 카테고리를 최대 하나 선택한다.', keywords: ['카테고리', '전체글', '글 분류 폴더'], paths: [/^\/blog\/me\/manage\/categories$/], action: { id: 'categories', label: '카테고리 관리', route: '/blog/me/manage/categories' } },
  { id: 'interests', title: '관심분야와 분류', summary: '관심분야는 추천과 글의 주제 분류에 사용한다. 글에는 관심분야 또는 직접 만든 분류를 최대 다섯 개 연결할 수 있다.', conditions: '카테고리와 분류는 서로 다른 기능이다.', keywords: ['관심분야', '관심 분야', '해시태그', '글 분류'], paths: [/^\/blog\/me\/manage\/interests$/, /^\/write$/], action: { id: 'interests', label: '관심분야 설정', route: '/blog/me/manage/interests' } },
  { id: 'feed', title: '홈과 피드', summary: '홈에서는 인기·최신 글과 추천 콘텐츠를 보고, 피드에서는 구독한 블로그의 새 글을 확인할 수 있다.', conditions: '구독 피드는 로그인 사용자에게 제공한다.', keywords: ['홈', '피드', '구독 글', '추천 글'], paths: [/^\/$/, /^\/feed$/], action: { id: 'feed', label: '피드 보기', route: '/feed' } },
  { id: 'search', title: '통합 검색', summary: '검색에서 게시글, 마켓 상품, 블로그 이름을 함께 찾을 수 있다.', conditions: '검색어와 일치하는 현재 공개 데이터만 표시한다.', keywords: ['검색', '찾아', '블로그명', '상품 검색', '글 검색'], paths: [/^\/search$/], action: { id: 'search', label: '통합 검색 열기', route: '/search' } },
  { id: 'bookmarks', title: '글 북마크', summary: '게시글의 북마크 버튼으로 글을 저장하고 내 북마크 화면에서 다시 볼 수 있다.', conditions: '북마크 목록은 본인에게만 표시된다.', keywords: ['북마크', '글 저장', '저장한 글'], paths: [/^\/bookmarks$/], action: { id: 'bookmarks', label: '내 북마크 보기', route: '/bookmarks' } },
  { id: 'reactions', title: '좋아요·댓글·답글·알림', summary: '공개 글에 좋아요와 댓글을 남길 수 있고 댓글에는 한 단계 답글을 달 수 있다. 내 글의 좋아요와 내 댓글의 답글은 알림으로 확인한다.', conditions: '작성·반응 기능은 로그인이 필요하다.', keywords: ['좋아요', '댓글', '답글', '알림'], paths: [/^\/post\/\d+$/, /^\/notifications$/], action: { id: 'reactions', label: '전체 알림 보기', route: '/notifications' } },
  { id: 'market', title: '팬덤 마켓', summary: '마켓에서 상품을 검색하고 상세 정보를 보며 좋아요, 판매자와의 채팅, 포인트 구매를 이용할 수 있다.', conditions: '현재 거래는 실제 현금 가치가 없는 MVP 포인트를 사용한다.', keywords: ['마켓', '상품 찾', '상품 검색', '상품 구매', '구매', '판매자 채팅'], paths: [/^\/market(?:\/\d+)?$/], action: { id: 'market', label: '마켓 둘러보기', route: '/market' } },
  { id: 'market-create', title: '새 상품 등록', summary: '상품명, 설명, 가격과 이미지를 입력해 블로그 상점과 마켓에 판매 상품을 등록할 수 있다.', conditions: '로그인하고 본인 블로그가 있어야 한다.', keywords: ['상품 등록', '새 상품', '판매 등록', '상품 올리'], paths: [/^\/market\/new$/, /^\/blog\/me\/manage\/market$/], action: { id: 'market-create', label: '새 상품 등록하기', route: '/market/new' } },
  { id: 'market-cart', title: '장바구니', summary: '마켓 장바구니 안내 화면으로 이동할 수 있다.', conditions: '현재 장바구니 거래 기능은 준비 중이며 화면에서 준비 상태를 확인할 수 있다.', keywords: ['장바구니', '담은 상품', '카트'], paths: [/^\/market\/cart$/], action: { id: 'market-cart', label: '장바구니 보기', route: '/market/cart' } },
  { id: 'market-recent', title: '최근 본 상품', summary: '최근 확인한 마켓 상품 목록을 볼 수 있다.', conditions: '현재 브라우저에서 확인한 상품 기록을 사용한다.', keywords: ['최근 본 상품', '최근 상품', '봤던 상품'], paths: [/^\/market\/recent$/], action: { id: 'market-recent', label: '최근 본 상품', route: '/market/recent' } },
  { id: 'market-wishlist', title: '찜한 상품', summary: '좋아요로 저장한 마켓 상품 목록을 볼 수 있다.', conditions: '로그인이 필요하다.', keywords: ['찜한 상품', '찜 목록', '위시리스트', '관심 상품'], paths: [/^\/market\/wishlist$/], action: { id: 'market-wishlist', label: '찜한 상품 보기', route: '/market/wishlist' } },
  { id: 'wallet', title: '포인트 지갑', summary: '지갑에서 포인트 잔액과 충전·구매·판매·미션 보상 거래 내역을 확인할 수 있다.', conditions: '포인트는 서비스 MVP 안에서만 사용하는 테스트 포인트다.', keywords: ['포인트', '지갑', '거래 내역', '잔액', '충전'], paths: [/^\/market\/wallet$/], action: { id: 'wallet', label: '포인트 지갑 보기', route: '/market/wallet' } },
  { id: 'ai-missions', title: 'AI 동행 미션', summary: '세 가지 미션을 캐릭터와 수행하고 서버가 실제 활동을 확인하면 미션별 포인트를 한 번 지급한다.', conditions: '자유 대화 제한이 끝나도 미션 진행과 고정 안내, 보상 지급은 계속 사용할 수 있다.', keywords: ['AI 미션', '미션', '동행', '보상'], paths: [/^\/ai$/], action: { id: 'ai-missions', label: 'AI 미션 보기', route: '/ai' } },
]

const allowedPathPatterns = [
  /^\/$/, /^\/ai$/, /^\/blog\/new$/, /^\/blog\/me\/manage(?:\/(?:settings|interests|categories|posts|market|trash))?$/,
  /^\/blog\/[a-z0-9-]+$/, /^\/write$/, /^\/post\/\d+(?:\/edit)?$/, /^\/feed$/, /^\/search$/, /^\/bookmarks$/,
  /^\/notifications$/, /^\/market(?:\/(?:new|recent|wishlist|wallet|cart|price-guide|coupons|\d+|\d+\/edit))?$/,
]

export const normalizeAiPath = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 120 || !value.startsWith('/')) return null
  const pathname = value.split(/[?#]/, 1)[0].replace(/\/{2,}/g, '/')
  return allowedPathPatterns.some((pattern) => pattern.test(pathname)) ? pathname : null
}

export const selectServiceKnowledge = (message: string, pathname: string | null, missionId?: string | null) => {
  const normalized = message.toLocaleLowerCase('ko-KR')
  return knowledge.map((entry) => {
    const keywordHits = entry.keywords.filter((keyword) => normalized.includes(keyword.toLocaleLowerCase('ko-KR'))).length
    const pathHit = pathname ? entry.paths.some((pattern) => pattern.test(pathname)) : false
    const missionHit = missionId && entry.id === 'ai-missions'
    return { entry, keywordHits, score: keywordHits * 5 + (pathHit ? 2 : 0) + (missionHit ? 3 : 0) }
  }).filter((match) => match.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)
}

export const serviceKnowledgePrompt = (matches: ReturnType<typeof selectServiceKnowledge>) => matches.length
  ? matches.map(({ entry }) => `- [${entry.id}] ${entry.title}: ${entry.summary} 조건: ${entry.conditions} 행동 ID: ${entry.action.id}`).join('\n')
  : '관련 서비스 지식 없음. 서비스 기능을 먼저 추천하거나 존재한다고 추측하지 않는다.'

export const resolveSuggestedAction = (id: unknown, matches: ReturnType<typeof selectServiceKnowledge>) => {
  if (typeof id !== 'string') return null
  return matches.find(({ entry }) => entry.action.id === id)?.entry.action ?? null
}

export const fallbackKnowledgeAction = (matches: ReturnType<typeof selectServiceKnowledge>) =>
  matches.find((match) => match.keywordHits > 0)?.entry.action ?? null

export const fallbackKnowledgeFact = (matches: ReturnType<typeof selectServiceKnowledge>) =>
  matches.find((match) => match.keywordHits > 0)?.entry ?? null

export const explicitNavigationAction = (message: string, matches: ReturnType<typeof selectServiceKnowledge>) => {
  if (!/(열어|이동|가고\s*싶|가자|보여\s*줘|보러|작성하|등록하|검색하|찾아\s*줘)/i.test(message)) return null
  return matches.find((match) => match.keywordHits > 0)?.entry.action ?? null
}
