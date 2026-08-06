import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Bell, BookOpen, Check, ChevronDown, ChevronRight, Compass, Eye, FileText, Layers3, Menu, MessageCircle, Palette, Pencil, PenLine, Search, Settings, Sparkles, Trash2, Volume2, X } from 'lucide-react'
type User = { id: number; email: string; nickname: string }
type Blog = { id: number; name: string; slug: string; description: string; owner?: { id: number; nickname: string }; isSubscribed?: boolean }
type Post = { id: number; url?: string; title: string; content?: string; excerpt?: string; status: 'DRAFT' | 'PUBLISHED'; viewCount: number; author: { id: number; nickname: string }; blog: { id: number; name: string; slug: string }; publishedAt?: string | null; updatedAt?: string }
type Page = { page: number; size: number; totalItems: number; totalPages: number }
type MarketItem = { id: number | string; title: string; description: string; category: string; tags: string[]; condition: 'NEW' | 'LIKE_NEW' | 'USED'; pricePoints: number; status: 'SELLING' | 'RESERVED' | 'SOLD'; seller: { id: number | string; nickname: string }; createdAt?: string }
type Conversation = { id: number | string; itemId: number | string; buyerId?: number; sellerId?: number }
type ChatMessage = { id: number | string; conversationId?: number | string; senderId: number | string; body: string; createdAt: string }
type SearchBlog = Blog & { owner?: { id: number; nickname: string } }

const API = import.meta.env.VITE_API_URL ?? ''
const solidColors = ['#9DB6AD', '#91A8B5', '#C79A7D', '#AAA982', '#C79A94', '#8FA3C2', '#C3A6B8', '#94B99B', '#C9AD78', '#92AEB0']
const solidColor = (index: number, offset = 0) => solidColors[(index + offset) % solidColors.length]
const sampleMarketItems: MarketItem[] = [
  { id: 'sample-1', title: '최애 캐릭터 한정 아크릴 스탠드', description: '개봉 후 진열만 한 상품입니다. 구성품은 본체와 받침대이며 눈에 띄는 흠집 없이 깨끗하게 보관했습니다.', category: '애니메이션 굿즈', tags: ['최애캐', '아크릴스탠드'], condition: 'LIKE_NEW', pricePoints: 18000, status: 'SELLING', seller: { id: 'sample-seller-1', nickname: '굿즈수집가' } },
  { id: 'sample-2', title: '공식 캐릭터 봉제인형', description: '미개봉 새 상품이며 태그가 포함되어 있습니다.', category: '인형', tags: ['공식굿즈', '봉제인형'], condition: 'NEW', pricePoints: 32000, status: 'SELLING', seller: { id: 'sample-seller-2', nickname: '덕질하는정글러' } },
  { id: 'sample-3', title: '극장판 특전 포토카드 세트', description: '슬리브에 보관해 상태가 좋습니다.', category: '포토카드', tags: ['극장판', '특전', '포토카드'], condition: 'LIKE_NEW', pricePoints: 9500, status: 'SELLING', seller: { id: 'sample-seller-3', nickname: '애니기록소' } },
]
const clonePosts = [
  ['부산 토박이 아저씨의 맛집 에세이', '야채값이 비싸서 리필이 안 된다는 물회집', 'taekwon-v1.tistory.com', 'FOOD'],
  ['즐거운 인생', '라면과 함께 먹으면 안 되는 식품', 'young303.tistory.com', 'LIFE'],
  ['느낌 올 때 여행을 떠나자!!', '[피서]무더위 시원한 국내 여행지 BEST 7 / 고지대,동굴 등', 'go-tour8282.tistory.com', 'TRAVEL'],
  ['생활전략노트', '에어컨 온도 몇 도가 적당할까?｜전기세 아끼면서 시원하게 쓰는 방법', 'mistytori.tistory.com', 'LIFE'],
  ['푸른하늘 파란하늘', '내일 텍사스로 가는 둘째', 'miyah806.tistory.com', 'LIFE'],
  ['일상의 작은 기록', '매직쉐프 가전제품 전시와 새로운 주방 이야기', 'daily-record.tistory.com', 'LIFE'],
  ['행복한 하루', '혼자 발견한 숨은 맛집과 여름날의 기록', 'happy-day.tistory.com', 'FOOD'],
]

const focusPosts = [
  ['구름 위에 핀 꽃-지리산 노고단 야생화', 'tour of wind'],
  ['국수와 함께 즐기는 국립고궁박물관', '국립고궁박물관'],
  ['시드니 대표 스테이크 맛집 추천', '시드니 라이프'],
  ['제주도 차돌새우 짬뽕 맛집', '여행의 새로운 이야기'],
  ['맥도날드 맥모닝 신메뉴 기록', '오늘의 맛있는 이야기'],
]

const tipPosts = [
  ['프론티어 새상품, 창고가 꽉 차게 만드는 부잡한 커피', 'Cafezinho 카페진호'],
  ['인천 카페 베이커리: 매일 만든 빵과 커피', 'Delightful Discoveries'],
  ['2026.7.29. 모카 한식과 작은 케이크', '루토의 맛있는 기록'],
  ['치즈 케이크를 맛있게 먹는 법', '커피와 디저트'],
  ['성산에서 요즘 만나는 새로운 여행법', '제주를 걷는 사람'],
]

const sidebarTips = [
  ['티스토리 로그인 및 가입하기'],
  ['카테고리 설정하기'],
  ['마크다운, HTML 모드로 작성하기'],
  ['제작한 스킨 적용하기'],
]

const creatorPages = [
  [
    { blog: '은벼리파파의 얼렁뚱땅 육아일기', meta: '맛집 분야 크리에이터 · 1,467명 구독', posts: [['흔한 중식은 가라! 입안 가득 터지는 육즙과 고소함'], ['겉바속촉 장어와 깊은 감칠맛 미소시루의 비밀']] },
    { blog: '홍나와 떼굴이의 맛집기행', meta: '맛집 분야 크리에이터 · 392명 구독', posts: [['강원도 횡성 맛집 횡성한우마을 후기'], ['용산아이파크몰 맛집 용호동낙지 후기']] },
  ],
  [
    { blog: '프레임속 풍경', meta: '여행 분야 크리에이터 · 826명 구독', posts: [['명옥헌원림 백일홍꽃이 피었습니다'], ['한여름 시원하게 걷기 좋은 숲길']] },
    { blog: '건강생활 연구소', meta: '건강 분야 크리에이터 · 618명 구독', posts: [['몸이 보내는 작은 신호를 놓치지 마세요'], ['매일 지키는 건강한 생활 습관']] },
  ],
]

if (typeof document !== 'undefined') {
  document.addEventListener('click', (event) => {
    const target = (event.target as Element | null)?.closest('[data-od-id="story-more"]') as HTMLElement | null
    if (!target) return
    event.preventDefault()
    event.stopPropagation()
    const module = target.closest('.story-creator')
    if (!module) return
    const current = module.querySelector('.story-info-popover')
    if (current) { current.remove(); target.setAttribute('aria-expanded', 'false'); return }
    const popover = document.createElement('div')
    popover.className = 'story-info-popover'
    popover.innerHTML = '<strong>스토리 크리에이터란?</strong><p>뚜렷한 주제를 가지고 우수한 창작 활동을 펼치는 창작자 입니다.</p><a href="/feed">선정조건 자세히보기 <span>›</span></a>'
    module.appendChild(popover)
    target.setAttribute('aria-expanded', 'true')
  }, true)
}

