import { useMemo, useState } from 'react'
import { ArrowRight, ChevronDown, Menu, Search, X } from 'lucide-react'

type BestPost = { blog: string; domain: string; title: string }

const bestPosts: BestPost[] = [
  { blog: '건강생활 연구소', domain: 'chamber9.tistory.com', title: '대장암 초기증상 10가지, 몸이 보내는 신호를 놓치지 마세요' },
  { blog: '프레임속 풍경', domain: 'yobo1700.tistory.com', title: '명옥헌원림 백일홍꽃' },
  { blog: '은벼리파파의 얼렁뚱땅 육아일기', domain: 'ribi.tistory.com', title: '카페 같은 분위기에서 즐기는 만두샤브전골 한상' },
  { blog: '황금냥이', domain: 'cholrangtokki.tistory.com', title: '비내린 뒤 엄청 돌아다니는 강아지들' },
  { blog: '빵 이야기 by 다온브레드', domain: 'livraison.tistory.com', title: '샌드위치가 맛있는 카페는 왜 빵부터 다를까요?' },
]

const footerGroups = [
  { title: '메뉴가 궁금할 땐', links: ['홈', '피드', '스킨', '포럼'] },
  { title: '사용하다 궁금할 땐', links: ['스킨가이드', '고객센터', '공지사항'] },
  { title: '정책이 궁금할 땐', links: ['이용약관', '이전 이용약관', '운영정책', '개인정보처리방침', '청소년보호정책', 'Email 수집거부정책'] },
]

function App() {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeGroup, setActiveGroup] = useState(0)
  const results = useMemo(() => bestPosts.filter((post) => `${post.blog} ${post.title}`.toLowerCase().includes(query.toLowerCase())), [query])

  return <div className="tistory-page">
    <a className="skip-link" href="#main">본문 바로가기</a>
    <header className="tistory-header">
      <div className="header-inner">
        <button className="tistory-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>티스토리</button>
        <nav className={mobileOpen ? 'main-nav open' : 'main-nav'} aria-label="메뉴">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>홈</button>
          <button onClick={() => document.getElementById('best')?.scrollIntoView({ behavior: 'smooth' })}>피드</button>
          <button onClick={() => setLoginOpen(true)}>내 티스토리</button>
        </nav>
        <div className="header-actions"><button className="search-trigger" onClick={() => setSearchOpen(true)} aria-label="검색"><Search size={20} /></button><button className="start-button" onClick={() => setLoginOpen(true)}>시작하기</button><button className="mobile-trigger" onClick={() => setMobileOpen(!mobileOpen)} aria-label="메뉴"><Menu size={22} /></button></div>
      </div>
    </header>

    <main id="main">
      <section className="search-section">
        <div className="search-content"><h1>티스토리</h1><p>당신의 이야기가 콘텐츠가 됩니다.</p><form className="home-search" onSubmit={(event) => { event.preventDefault(); setSearchOpen(true) }}><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="티스토리 검색" aria-label="티스토리 검색" /><button type="submit">검색</button></form></div>
      </section>

      <section className="best-section" id="best"><div className="section-inner"><div className="section-title"><h2>인기글 베스트</h2><button onClick={() => setActiveGroup(activeGroup === 0 ? 1 : 0)}>전체보기 <ArrowRight size={16} /></button></div><div className="best-list">{results.map((post, index) => <article className="best-row" key={post.title}><div className="best-number">{index + 1}</div><div className={`best-thumb thumb-${index + 1}`}><span>{['HEALTH', 'TRAVEL', 'FOOD', 'LIFE', 'BAKERY'][index]}</span></div><div className="best-info"><a className="blog-name" href={`https://${post.domain}`} onClick={(event) => event.preventDefault()}>{post.blog}</a><h3><a href="#post" onClick={(event) => event.preventDefault()}>{post.title}</a></h3><p>{post.domain}</p></div><button className="row-arrow" aria-label="글 보기"><ArrowRight size={17} /></button></article>)}</div>{results.length === 0 && <div className="no-results">검색 결과가 없습니다.</div>}</div></section>

      <section className="my-section"><div className="section-inner my-inner"><div><p className="section-label">나의 티스토리</p><h2>티스토리에 로그인하시고<br />더 많은 기능을 이용해보세요!</h2></div><button className="kakao-button" onClick={() => setLoginOpen(true)}><span className="kakao-symbol">●</span> 카카오계정으로 시작하기 <ArrowRight size={16} /></button></div></section>
    </main>

    <footer className="tistory-footer"><div className="footer-inner"><div className="footer-brand"><strong>TISTORY</strong><p>티스토리는 Daum에서 <span className="heart">♥</span> 을 담아 만듭니다.</p><small>© Daum Corp.</small></div><div className="footer-links">{footerGroups.map((group, index) => <div className="footer-group" key={group.title}><button className="footer-group-title" onClick={() => setActiveGroup(activeGroup === index ? -1 : index)}>{group.title}<ChevronDown size={14} className={activeGroup === index ? 'rotated' : ''} /></button><div className={activeGroup === index ? 'footer-link-list expanded' : 'footer-link-list'}>{group.links.map((link) => <a key={link} href="#footer" onClick={(event) => event.preventDefault()}>{link}</a>)}</div></div>)}</div></div></footer>
    {searchOpen && <div className="dialog-backdrop" onMouseDown={() => setSearchOpen(false)}><div className="search-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" onClick={() => setSearchOpen(false)} aria-label="닫기"><X /></button><h2>티스토리 검색</h2><div className="dialog-search"><Search size={19} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="검색어를 입력하세요" /><button onClick={() => setSearchOpen(false)}>검색</button></div><p>{query ? `${results.length}개의 글을 찾았습니다.` : '블로그와 글을 검색해보세요.'}</p></div></div>}
    {loginOpen && <div className="dialog-backdrop" onMouseDown={() => setLoginOpen(false)}><div className="login-dialog" onMouseDown={(event) => event.stopPropagation()}><button className="dialog-close" onClick={() => setLoginOpen(false)} aria-label="닫기"><X /></button><div className="login-logo">티스토리</div><p>당신의 이야기가 콘텐츠가 됩니다.</p><button className="kakao-login" onClick={() => setLoginOpen(false)}>카카오계정으로 로그인</button><button className="login-help">내 티스토리 계정을 모르겠어요</button></div></div>}
  </div>
}

export default App