let csrfToken = ''
async function request<T>(path: string, options: RequestInit = {}) {
  const method = (options.method ?? 'GET').toUpperCase()
  if (method !== 'GET' && method !== 'HEAD' && !csrfToken) { const csrf = await fetch(`${API}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json()).catch(() => null); csrfToken = csrf?.data?.csrfToken ?? '' }
  const response = await fetch(`${API}/api${path}`, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...(options.headers ?? {}) }, ...options })
  if (response.status === 204) return undefined as T
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error?.message ?? '요청을 처리하지 못했습니다.')
  return body.data as T
}

function useRoute() {
  const [locationKey, setLocationKey] = useState(window.location.pathname + window.location.search)
  const path = locationKey.split('?')[0]
  useEffect(() => { const onPop = () => setLocationKey(window.location.pathname + window.location.search); window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop) }, [])
  const go = (to: string) => { window.history.pushState({}, '', to); setLocationKey(window.location.pathname + window.location.search); window.scrollTo(0, 0) }
  return { path, go }
}

function Header({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [mobile, setMobile] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [fixed, setFixed] = useState(false)
  const [query, setQuery] = useState('')
  const path = window.location.pathname
  useEffect(() => {
    const onScroll = () => setFixed(window.scrollY > 90)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    go('/search' + (query.trim() ? '?q=' + encodeURIComponent(query.trim()) : ''))
    setMobile(false)
  }
  const navigate = (to: string) => {
    go(to)
    setMobile(false)
    setProfileOpen(false)
  }
  const logout = async () => {
    try { await request('/auth/logout', { method: 'POST' }) } finally { window.location.href = '/' }
  }
  return <div className="site-header-slot"><header className={fixed ? 'site-header is-fixed' : 'site-header'} data-od-id="site-header">
    <div className="header-inner">
      <button className="brand" data-od-id="brand" onClick={() => navigate('/')}>티스토리</button>
      <nav className={mobile ? 'main-nav open' : 'main-nav'} aria-label="주요 메뉴">
        {[['홈', '/'], ['피드', '/feed'], ['마켓', '/market'], ['포럼', '/forum']].map(([label, to]) =>
          <button key={to} className={path === to || (to === '/market' && path.startsWith('/market/')) ? 'active' : ''} onClick={() => navigate(to)}>{label}</button>
        )}
      </nav>
      <form className="header-search" data-od-id="header-search" onSubmit={submit}>
        <input name="query" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="검색어 입력" placeholder="검색어 입력" />
        <button aria-label="검색"><Search size={17} /></button>
      </form>
      <div className="header-actions">
        <button className="header-notice" onClick={() => navigate('/notice/2702')}><Volume2 size={16} /><span>불법촬영물 유통 방지 조치 대상 확대 안내</span></button>
        {user
          ? <div className="signed-header-actions">
              <button className="header-icon-button" aria-label="알림"><Bell size={20} /></button>
              <button className="profile-trigger" aria-label="프로필 메뉴" aria-expanded={profileOpen} onClick={() => setProfileOpen(!profileOpen)}>{user.nickname.slice(0, 1).toUpperCase()}</button>
              {profileOpen && <>
                <button className="profile-menu-scrim" aria-label="프로필 메뉴 닫기" onClick={() => setProfileOpen(false)} />
                <div className="profile-popover" role="menu">
                  <div className="profile-summary"><span className="profile-avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{user.nickname}</strong><span>{user.email}</span><button onClick={() => navigate('/blog/me/manage')}>계정관리</button></div></div>
                  <div className="profile-blog"><p>운영중인 블로그</p><div><button onClick={() => navigate('/blog/me/manage')}>{user.nickname}</button><span><button aria-label="글쓰기" onClick={() => navigate('/write')}><Pencil size={16} /></button><button aria-label="블로그 관리" onClick={() => navigate('/blog/me/manage')}><Settings size={16} /></button></span></div></div>
                  <button className="profile-logout" role="menuitem" onClick={logout}>로그아웃</button>
                </div>
              </>}
            </div>
          : <button className="outline-button" onClick={onLogin}>시작하기</button>}
        <button className="mobile-trigger" onClick={() => setMobile(!mobile)} aria-expanded={mobile} aria-label={mobile ? '메뉴 닫기' : '메뉴 열기'}><Menu size={21} /></button>
      </div>
    </div>
  </header></div>
}

function AccountPanel({ user, go }: { user: User; go: (to: string) => void }) {
  return <section className="account-dashboard">
    <div className="account-dashboard-head"><span className="account-dashboard-avatar">{user.nickname.slice(0, 1).toUpperCase()}</span><div><strong>{user.nickname}</strong><span>구독자 <b>0명</b></span></div><button className="account-dashboard-toggle" aria-label="계정 정보 펼치기"><ChevronDown size={18} /></button></div>
    <div className="account-dashboard-actions"><button onClick={() => go('/write')}>글쓰기</button><button onClick={() => go('/blog/me/manage')}>내 블로그</button><button onClick={() => go('/blog/me/manage')}>관리</button></div>
    <dl><div><dt>조회수</dt><dd><b>1회</b><ChevronRight size={18} /></dd></div><div><dt>방문자</dt><dd><b>1명</b><ChevronRight size={18} /></dd></div><div><dt>수익</dt><dd><button onClick={() => go('/blog/me/manage')}><i>₩</i> 내 수익 <b>예측해보기</b></button><ChevronRight size={18} /></dd></div></dl>
  </section>
}

function Shell({ children, go, user, onLogin }: { children: React.ReactNode; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  return <><a className="skip-link" href="#main">본문 바로가기</a><Header go={go} user={user} onLogin={onLogin} />{children}<Footer go={go} /></>
}

function Footer({ go }: { go: (to: string) => void }) {
  const groups = [['메뉴가 궁금할 땐', [['홈', '/'], ['피드', '/feed'], ['마켓', '/market'], ['포럼', '/forum']]], ['사용하다 궁금할 땐', [['마켓 이용안내', '/market'], ['고객센터', '#'], ['공지사항', '/notice/2702']]], ['정책이 궁금할 땐', [['이용약관', '#'], ['이전 이용약관', '#'], ['운영정책', '#'], ['개인정보처리방침', '#'], ['청소년보호정책', '#']]], ['도움이 필요할 땐', [['권리침해신고', '#'], ['상거래 피해 구제신청', '#']]]]
  return <footer className="site-footer"><div className="footer-inner"><div className="footer-brand"><strong>TISTORY</strong><p>티스토리는 Daum에서 <img src="/assets/tistory/heart.png" alt="사랑" /> 을 담아 만듭니다.</p><small>© Daum Corp.</small></div><div className="footer-links">{groups.map(([title, links]) => <FooterGroup key={title as string} title={title as string} links={links as string[][]} go={go} />)}</div></div></footer>
}
function FooterGroup({ title, links, go }: { title: string; links: string[][]; go: (to: string) => void }) { const [open, setOpen] = useState(false); return <div className="footer-group"><button className="footer-title" onClick={() => setOpen(!open)}>{title}<ChevronDown size={14} className={open ? 'rotated' : ''} /></button><div className={open ? 'footer-list expanded' : 'footer-list'}>{links.map(([name, path]) => <button key={name} onClick={() => path.startsWith('/') && go(path)}>{name}</button>)}</div></div> }

function Pager({ page, total, onChange, label }: { page: number; total: number; onChange: (page: number) => void; label: string }) {
  const move = (delta: number) => onChange(((page - 1 + delta + total) % total) + 1)
  return <div className="tistory-pager" aria-label={label}>
    <button onClick={() => move(-1)} aria-label="이전 페이지"><ChevronDown size={14} /></button>
    <span><b>{page}</b>/ {total}</span>
    <button onClick={() => move(1)} aria-label="다음 페이지"><ChevronDown size={14} /></button>
  </div>
}

function StoryCreator({ page, onPage, go }: { page: number; onPage: (page: number) => void; go: (to: string) => void }) {
  const creators = creatorPages[(page - 1) % creatorPages.length]
  return <section className="sidebar-module story-creator">
    <div className="sidebar-heading"><h2>스토리 크리에이터 <em>ⓘ</em></h2></div>
    <div className="creator-page">
      {creators.map((creator, creatorIndex) => <article className="creator-card" key={creator.blog}>
        <div className="creator-profile">
          <button className="creator-name" onClick={() => go('/feed')}><strong>{creator.blog}</strong><span>{creator.meta}</span></button>
          <button className="creator-subscribe">+ 구독</button>
        </div>
        <div className="creator-posts">
          {creator.posts.map(([title], postIndex) => <button className="creator-post" key={title} onClick={() => go('/feed')}>
            <span><strong>{title}</strong><small>♡ {17 - postIndex * 3}　□ {6 + creatorIndex}　{postIndex ? '1일 전' : '8시간 전'}</small></span>
            <span className="creator-color" style={{ backgroundColor: solidColor(postIndex, creatorIndex * 3) }} aria-hidden="true" />
          </button>)}
        </div>
      </article>)}
    </div>
    <Pager page={page} total={16} onChange={onPage} label="스토리 크리에이터 페이지" />
  </section>
}

function Home({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [category, setCategory] = useState('')
  const [categoryPage, setCategoryPage] = useState(1)
  const [creatorPage, setCreatorPage] = useState(1)
  const [risingPage, setRisingPage] = useState(1)
  const [tipPage, setTipPage] = useState(1)
  const categories = [['전체', ''], ['라이프', 'LIFE'], ['여행', 'TRAVEL'], ['맛집', 'FOOD'], ['IT·테크', 'TECH']] as const
  const recommendations = clonePosts.slice(0, 5)
  const categoryPosts = clonePosts.filter((post) => !category || post[3] === category)
  const categoryPagePosts = categoryPosts.map((_, index) => categoryPosts[(index + categoryPage - 1) % categoryPosts.length])
  const shownTips = tipPage === 1 ? sidebarTips : [...sidebarTips].reverse()

  return <Shell go={go} user={user} onLogin={onLogin}>
    <main id="main" className="home-main">
      <div className="home-frame">
        <div className="home-content">
          <section className="today-tistory">
            <div className="today-card" style={{ backgroundColor: solidColor(0) }}>
              <div><p>오늘의 티스토리</p><h1>청계산 맛집 한소반쭈꾸미<br />대왕저수지 앞 불향 가득 쭈꾸미볶음 포장 후기</h1><button onClick={() => go('/feed')}>맛집 이야기</button></div>
            </div>
            <div className="today-dots"><i /><i /><b /><i /></div>
          </section>

          <section className="best-popularity" aria-label="추천글">
            <div className="best-list">
              {recommendations.map((post, index) => <article className="best-row" key={post[1]}>
                <b>{index + 1}/</b>
                <div className="best-copy"><button onClick={() => go('/feed')}>{post[0]}</button><h3><button onClick={() => go('/feed')}>{post[1]}</button></h3></div>
                <div className="post-thumb" style={{ backgroundColor: solidColor(index, 1) }} />
              </article>)}
            </div>
          </section>

          <section className="category-popularity">
            <div className="category-tabs" role="tablist">
              {categories.map(([label, value]) => <button key={label} role="tab" aria-selected={category === value} className={category === value ? 'active' : ''} onClick={() => { setCategory(value); setCategoryPage(1) }}>{label}</button>)}
            </div>
            <div className="category-grid">
              {categoryPagePosts.length ? categoryPagePosts.slice(0, 7).map((post, index) => <article key={post[1]}>
                <div><b>{post[0]}</b><h3>{post[1]}</h3><p>티스토리에서 만나는 오늘의 새로운 이야기입니다.</p><small>♡ {7 + index}　□ {5 + index}　5일 전</small></div>
                <div className="post-thumb" style={{ backgroundColor: solidColor(index, categoryPage) }} />
              </article>) : <div className="home-empty">이 카테고리의 글을 준비하고 있습니다.</div>}
            </div>
            <Pager page={categoryPage} total={7} onChange={setCategoryPage} label="카테고리 추천글 페이지" />
          </section>

          <HomeEditorial title="J의 주말 계획 🏃" posts={focusPosts} go={go} />
          <HomeEditorial title="오후에는 커피 한 잔 ☕" posts={tipPosts} go={go} />
        </div>

        <aside className="tistory-right">
          {user ? <AccountPanel user={user} go={go} /> : <section className="my-tistory">
            <p>티스토리에 로그인하시고 더 많은 기능을 이용해보세요!</p>
            <button onClick={onLogin}>●　카카오계정으로 시작하기</button>
          </section>}

          <StoryCreator page={creatorPage} onPage={setCreatorPage} go={go} />

          <section className="sidebar-module rising-module">
            <div className="sidebar-heading"><h2>구독 급상승 💕</h2></div>
            <div className="rising-card"><b>{risingPage % 2 ? '노병의 맛집 기행' : '여행을 기록하는 사람'}</b><strong>구독하고 싶은 이야기를 만나보세요</strong><button onClick={onLogin}>+ 구독</button></div>
            <Pager page={risingPage} total={20} onChange={setRisingPage} label="구독 급상승 페이지" />
          </section>

          <section className="sidebar-module tip-module">
            <div className="sidebar-heading"><h2>티스토리 운영 Tip 💡</h2></div>
            <div className="tip-grid">{shownTips.map(([title], index) => <button key={title} style={{ backgroundColor: solidColor(index, 5) }} onClick={() => go('/feed')}><span>{title}</span></button>)}</div>
            <Pager page={tipPage} total={2} onChange={setTipPage} label="티스토리 운영 팁 페이지" />
          </section>

          <section className="sidebar-module store-module">
            <div className="sidebar-heading"><h2>스킨 스토어　›</h2></div>
            <button className="store-preview" onClick={() => go('/skin')} aria-label="Whatever 스킨 보러가기" />
          </section>
        </aside>
      </div>
    </main>
  </Shell>
}

function HomeEditorial({ title, posts, go }: { title: string; posts: string[][]; go: (to: string) => void }) {
  return <section className="home-editorial">
    <div className="editorial-heading"><div><p>FOCUS</p><h2>{title}</h2><span>커피 나들이 없으면 요즘 뭐하세요.<br />진정한 쉼과 이야기를 담은 계획을 세워보아요.</span></div></div>
    <div className="editorial-list">{posts.map(([postTitle, blog], index) => <article key={postTitle}>
      <span>●　{blog}</span><h3><button onClick={() => go('/feed')}>{postTitle}</button></h3>
      <p>티스토리에서 만나는 새로운 이야기와 기록입니다. 일상 속 소소한 순간을 함께 나눠요.</p>
      <div className="editorial-thumb" style={{ backgroundColor: solidColor(index, title.length) }} />
      <small>♡ {18 + index * 9}　□ {7 + index}　{index + 1}일 전</small>
    </article>)}</div>
  </section>
}
function Feed({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get('q') ?? ''); const [sort, setSort] = useState<'latest' | 'popular'>('latest'); const [posts, setPosts] = useState<Post[]>([]); const [page, setPage] = useState<Page | null>(null); const [error, setError] = useState('')
  useEffect(() => { setError(''); const scope = user ? 'following' : 'public'; request<Post[]>(`/posts?scope=${scope}&q=${encodeURIComponent(query)}&sort=${sort}&page=1&size=10`).then((res) => { setPosts(res ?? []); setPage(null) }).catch((e) => setError(e.message)) }, [query, sort, user])
  return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="page-main"><div className="section-inner"><div className="page-intro"><p className="eyebrow">TISTORY FEED</p><h1>{user ? <>구독한 블로그의<br />새로운 이야기.</> : <>새로운 이야기를<br />발견해보세요.</>}</h1><div className="feed-search"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && setQuery(query.trim())} placeholder="제목, 본문, 블로그 검색" /></div></div><div className="feed-toolbar"><strong>{user ? '구독 피드' : '전체 글'} <em>{page?.totalItems ?? posts.length}</em></strong><div><button className={sort === 'latest' ? 'active' : ''} onClick={() => setSort('latest')}>최신순</button><button className={sort === 'popular' ? 'active' : ''} onClick={() => setSort('popular')}>인기순</button></div></div>{error ? <Empty text="피드를 불러오지 못했습니다." detail={error} /> : posts.length ? <div className="feed-list">{posts.map((post) => <PostRow key={post.id} post={post} go={go} />)}</div> : <Empty text={query ? `‘${query}’에 대한 글이 없습니다.` : user ? '구독 피드가 비어 있습니다.' : '아직 발행된 글이 없습니다.'} detail={user && !query ? '관심 있는 블로그를 구독하면 새 글이 여기에 표시됩니다.' : undefined} />}</div></main></Shell>
}

function PostRow({ post, go, mine = false }: { post: Post; go: (to: string) => void; mine?: boolean }) { return <article className="feed-row"><div><p className="post-blog">{post.blog.name}</p><h2><button onClick={() => go(`/post/${post.id}`)}>{post.title}</button></h2><p className="excerpt">{post.excerpt ?? post.content ?? '내용이 없습니다.'}</p><small>{post.author.nickname} · {post.status === 'DRAFT' ? '임시저장' : new Date(post.publishedAt ?? post.updatedAt ?? '').toLocaleDateString('ko-KR')} {mine && `· ${post.status}`}</small></div><div className="row-stat"><Eye size={15} /> {post.viewCount}</div></article> }
function Empty({ text, detail }: { text: string; detail?: string }) { return <div className="empty-state"><FileText size={24} /><strong>{text}</strong>{detail && <p>{detail}</p>}</div> }

function Auth({ mode, go, onSuccess }: { mode: 'login' | 'signup'; go: (to: string) => void; onSuccess: (user: User) => void }) {
  const [form, setForm] = useState({ email: '', nickname: '', password: '', passwordConfirm: '' })
  const [loginStep, setLoginStep] = useState<'intro' | 'credentials'>('intro')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const signup = mode === 'signup'
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const data = await request<{ user: User }>(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(form) })
      onSuccess(data.user)
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  if (!signup) return <main id="main" className="tistory-auth-page">
    <button className="standalone-close" onClick={() => go('/')} aria-label="로그인 닫기"><X size={24} /></button>
    <section className={`tistory-auth-card ${loginStep === 'credentials' ? 'credentials' : ''}`}>
      <button className="login-wordmark" onClick={() => go('/')}>TISTORY</button>
      {loginStep === 'intro' ? <>
        <p className="login-description">당신의 이야기가 콘텐츠가 됩니다.</p>
        <img className="login-visual" src="https://t1.daumcdn.net/tistory_admin/static/top/pc/img_login.png" alt="" />
        <button className="kakao-login-button" onClick={() => setLoginStep('credentials')}><span>●</span> 카카오계정으로 로그인</button>
        <button className="login-help" onClick={() => setLoginStep('credentials')}>내 티스토리 계정을 모르겠어요</button>
      </> : <>
        <p className="credential-title">카카오계정으로 로그인</p>
        <form className="credential-form" onSubmit={submit}>
          <label><span>카카오메일 아이디, 이메일, 전화번호</span><input required autoFocus type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="카카오메일 아이디, 이메일, 전화번호" /></label>
          <label><span>비밀번호</span><input required minLength={8} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="비밀번호" /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="credential-submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</button>
        </form>
        <div className="credential-links"><button onClick={() => go('/signup')}>회원가입</button><span>아이디 찾기　|　비밀번호 찾기</span></div>
        <button className="credential-back" onClick={() => { setLoginStep('intro'); setError('') }}><ArrowLeft size={14} /> 이전</button>
      </>}
    </section>
  </main>

  return <main id="main" className="auth-page"><div className="auth-panel"><button className="auth-brand" onClick={() => go('/')}>티스토리</button><p className="eyebrow">CREATE YOUR SPACE</p><h1>나만의 이야기를<br />시작해보세요.</h1><form onSubmit={submit}><label>닉네임<input required minLength={2} value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="닉네임을 입력하세요" /></label><label>이메일<input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></label><label>비밀번호<input required minLength={8} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="8자 이상 입력하세요" /></label><label>비밀번호 확인<input required type="password" value={form.passwordConfirm} onChange={(e) => setForm({ ...form, passwordConfirm: e.target.value })} placeholder="비밀번호를 한 번 더 입력하세요" /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '처리 중…' : '회원가입'} <ArrowRight size={16} /></button></form><p className="auth-switch">이미 계정이 있나요? <button onClick={() => go('/login')}>로그인</button></p></div></main>
}

function Agreement({ go }: { go: (to: string) => void }) {
  const decide = () => go('/blog/new')
  return <main id="main" className="agreement-page">
    <section className="agreement-panel">
      <h1>[선택] 티스토리 개인정보 제 3자 제공동의</h1>
      <table><tbody>
        <tr><th>제공받는 자</th><td>카카오</td></tr>
        <tr><th>제공 목적</th><td>카카오 서비스 내 데이터 분석 및 통계화 처리, 개인화 된 콘텐츠 추천 및 광고 마케팅에 활용</td></tr>
        <tr><th>제공 항목</th><td>블로그 방문, 활동 기록 등 티스토리 서비스 이용내역</td></tr>
        <tr><th>보유 및 이용 기간</th><td><strong>동의 철회 또는 회원 탈퇴 시 지체없이 파기</strong></td></tr>
      </tbody></table>
      <p>개인정보 제공에 대한 동의를 거부할 권리가 있으며, 동의를 거부하더라도 티스토리 서비스를 이용할 수 있습니다.<br />자세한 내용은 <button>개인정보처리방침</button>을 확인해주세요.</p>
      <div className="agreement-actions"><button onClick={decide}>동의안함</button><button onClick={decide}>동의</button></div>
    </section>
  </main>
}

function AgreementGate({ go, hasBlog }: { go: (to: string) => void; hasBlog: boolean | null }) {
  useEffect(() => { if (hasBlog) go('/') }, [go, hasBlog])
  if (hasBlog === null || hasBlog) return null
  return <Agreement go={go} />
}

function NoticeArticle({ go }: { go: (to: string) => void }) {
  return <div className="notice-blog-page">
    <a className="skip-link" href="#notice-content">본문 바로가기</a>
    <header className="notice-blog-header"><button onClick={() => go('/')}>TISTORY</button><button className="notice-menu" aria-label="메뉴"><Menu size={22} /></button></header>
    <main id="notice-content" className="notice-article">
      <div className="notice-inner">
        <div className="notice-title-group">
          <span className="notice-category">운영 정책 안내</span>
          <h1>[안내] 불법촬영물 유통 방지 조치 대상 확대 안내</h1>
          <p><strong>TISTORY</strong><time>2026. 6. 25. 11:08</time></p>
        </div>
        <article className="notice-body">
          <p>안녕하세요. 티스토리입니다.</p>
          <p>관련 법령에 따라 불법촬영물 등의 유통을 방지하고 이용자를 보호하기 위한 기술적·관리적 조치를 시행하고 있습니다.</p>
          <p>불법촬영물 유통 방지 조치의 적용 대상이 기존 동영상 파일에서 이미지 파일까지 확대됩니다. 새로운 의무가 추가되는 것이 아니라 기존 조치의 적용 범위가 이미지까지 넓어지는 변경입니다.</p>
          <p>정보통신망에서 불법촬영물을 유통하면 게시물 삭제와 검색 제한 등 필요한 조치가 적용되며 관련 법률에 따라 처벌될 수 있으니 서비스 이용 시 유의해 주세요.</p>
          <h2>— 다 음 —</h2>
          <dl className="notice-summary">
            <div><dt>시행일자</dt><dd>2026년 7월 1일부터</dd></div>
            <div><dt>확대 내용</dt><dd>동영상 파일에 적용되던 식별·게재 제한·검색 제한 조치를 이미지 파일까지 확대 적용</dd></div>
            <div><dt>적용 조치</dt><dd><ul><li>불법촬영물 신고 기능 제공 및 삭제 요청 처리</li><li>불법촬영물 식별 및 검색 제한</li><li>불법촬영물 식별 및 게재 제한</li><li>유통에 대한 사전 경고</li><li>기술적 조치에 관한 로그 기록 보관</li></ul></dd></div>
          </dl>
          <p className="notice-note">※ 이미지 식별 및 게재 제한 조치는 2026년 7월 1일부터 12월 31일까지 계도기간이 운영되며, 적용 일정은 변경될 수 있습니다.</p>
          <p>서비스에서 불법촬영물 유통을 발견했다면 해당 게시물의 신고 기능이나 유통 신고·삭제 요청 절차를 이용해 주세요. 접수된 내용은 검토 후 조치 결과를 안내합니다.</p>
          <p>안전한 디지털 환경을 위한 이용자 여러분의 관심과 참여를 부탁드립니다.</p>
          <p>감사합니다.</p>
        </article>
        <div className="notice-reactions"><button>♥　좋아요 257</button><button>공유하기</button></div>
        <section className="notice-related"><h2>'운영 정책 안내' 관련 글</h2>{['카카오 애드핏 신규 연동 신청 종료 안내', '동영상 백업 편의 기능 개선 알림', '동영상 백업 기간 연장 안내', '동영상 업로드 기능 조정 예정'].map((title) => <button key={title}><span>NO IMAGE</span>{title}<ChevronRight size={16} /></button>)}</section>
      </div>
    </main>
    <footer className="notice-blog-footer"><strong>TISTORY</strong><span>티스토리의 새로운 소식을 전합니다.</span><button onClick={() => go('/')}>티스토리 홈으로</button></footer>
  </div>
}

function BlogSetup({ go, onDone }: { go: (to: string) => void; onDone: (blog: Blog) => void }) { const [form, setForm] = useState({ name: '', slug: '', description: '' }); const [available, setAvailable] = useState<boolean | null>(null); const [error, setError] = useState(''); const check = async () => { try { const data = await request<{ slug: string; available: boolean }>(`/blogs/check-slug?slug=${encodeURIComponent(form.slug)}`); setAvailable(data.available) } catch (e) { setError((e as Error).message) } }; const submit = async (e: FormEvent) => { e.preventDefault(); try { const blog = await request<Blog>('/blogs', { method: 'POST', body: JSON.stringify(form) }); onDone(blog) } catch (e) { setError((e as Error).message) } }; return <main id="main" className="setup-page"><div className="setup-panel"><button className="back-button" onClick={() => go('/')}><ArrowLeft size={16} /> 홈으로</button><p className="eyebrow">SET UP YOUR BLOG</p><h1>이제 블로그를<br />만들어볼까요?</h1><p className="muted">공개 주소와 이름은 나중에 변경할 수 없으니 신중하게 정해주세요.</p><form onSubmit={submit}><label>블로그 이름<input required minLength={2} maxLength={30} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="예: 정글 개발 기록" /></label><label>블로그 주소<div className="slug-field"><input required pattern="[a-z0-9-]{3,30}" value={form.slug} onChange={(e) => { setForm({ ...form, slug: e.target.value }); setAvailable(null) }} placeholder="jungle-dev" /><span>.tistory.com</span><button type="button" onClick={check}>중복 확인</button></div>{available !== null && <small className={available ? 'available' : 'unavailable'}>{available ? '사용할 수 있는 주소입니다.' : '이미 사용 중인 주소입니다.'}</small>}</label><label>블로그 소개 <span className="counter">{form.description.length}/160</span><textarea maxLength={160} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="블로그를 한 줄로 소개해보세요." /></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={available === false}>블로그 만들기 <ArrowRight size={16} /></button></form></div></main> }

function BlogPage({ slug, go, user, onLogin }: { slug: string; go: (to: string) => void; user: User | null; onLogin: () => void }) { const [data, setData] = useState<{ blog: Blog; posts: { items: Post[]; pagination: Page } } | null>(null); const [busy, setBusy] = useState(false); useEffect(() => { request<typeof data>(`/blogs/${slug}?page=1&size=50`).then(setData).catch(() => setData(null)) }, [slug]); const mine = user && data?.blog.owner?.id === user.id; const toggleSubscription = async () => { if (!user) return onLogin(); if (!data || mine) return; setBusy(true); try { const subscribed = Boolean(data.blog.isSubscribed); await request(`/blogs/${slug}/subscription`, { method: subscribed ? 'DELETE' : 'POST' }); setData({ ...data, blog: { ...data.blog, isSubscribed: !subscribed } }) } finally { setBusy(false) } }; return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="blog-page"><div className="blog-cover"><div className="section-inner"><p className="eyebrow">MY BLOG</p><h1>{data?.blog.name ?? slug}</h1><p>{data?.blog.description ?? '이 블로그의 이야기를 불러오는 중입니다.'}</p>{mine ? <button className="outline-button light" onClick={() => go(`/blog/${slug}/manage`)}>관리하기</button> : data && <button className={`subscribe-button${data.blog.isSubscribed ? ' subscribed' : ''}`} disabled={busy} onClick={toggleSubscription}>{busy ? '처리 중…' : data.blog.isSubscribed ? '구독 중' : '+ 구독하기'}</button>}</div></div><div className="section-inner blog-content"><div className="blog-heading"><h2>최근 글</h2>{mine && <button className="primary-button compact" onClick={() => go('/write')}><PenLine size={15} /> 새 글 쓰기</button>}</div>{data?.posts.items.length ? data.posts.items.map((post) => <PostRow key={post.id} post={post} go={go} />) : <Empty text="아직 발행된 글이 없습니다." detail={mine ? '첫 글을 작성해 블로그를 채워보세요.' : undefined} />}</div></main></Shell> }

function Editor({ id, go }: { id?: string; go: (to: string) => void }) { const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED'>('DRAFT'); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); useEffect(() => { if (id) request<Post>(`/posts/${id}`).then((p) => { setTitle(p.title); setContent(p.content ?? ''); setStatus(p.status) }).catch((e) => setError(e.message)) }, [id]); const save = async (nextStatus: 'DRAFT' | 'PUBLISHED') => { setBusy(true); setError(''); try { const data = id ? await request<Post>(`/posts/${id}`, { method: 'PATCH', body: JSON.stringify({ title, content, status: nextStatus }) }) : await request<Post>('/posts', { method: 'POST', body: JSON.stringify({ title, content, status: nextStatus }) }); go(nextStatus === 'PUBLISHED' ? `/post/${data.id}` : '/blog/me/manage') } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }; return <main id="main" className="editor-page"><div className="editor-top"><button onClick={() => go('/blog/me/manage')}><ArrowLeft size={17} /> 나가기</button><div><button className="save-button" disabled={busy} onClick={() => save('DRAFT')}>임시저장</button><button className="publish-button" disabled={busy} onClick={() => save('PUBLISHED')}>발행하기</button></div></div><div className="editor-body"><input className="title-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="제목을 입력하세요" maxLength={100} /><div className="editor-meta"><span>{title.length}/100</span><span>{content.length.toLocaleString()}/20,000</span></div><textarea className="content-editor" value={content} onChange={(e) => setContent(e.target.value)} maxLength={20000} placeholder="여기에 이야기를 적어보세요." />{error && <p className="form-error">{error}</p>}</div></main> }

function PostDetail({ id, go, user, onLogin }: { id: string; go: (to: string) => void; user: User | null; onLogin: () => void }) { const [post, setPost] = useState<Post | null>(null); const [error, setError] = useState(''); useEffect(() => { request<Post>(`/posts/${id}`).then(setPost).catch((e) => setError(e.message)) }, [id]); const mine = post && user?.id === post.author.id; const remove = async () => { if (!post || !confirm('이 글을 삭제할까요?')) return; try { await request(`/posts/${post.id}`, { method: 'DELETE' }); go(`/blog/${post.blog.slug}`) } catch (e) { setError((e as Error).message) } }; return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="detail-page"><div className="detail-inner">{error ? <Empty text={error} /> : post && <><p className="eyebrow">{post.blog.name}</p><h1>{post.title}</h1><div className="detail-info"><span>{post.author.nickname}</span><span>{new Date(post.publishedAt ?? post.updatedAt ?? '').toLocaleDateString('ko-KR')}</span><span><Eye size={14} /> {post.viewCount}</span></div><div className="detail-content">{post.content}</div><div className="detail-actions">{mine && <><button className="outline-button" onClick={() => go(`/post/${post.id}/edit`)}>수정하기</button><button className="danger-button" onClick={remove}><Trash2 size={15} /> 삭제</button></>}</div></>}</div></main></Shell> }

function Manage({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) { const [blog, setBlog] = useState<Blog | null>(null); const [posts, setPosts] = useState<Post[]>([]); const [filter, setFilter] = useState('ALL'); useEffect(() => { request<Blog>('/blogs/me').then(setBlog).catch(() => {}); request<Post[]>('/posts?scope=mine&size=50').then((r) => setPosts(r ?? [])).catch(() => {}) }, []); const shown = useMemo(() => filter === 'ALL' ? posts : posts.filter((p) => p.status === filter), [filter, posts]); return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="manage-page"><div className="section-inner"><div className="manage-head"><div><p className="eyebrow">MY TISTORY</p><h1>{blog?.name ?? '내 블로그 관리'}</h1><p>{blog?.description}</p></div><button className="primary-button compact" onClick={() => go('/write')}><PenLine size={15} /> 새 글 쓰기</button></div><div className="manage-tabs"><div>{['ALL', 'PUBLISHED', 'DRAFT'].map((tab) => <button className={filter === tab ? 'active' : ''} onClick={() => setFilter(tab)} key={tab}>{tab === 'ALL' ? '전체' : tab === 'PUBLISHED' ? '발행됨' : '임시저장'}</button>)}</div><button onClick={() => blog && go(`/blog/${blog.slug}`)}>내 블로그 보기 <ArrowRight size={15} /></button></div>{shown.length ? <div className="feed-list">{shown.map((post) => <PostRow key={post.id} post={post} go={go} mine />)}</div> : <Empty text="작성한 글이 없습니다." detail="첫 글을 작성해보세요." />}</div></main></Shell> }

const conditionLabel: Record<MarketItem['condition'], string> = { NEW: '새 상품', LIKE_NEW: '거의 새 상품', USED: '사용감 있음' }

function MarketRow({ item, go }: { item: MarketItem; go: (to: string) => void }) {
  return <article className="feed-row market-row"><div><p className="post-blog">{item.category} · {conditionLabel[item.condition]}</p><h2><button onClick={() => go(`/market/${item.id}`)}>{item.title}</button></h2><p className="excerpt">{item.description}</p><p className="market-tags">{item.tags.map((tag) => <button key={tag} onClick={() => go(`/search?tab=market&q=${encodeURIComponent(`#${tag}`)}`)}>#{tag}</button>)}</p><small>{item.seller.nickname} · {item.status === 'SELLING' ? '판매 중' : item.status}</small></div><div className="row-stat"><strong>{item.pricePoints.toLocaleString()} P</strong></div></article>
}

function Market({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [query, setQuery] = useState(new URLSearchParams(window.location.search).get('q') ?? '')
  const [sort, setSort] = useState<'latest' | 'price_asc'>('latest')
  const [items, setItems] = useState<MarketItem[]>([])
  const [error, setError] = useState('')
  useEffect(() => { setError(''); request<MarketItem[]>(`/market/items?q=${encodeURIComponent(query)}&sort=${sort}&page=1&size=12`).then((data) => setItems(data ?? [])).catch((e) => { setItems([]); setError(e.message) }) }, [query, sort])
  const shown = items.length ? items : sampleMarketItems.filter((item) => !query || `${item.title} ${item.description} ${item.category} ${item.tags.join(' ')}`.toLowerCase().includes(query.replace(/^#/, '').toLowerCase()))
  return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="page-main"><div className="section-inner"><div className="page-intro"><p className="eyebrow">FANDOM GOODS MARKET</p><h1>좋아하는 작품의 굿즈를<br />팬들과 안전하게 거래해보세요.</h1><p className="muted">블로그 글과 분리된 1:1 팬덤 굿즈 마켓입니다. MVP에서는 포인트로 거래합니다.</p><form className="feed-search" onSubmit={(event) => { event.preventDefault(); setQuery(query.trim()) }}><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작품, 캐릭터, 상품명 또는 #키워드 검색" /></form></div><div className="feed-toolbar"><strong>판매 중인 상품 <em>{shown.length}</em></strong><div><button className={sort === 'latest' ? 'active' : ''} onClick={() => setSort('latest')}>최신순</button><button className={sort === 'price_asc' ? 'active' : ''} onClick={() => setSort('price_asc')}>낮은 가격순</button><button onClick={() => user ? go('/market/new') : onLogin()}>상품 등록</button></div></div>{error && <p className="form-error">API 연결 전이라 샘플 상품을 표시하고 있습니다. {error}</p>}<div className="feed-list">{shown.map((item) => <MarketRow key={item.id} item={item} go={go} />)}</div></div></main></Shell>
}

function MarketEditor({ go }: { go: (to: string) => void }) {
  const [form, setForm] = useState({ title: '', description: '', category: '', condition: 'NEW' as MarketItem['condition'], pricePoints: '', tags: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { const item = await request<MarketItem>('/market/items', { method: 'POST', body: JSON.stringify({ ...form, pricePoints: Number(form.pricePoints), tags: form.tags.split(/\s+/).map((tag) => tag.replace(/^#/, '')).filter(Boolean).slice(0, 5) }) }); go(`/market/${item.id}`) } catch (e) { setError((e as Error).message) } finally { setBusy(false) } }
  return <main id="main" className="setup-page"><div className="setup-panel"><button className="back-button" onClick={() => go('/market')}><ArrowLeft size={16} /> 마켓으로</button><p className="eyebrow">SELL YOUR GOODS</p><h1>팬덤 굿즈를<br />등록해보세요.</h1><form onSubmit={submit}><label>상품명<input required maxLength={100} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="상품명을 입력하세요" /></label><label>상품 설명<textarea required maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="상품 상태와 구성품을 자세히 적어주세요." /></label><label>카테고리<input required maxLength={50} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="예: 포토카드, 인형" /></label><label>상품 상태<select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as MarketItem['condition'] })}><option value="NEW">새 상품</option><option value="LIKE_NEW">거의 새 상품</option><option value="USED">사용감 있음</option></select></label><label>가격 포인트<input required min={1} max={1000000000} type="number" value={form.pricePoints} onChange={(e) => setForm({ ...form, pricePoints: e.target.value })} placeholder="예: 18000" /></label><label>검색 키워드<input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="#작품명 #캐릭터명 #굿즈종류" /></label><small>띄어쓰기로 구분하며 최대 5개까지 입력할 수 있습니다.</small>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? '등록 중…' : '상품 등록'} <ArrowRight size={16} /></button></form></div></main>
}

function MarketDetail({ id, go, user, onLogin }: { id: string; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const [item, setItem] = useState<MarketItem | null>(() => sampleMarketItems.find((entry) => String(entry.id) === id) ?? null)
  const [chatOpen, setChatOpen] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { if (!id.startsWith('sample-')) request<MarketItem>(`/market/items/${id}`).then(setItem).catch((e) => setError(e.message)) }, [id])
  const startChat = async () => { if (!user) return onLogin(); setChatOpen(true); setError(''); if (id.startsWith('sample-')) return; try { const room = await request<Conversation>(`/market/items/${id}/conversations`, { method: 'POST' }); setConversation(room); setMessages(await request<ChatMessage[]>(`/market/conversations/${room.id}/messages`) ?? []) } catch (e) { setError((e as Error).message) } }
  const send = async (event: FormEvent) => { event.preventDefault(); const body = message.trim(); if (!body) return; if (!conversation) { setMessages([...messages, { id: Date.now(), senderId: user?.id ?? 0, body, createdAt: new Date().toISOString() }]); setMessage(''); return } try { const sent = await request<ChatMessage>(`/market/conversations/${conversation.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) }); setMessages([...messages, sent]); setMessage('') } catch (e) { setError((e as Error).message) } }
  if (!item) return <Shell go={go} user={user} onLogin={onLogin}><main className="page-main"><div className="section-inner"><Empty text={error || '상품을 불러오는 중입니다.'} /></div></main></Shell>
  const shownMessages = messages.length ? messages : [{ id: 'welcome', senderId: item.seller.id, body: '안녕하세요! 상품에 대해 궁금한 점을 편하게 물어보세요.', createdAt: new Date().toISOString() }]
  return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="market-detail-page"><div className="section-inner"><button className="back-button" onClick={() => go('/market')}><ArrowLeft size={16} /> 마켓으로</button><div className="market-product"><section className="market-product-gallery"><div className="market-image-placeholder"><span>FANDOM GOODS</span><strong>{item.category}</strong></div><div className="market-image-dots"><b /><i /><i /></div></section><section className="market-product-info"><p className="post-blog">{item.category} · {conditionLabel[item.condition]}</p><h1>{item.title}</h1><strong className="market-price">{item.pricePoints.toLocaleString()} <small>P</small></strong><div className="market-tags">{item.tags.map((tag) => <button key={tag} onClick={() => go(`/search?tab=market&q=${encodeURIComponent(`#${tag}`)}`)}>#{tag}</button>)}</div><p className="market-description">{item.description}</p><div className="market-seller"><span className="market-seller-avatar">{item.seller.nickname[0]}</span><div><strong>{item.seller.nickname}</strong><span>본인 인증 완료 · 판매 상품</span></div></div><div className="market-actions"><button aria-label="찜하기">♡</button><button className="market-chat-button" onClick={startChat}>채팅하기</button><button className="market-buy-button" disabled>포인트 구매 준비 중</button></div><p className="market-safety">안전한 거래를 위해 결제 전 개인정보나 외부 메신저 ID를 보내지 마세요.</p></section></div></div>{chatOpen && <aside className="market-chat-panel" aria-label="판매자와 채팅"><div className="market-chat-head"><div><strong>{item.seller.nickname}</strong><span>{item.title}</span></div><button onClick={() => setChatOpen(false)} aria-label="채팅 닫기">×</button></div><div className="market-chat-messages">{shownMessages.map((entry) => <div className={`chat-message${entry.senderId === user?.id ? ' mine' : ''}`} key={entry.id}><p>{entry.body}</p><time>{new Date(entry.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</time></div>)}</div>{error && <p className="form-error">{error}</p>}<form className="market-chat-form" onSubmit={send}><input maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="메시지를 입력하세요" /><button>전송</button></form></aside>}</main></Shell>
}

function SearchPage({ go, user, onLogin }: { go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const params = new URLSearchParams(window.location.search)
  const [query, setQuery] = useState(params.get('q') ?? '')
  const [tab, setTab] = useState<'posts' | 'market' | 'blogs'>((['posts', 'market', 'blogs'].includes(params.get('tab') ?? '') ? params.get('tab') : 'posts') as 'posts' | 'market' | 'blogs')
  const [posts, setPosts] = useState<Post[]>([])
  const [market, setMarket] = useState<MarketItem[]>([])
  const [blogs, setBlogs] = useState<SearchBlog[]>([])
  const [error, setError] = useState('')
  useEffect(() => { Promise.allSettled([request<Post[]>(`/posts?scope=public&q=${encodeURIComponent(query)}&sort=latest&page=1&size=20`), request<MarketItem[]>(`/market/items?q=${encodeURIComponent(query)}&sort=latest&page=1&size=20`), request<SearchBlog[]>(`/blogs?q=${encodeURIComponent(query)}&page=1&size=20`)]).then(([postResult, marketResult, blogResult]) => { setPosts(postResult.status === 'fulfilled' ? postResult.value ?? [] : []); setMarket(marketResult.status === 'fulfilled' ? marketResult.value ?? [] : sampleMarketItems); setBlogs(blogResult.status === 'fulfilled' ? blogResult.value ?? [] : []); const failed = [postResult, marketResult, blogResult].find((result) => result.status === 'rejected'); setError(failed?.status === 'rejected' ? String(failed.reason?.message ?? failed.reason) : '') }) }, [query])
  const submit = (event: FormEvent) => { event.preventDefault(); go(`/search?tab=${tab}&q=${encodeURIComponent(query.trim())}`) }
  return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="page-main"><div className="section-inner"><div className="page-intro"><p className="eyebrow">INTEGRATED SEARCH</p><h1>‘{query}’ 검색 결과</h1><form className="feed-search" onSubmit={submit}><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="글, 마켓, 블로그 검색" /></form></div><div className="manage-tabs"><div><button className={tab === 'posts' ? 'active' : ''} onClick={() => setTab('posts')}>글 <em>{posts.length}</em></button><button className={tab === 'market' ? 'active' : ''} onClick={() => setTab('market')}>마켓 <em>{market.length}</em></button><button className={tab === 'blogs' ? 'active' : ''} onClick={() => setTab('blogs')}>블로그 <em>{blogs.length}</em></button></div></div>{error && <p className="form-error">일부 검색 결과를 불러오지 못했습니다. {error}</p>}<div className="feed-list">{tab === 'posts' ? posts.map((post) => <PostRow key={post.id} post={post} go={go} />) : tab === 'market' ? market.map((item) => <MarketRow key={item.id} item={item} go={go} />) : blogs.map((blog) => <article className="feed-row" key={blog.id}><div><p className="post-blog">BLOG</p><h2><button onClick={() => go(`/blog/${blog.slug}`)}>{blog.name}</button></h2><p className="excerpt">{blog.description || '블로그 소개가 없습니다.'}</p><small>{blog.owner?.nickname || '블로거'} · /blog/{blog.slug}</small></div></article>)}</div></div></main></Shell>
}

function StaticHub({ kind, go, user, onLogin }: { kind: 'skin' | 'forum'; go: (to: string) => void; user: User | null; onLogin: () => void }) {
  const skin = kind === 'skin'
  return <Shell go={go} user={user} onLogin={onLogin}><main id="main" className="page-main"><div className="section-inner"><div className="page-intro"><p className="eyebrow">{skin ? 'TISTORY SKIN' : 'TISTORY FORUM'}</p><h1>{skin ? '내 블로그에 어울리는 스킨을 만나보세요.' : '티스토리 이용자들과 이야기를 나눠보세요.'}</h1><p className="muted">{skin ? '다양한 레이아웃의 스킨을 둘러보고 블로그에 적용할 수 있습니다.' : '공지, 질문, 팁을 공유하는 포럼입니다.'}</p></div><div className="feed-list">{(skin ? ['Whatever 스킨', 'Book Club 스킨', 'Portfolio 스킨'] : ['티스토리 공지사항', '블로그 운영 질문', '스킨 제작 정보']).map((title, index) => <article className="feed-row" key={title}><div><p className="post-blog">{skin ? 'SKIN STORE' : 'FORUM'}</p><h2><button onClick={() => go('/feed')}>{title}</button></h2><p className="excerpt">{skin ? '콘텐츠가 돋보이는 티스토리 스킨입니다.' : '티스토리 사용자들과 나누는 이야기입니다.'}</p></div><div className="row-stat">{index + 1}</div></article>)}</div></div></main></Shell>
}

function App() {
  const { path, go } = useRoute()
  const [user, setUser] = useState<User | null>(null)
  const [hasBlog, setHasBlog] = useState<boolean | null>(null)
  const [loginOpen, setLoginOpen] = useState(false)
  useEffect(() => {
    request<{ user: User; blog: Blog | null }>('/me')
      .then((data) => { setUser(data.user); setHasBlog(Boolean(data.blog)) })
      .catch(() => setHasBlog(false))
  }, [])
  const onLogin = () => setLoginOpen(true)
  const finishLogin = async (nextUser: User) => {
    setUser(nextUser)
    const current = await request<{ user: User; blog: Blog | null }>('/me').catch(() => null)
    const blogExists = Boolean(current?.blog)
    setHasBlog(blogExists)
    go(blogExists ? '/' : '/agreement/third-party-consent')
  }
  let content: React.ReactNode
  if (path === '/login') content = <Auth mode="login" go={go} onSuccess={finishLogin} />
  else if (path === '/signup') content = <Auth mode="signup" go={go} onSuccess={(nextUser) => { setUser(nextUser); setHasBlog(false); go('/agreement/third-party-consent') }} />
  else if (path === '/agreement/third-party-consent') content = user ? <AgreementGate go={go} hasBlog={hasBlog} /> : <Auth mode="login" go={go} onSuccess={finishLogin} />
  else if (path === '/notice/2702') content = <NoticeArticle go={go} />
  else if (path === '/blog/new') content = <BlogSetup go={go} onDone={(blog) => { setHasBlog(true); go('/blog/' + blog.slug + '/manage') }} />
  else if (path === '/feed') content = <Feed go={go} user={user} onLogin={onLogin} />
  else if (path === '/search') content = <SearchPage go={go} user={user} onLogin={onLogin} />
  else if (path === '/market/new') content = user ? <MarketEditor go={go} /> : <Auth mode="login" go={go} onSuccess={(nextUser) => { setUser(nextUser); go('/market/new') }} />
  else if (path === '/market') content = <Market go={go} user={user} onLogin={onLogin} />
  else if (path.startsWith('/market/')) content = <MarketDetail id={path.split('/')[2]} go={go} user={user} onLogin={onLogin} />
  else if (path === '/skin') content = <Market go={go} user={user} onLogin={onLogin} />
  else if (path === '/forum') content = <StaticHub kind="forum" go={go} user={user} onLogin={onLogin} />
  else if (path === '/write') content = user ? <Editor go={go} /> : <Auth mode="login" go={go} onSuccess={(nextUser) => { setUser(nextUser); go('/write') }} />
  else if (path === '/blog/me/manage' || path.endsWith('/manage')) content = <Manage go={go} user={user} onLogin={onLogin} />
  else if (path.startsWith('/post/') && path.endsWith('/edit')) content = <Editor id={path.split('/')[2]} go={go} />
  else if (path.startsWith('/post/')) content = <PostDetail id={path.split('/')[2]} go={go} user={user} onLogin={onLogin} />
  else if (path.startsWith('/blog/')) content = <BlogPage slug={path.split('/')[2]} go={go} user={user} onLogin={onLogin} />
  else content = <Home go={go} user={user} onLogin={onLogin} />

  return <>{content}{loginOpen && <div className="modal-backdrop tistory-login-backdrop" role="dialog" aria-modal="true" aria-label="티스토리 로그인" onMouseDown={() => setLoginOpen(false)}>
    <div className="login-modal tistory-login-modal" onMouseDown={(event) => event.stopPropagation()}>
      <button className="modal-close" onClick={() => setLoginOpen(false)} aria-label="닫기"><X size={20} /></button>
      <strong className="login-wordmark">TISTORY</strong>
      <p className="login-description">당신의 이야기가 콘텐츠가 됩니다.</p>
      <img className="login-visual" src="https://t1.daumcdn.net/tistory_admin/static/top/pc/img_login.png" alt="" />
      <button className="kakao-login-button" onClick={() => { setLoginOpen(false); go('/login') }}><span>●</span> 카카오계정으로 로그인</button>
      <button className="login-help" onClick={() => { setLoginOpen(false); go('/login') }}>내 티스토리 계정을 모르겠어요</button>
    </div>
  </div>}</>
}
export default App
