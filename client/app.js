(() => {
  'use strict'

  const root = document.querySelector('#root')
  const API = document.querySelector('meta[name="api-base"]')?.content || ''
  const colors = ['#9DB6AD', '#91A8B5', '#C79A7D', '#AAA982', '#C79A94', '#8FA3C2', '#C3A6B8', '#94B99B', '#C9AD78', '#92AEB0']
  const samplePosts = [
    ['부산 토박이 아저씨의 맛집 에세이', '야채값이 비싸서 리필이 안 된다는 물회집', 'FOOD'],
    ['즐거운 인생', '라면과 함께 먹으면 안 되는 식품', 'LIFE'],
    ['느낌 올 때 여행을 떠나자!!', '[피서]무더위 시원한 국내 여행지 BEST 7 / 고지대,동굴 등', 'TRAVEL'],
    ['생활전략노트', '에어컨 온도 몇 도가 적당할까｜전기세 아끼면서 시원하게 쓰는 방법', 'LIFE'],
    ['푸른하늘 파란하늘', '내일 텍사스로 가는 둘째', 'LIFE'],
    ['일상의 작은 기록', '매직쉐프 가전제품 전시와 새로운 주방 이야기', 'LIFE'],
    ['행복한 하루', '혼자 발견한 숨은 맛집과 여름날의 기록', 'FOOD'],
  ]
  const editorial = [
    ['구름 위에 핀 꽃-지리산 노고단 야생화', 'tour of wind'],
    ['국수와 함께 즐기는 국립고궁박물관', '국립고궁박물관'],
    ['시드니 대표 스테이크 맛집 추천', '시드니 라이프'],
    ['제주도 차돌새우 짬뽕 맛집', '여행의 새로운 이야기'],
    ['맥도날드 맥모닝 신메뉴 기록', '오늘의 맛있는 이야기'],
  ]
  const state = {
    user: null, csrf: '', modal: false, profile: false, mobile: false,
    category: '', categoryPage: 1, creatorPage: 1, risingPage: 1, tipPage: 1,
    feedSort: 'latest', feedPosts: [], feedError: '', pageData: null, manageFilter: 'ALL',
  }

  const esc = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
  const color = (index, offset = 0) => colors[(index + offset) % colors.length]
  const path = () => location.pathname
  const date = (value) => value ? new Date(value).toLocaleDateString('ko-KR') : ''

  async function api(url, options = {}) {
    const method = (options.method || 'GET').toUpperCase()
    if (!['GET', 'HEAD'].includes(method) && !state.csrf) {
      const result = await fetch(`${API}/api/auth/csrf`, { credentials: 'include' }).then((r) => r.json()).catch(() => null)
      state.csrf = result?.data?.csrfToken || ''
    }
    const response = await fetch(`${API}/api${url}`, {
      credentials: 'include', ...options,
      headers: { 'Content-Type': 'application/json', ...(state.csrf ? { 'X-CSRF-Token': state.csrf } : {}), ...(options.headers || {}) },
    })
    if (response.status === 204) return
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error?.message || '요청을 처리하지 못했습니다.')
    return body.data
  }

  function go(url) {
    history.pushState({}, '', url)
    Object.assign(state, { modal: false, profile: false, mobile: false, pageData: null })
    scrollTo(0, 0)
    render()
  }

  function header() {
    const nav = [['홈', '/'], ['피드', '/feed'], ['스킨', '/skin'], ['포럼', '/forum']]
    const account = state.user ? `<div class="signed-header-actions"><button class="header-icon-button" aria-label="알림">●</button><button class="profile-trigger" data-action="profile">${esc(state.user.nickname[0].toUpperCase())}</button>${state.profile ? `<button class="profile-menu-scrim" data-action="profile-close"></button><div class="profile-popover"><div class="profile-summary"><span class="profile-avatar">${esc(state.user.nickname[0])}</span><div><strong>${esc(state.user.nickname)}</strong><span>${esc(state.user.email)}</span><button data-go="/blog/me/manage">계정관리</button></div></div><div class="profile-blog"><p>운영중인 블로그</p><div><button data-go="/blog/me/manage">${esc(state.user.nickname)}</button><span><button data-go="/write">✎</button><button data-go="/blog/me/manage">⚙</button></span></div></div><button class="profile-logout" data-action="logout">로그아웃</button></div>` : ''}</div>` : '<button class="outline-button" data-action="modal-open">시작하기</button>'
    return `<a class="skip-link" href="#main">본문 바로가기</a><div class="site-header-slot"><header class="site-header" data-od-id="site-header"><div class="header-inner"><button class="brand" data-go="/">티스토리</button><nav class="main-nav ${state.mobile ? 'open' : ''}">${nav.map(([label, url]) => `<button data-go="${url}" class="${path() === url ? 'active' : ''}">${label}</button>`).join('')}</nav><form class="header-search" id="header-search"><input name="query" placeholder="검색어 입력" aria-label="검색어 입력"><button>⌕</button></form><div class="header-actions"><button class="header-notice" data-go="/notice/2702"><span>◖</span><span>불법촬영물 유통 방지 조치 대상 확대 안내</span></button>${account}<button class="mobile-trigger" data-action="mobile">☰</button></div></div></header></div>`
  }

  function footer() {
    const groups = [['메뉴가 궁금할 땐', [['홈', '/'], ['피드', '/feed'], ['스킨', '/skin'], ['포럼', '/forum']]], ['사용하다 궁금할 땐', [['스킨가이드', '#'], ['고객센터', '#'], ['공지사항', '/notice/2702']]], ['정책이 궁금할 땐', [['이용약관', '#'], ['운영정책', '#'], ['개인정보처리방침', '#']]], ['도움이 필요할 땐', [['권리침해신고', '#'], ['상거래 피해 구제신청', '#']]]]
    return `<footer class="site-footer"><div class="footer-inner"><div class="footer-brand"><strong>TISTORY</strong><p>티스토리는 Daum에서 <img src="/assets/tistory/heart.png" alt="사랑"> 을 담아 만듭니다.</p><small>© Daum Corp.</small></div><div class="footer-links">${groups.map(([title, links]) => `<div class="footer-group"><button class="footer-title" data-action="footer">${title}<span>⌄</span></button><div class="footer-list">${links.map(([label, url]) => `<button ${url.startsWith('/') ? `data-go="${url}"` : ''}>${label}</button>`).join('')}</div></div>`).join('')}</div></div></footer>`
  }

  function modal() {
    return state.modal ? `<div class="modal-backdrop tistory-login-backdrop" data-action="modal-close"><div class="login-modal tistory-login-modal" data-modal><button class="modal-close" data-action="modal-close">×</button><strong class="login-wordmark">TISTORY</strong><p class="login-description">당신의 이야기가 콘텐츠가 됩니다.</p><img class="login-visual" src="https://t1.daumcdn.net/tistory_admin/static/top/pc/img_login.png" alt=""><button class="kakao-login-button" data-go="/login"><span>●</span> 카카오계정으로 로그인</button><button class="login-help" data-go="/login">내 티스토리 계정을 모르겠어요</button></div></div>` : ''
  }
  const shell = (content) => header() + content + footer() + modal()
  const pager = (key, page, total, label) => `<div class="tistory-pager" aria-label="${label}"><button data-page="${key}" data-delta="-1" data-total="${total}">‹</button><span><b>${page}</b>/ ${total}</span><button data-page="${key}" data-delta="1" data-total="${total}">›</button></div>`

  function homeEditorial(title) {
    return `<section class="home-editorial"><div class="editorial-heading"><div><p>FOCUS</p><h2>${title}</h2><span>진정한 쉼과 이야기를 담은 계획을 세워보아요.</span></div></div><div class="editorial-list">${editorial.map(([post, blog], index) => `<article><span>●　${blog}</span><h3><button data-go="/feed">${post}</button></h3><p>티스토리에서 만나는 새로운 이야기와 기록입니다.</p><div class="editorial-thumb" style="background:${color(index, title.length)}"></div><small>♡ ${18 + index * 9}　□ ${7 + index}　${index + 1}일 전</small></article>`).join('')}</div></section>`
  }

  function home() {
    const categories = [['전체', ''], ['라이프', 'LIFE'], ['여행', 'TRAVEL'], ['맛집', 'FOOD'], ['IT·테크', 'TECH']]
    const filtered = samplePosts.filter((post) => !state.category || post[2] === state.category)
    const rotated = filtered.map((_, index) => filtered[(index + state.categoryPage - 1) % filtered.length])
    const creators = state.creatorPage % 2 ? [['은벼리파파의 얼렁뚱땅 육아일기', '맛집 분야 크리에이터 · 1,467명 구독'], ['홍나와 떼굴이의 맛집기행', '맛집 분야 크리에이터 · 392명 구독']] : [['프레임속 풍경', '여행 분야 크리에이터 · 826명 구독'], ['건강생활 연구소', '건강 분야 크리에이터 · 618명 구독']]
    const account = state.user ? `<section class="account-dashboard"><div class="account-dashboard-head"><span class="account-dashboard-avatar">${esc(state.user.nickname[0])}</span><div><strong>${esc(state.user.nickname)}</strong><span>구독자 <b>0명</b></span></div></div><div class="account-dashboard-actions"><button data-go="/write">글쓰기</button><button data-go="/blog/me/manage">내 블로그</button><button data-go="/blog/me/manage">관리</button></div></section>` : `<section class="my-tistory"><p>티스토리에 로그인하시고 더 많은 기능을 이용해보세요!</p><button data-action="modal-open">●　카카오계정으로 시작하기</button></section>`
    return shell(`<main id="main" class="home-main"><div class="home-frame"><div class="home-content"><section class="today-tistory"><div class="today-card" style="background:${color(0)}"><div><p>오늘의 티스토리</p><h1>청계산 맛집 한소반쭈꾸미<br>대왕저수지 앞 불향 가득 쭈꾸미볶음 포장 후기</h1><button data-go="/feed">맛집 이야기</button></div></div><div class="today-dots"><i></i><i></i><b></b><i></i></div></section><section class="best-popularity"><div class="best-list">${samplePosts.slice(0, 5).map((post, index) => `<article class="best-row"><b>${index + 1}/</b><div class="best-copy"><button data-go="/feed">${post[0]}</button><h3><button data-go="/feed">${post[1]}</button></h3></div><div class="post-thumb" style="background:${color(index, 1)}"></div></article>`).join('')}</div></section><section class="category-popularity"><div class="category-tabs">${categories.map(([label, value]) => `<button data-category="${value}" class="${state.category === value ? 'active' : ''}">${label}</button>`).join('')}</div><div class="category-grid">${rotated.length ? rotated.map((post, index) => `<article><div><b>${post[0]}</b><h3>${post[1]}</h3><p>티스토리에서 만나는 오늘의 새로운 이야기입니다.</p><small>♡ ${7 + index}　□ ${5 + index}　5일 전</small></div><div class="post-thumb" style="background:${color(index, state.categoryPage)}"></div></article>`).join('') : '<div class="home-empty">이 카테고리의 글을 준비하고 있습니다.</div>'}</div>${pager('categoryPage', state.categoryPage, 7, '카테고리 추천글')}</section>${homeEditorial('J의 주말 계획 🏃')}${homeEditorial('오후에는 커피 한 잔 ☕')}</div><aside class="tistory-right">${account}<section class="sidebar-module story-creator"><div class="sidebar-heading"><h2>스토리 크리에이터 <em>ⓘ</em></h2></div><div class="creator-page">${creators.map(([name, meta], index) => `<article class="creator-card"><div class="creator-profile"><button class="creator-name" data-go="/feed"><strong>${name}</strong><span>${meta}</span></button><button class="creator-subscribe" data-action="modal-open">+ 구독</button></div><div class="creator-posts"><button class="creator-post" data-go="/feed"><span><strong>오늘 발견한 특별한 이야기</strong><small>♡ ${17 - index * 3}　□ ${6 + index}　8시간 전</small></span><span class="creator-color" style="background:${color(index)}"></span></button></div></article>`).join('')}</div>${pager('creatorPage', state.creatorPage, 16, '스토리 크리에이터')}</section><section class="sidebar-module rising-module"><div class="sidebar-heading"><h2>구독 급상승 💕</h2></div><div class="rising-card"><b>${state.risingPage % 2 ? '노병의 맛집 기행' : '여행을 기록하는 사람'}</b><strong>구독하고 싶은 이야기를 만나보세요</strong><button data-action="modal-open">+ 구독</button></div>${pager('risingPage', state.risingPage, 20, '구독 급상승')}</section><section class="sidebar-module tip-module"><div class="sidebar-heading"><h2>티스토리 운영 Tip 💡</h2></div><div class="tip-grid">${['티스토리 로그인 및 가입하기', '카테고리 설정하기', '마크다운, HTML 모드로 작성하기', '제작한 스킨 적용하기'].map((title, index) => `<button style="background:${color(index, 5)}" data-go="/feed"><span>${title}</span></button>`).join('')}</div>${pager('tipPage', state.tipPage, 2, '운영 팁')}</section><section class="sidebar-module store-module"><div class="sidebar-heading"><h2>스킨 스토어　›</h2></div><button class="store-preview" data-go="/skin"></button></section></aside></div></main>`)
  }

  const empty = (text, detail = '') => `<div class="empty-state"><span>▤</span><strong>${esc(text)}</strong>${detail ? `<p>${esc(detail)}</p>` : ''}</div>`
  const postRow = (post, mine = false) => `<article class="feed-row"><div><p class="post-blog">${esc(post.blog?.name)}</p><h2><button data-go="/post/${post.id}">${esc(post.title)}</button></h2><p class="excerpt">${esc(post.excerpt || post.content || '내용이 없습니다.')}</p><small>${esc(post.author?.nickname)} · ${post.status === 'DRAFT' ? '임시저장' : date(post.publishedAt || post.updatedAt)} ${mine ? `· ${post.status}` : ''}</small></div><div class="row-stat">◉ ${Number(post.viewCount || 0)}</div></article>`

  function feed() {
    const query = new URLSearchParams(location.search).get('q') || ''
    const list = state.feedError ? empty('피드를 불러오지 못했습니다.', state.feedError) : state.feedPosts.length ? `<div class="feed-list">${state.feedPosts.map((post) => postRow(post)).join('')}</div>` : empty(query ? `‘${query}’에 대한 글이 없습니다.` : state.user ? '구독 피드가 비어 있습니다.' : '아직 발행된 글이 없습니다.')
    return shell(`<main id="main" class="page-main"><div class="section-inner"><div class="page-intro"><p class="eyebrow">TISTORY FEED</p><h1>${state.user ? '구독한 블로그의<br>새로운 이야기.' : '새로운 이야기를<br>발견해보세요.'}</h1><form class="feed-search" id="feed-search"><span>⌕</span><input name="query" value="${esc(query)}" placeholder="제목, 본문, 블로그 검색"></form></div><div class="feed-toolbar"><strong>${state.user ? '구독 피드' : '전체 글'} <em>${state.feedPosts.length}</em></strong><div><button data-sort="latest" class="${state.feedSort === 'latest' ? 'active' : ''}">최신순</button><button data-sort="popular" class="${state.feedSort === 'popular' ? 'active' : ''}">인기순</button></div></div>${list}</div></main>`)
  }

  function auth(mode) {
    const signup = mode === 'signup'
    const credentials = sessionStorage.getItem('login-step') === 'credentials'
    if (!signup && !credentials) return `<main id="main" class="tistory-auth-page"><button class="standalone-close" data-go="/">×</button><section class="tistory-auth-card"><button class="login-wordmark" data-go="/">TISTORY</button><p class="login-description">당신의 이야기가 콘텐츠가 됩니다.</p><img class="login-visual" src="https://t1.daumcdn.net/tistory_admin/static/top/pc/img_login.png" alt=""><button class="kakao-login-button" data-action="credentials"><span>●</span> 카카오계정으로 로그인</button><button class="login-help" data-action="credentials">내 티스토리 계정을 모르겠어요</button></section></main>`
    if (!signup) return `<main id="main" class="tistory-auth-page"><button class="standalone-close" data-go="/">×</button><section class="tistory-auth-card credentials"><button class="login-wordmark" data-go="/">TISTORY</button><p class="credential-title">카카오계정으로 로그인</p><form class="credential-form" id="auth-form"><label><span>이메일</span><input required type="email" name="email" placeholder="카카오메일 아이디, 이메일, 전화번호"></label><label><span>비밀번호</span><input required minlength="8" type="password" name="password" placeholder="비밀번호"></label><p class="form-error" hidden></p><button class="credential-submit">로그인</button></form><div class="credential-links"><button data-go="/signup">회원가입</button><span>아이디 찾기　|　비밀번호 찾기</span></div><button class="credential-back" data-action="intro">← 이전</button></section></main>`
    return `<main id="main" class="auth-page"><div class="auth-panel"><button class="auth-brand" data-go="/">티스토리</button><p class="eyebrow">CREATE YOUR SPACE</p><h1>나만의 이야기를<br>시작해보세요.</h1><form id="auth-form"><label>닉네임<input required minlength="2" name="nickname" placeholder="닉네임을 입력하세요"></label><label>이메일<input required type="email" name="email" placeholder="email@example.com"></label><label>비밀번호<input required minlength="8" type="password" name="password" placeholder="8자 이상 입력하세요"></label><label>비밀번호 확인<input required type="password" name="passwordConfirm" placeholder="비밀번호를 한 번 더 입력하세요"></label><p class="form-error" hidden></p><button class="primary-button">회원가입　→</button></form><p class="auth-switch">이미 계정이 있나요? <button data-go="/login">로그인</button></p></div></main>`
  }

  function agreement() {
    return `<main id="main" class="agreement-page"><section class="agreement-panel"><h1>[선택] 티스토리 개인정보 제 3자 제공동의</h1><table><tbody><tr><th>제공받는 자</th><td>카카오</td></tr><tr><th>제공 목적</th><td>데이터 분석 및 통계화 처리, 개인화 콘텐츠 추천 및 광고 마케팅 활용</td></tr><tr><th>제공 항목</th><td>블로그 방문, 활동 기록 등 티스토리 서비스 이용내역</td></tr><tr><th>보유 및 이용 기간</th><td><strong>동의 철회 또는 회원 탈퇴 시 지체없이 파기</strong></td></tr></tbody></table><p>동의를 거부하더라도 티스토리 서비스를 이용할 수 있습니다.</p><div class="agreement-actions"><button data-consent="declined">동의안함</button><button data-consent="accepted">동의</button></div></section></main>`
  }

  function notice() {
    return `<div class="notice-blog-page"><header class="notice-blog-header"><button data-go="/">TISTORY</button><button class="notice-menu">☰</button></header><main id="notice-content" class="notice-article"><div class="notice-inner"><div class="notice-title-group"><span class="notice-category">운영 정책 안내</span><h1>[안내] 불법촬영물 유통 방지 조치 대상 확대 안내</h1><p><strong>TISTORY</strong><time>2026. 6. 25. 11:08</time></p></div><article class="notice-body"><p>안녕하세요. 티스토리입니다.</p><p>관련 법령에 따라 불법촬영물 등의 유통을 방지하고 이용자를 보호하기 위한 기술적·관리적 조치를 시행하고 있습니다.</p><p>조치 적용 대상이 기존 동영상 파일에서 이미지 파일까지 확대됩니다.</p><h2>— 다 음 —</h2><dl class="notice-summary"><div><dt>시행일자</dt><dd>2026년 7월 1일부터</dd></div><div><dt>확대 내용</dt><dd>식별·게재 제한·검색 제한 조치를 이미지 파일까지 확대 적용</dd></div><div><dt>적용 조치</dt><dd><ul><li>불법촬영물 신고 및 삭제 요청 처리</li><li>식별 및 검색 제한</li><li>식별 및 게재 제한</li></ul></dd></div></dl><p>안전한 디지털 환경을 위한 관심과 참여를 부탁드립니다.</p><p>감사합니다.</p></article><div class="notice-reactions"><button>♥　좋아요 257</button><button>공유하기</button></div></div></main><footer class="notice-blog-footer"><strong>TISTORY</strong><span>티스토리의 새로운 소식을 전합니다.</span><button data-go="/">티스토리 홈으로</button></footer></div>`
  }

  function setup() {
    return `<main id="main" class="setup-page"><div class="setup-panel"><button class="back-button" data-go="/">← 홈으로</button><p class="eyebrow">SET UP YOUR BLOG</p><h1>이제 블로그를<br>만들어볼까요?</h1><p class="muted">공개 주소와 이름은 신중하게 정해주세요.</p><form id="setup-form"><label>블로그 이름<input required minlength="2" maxlength="30" name="name" placeholder="예: 정글 개발 기록"></label><label>블로그 주소<div class="slug-field"><input required pattern="[a-z0-9-]{3,30}" name="slug" placeholder="jungle-dev"><span>.tistory.com</span><button type="button" data-action="slug">중복 확인</button></div><small id="slug-result"></small></label><label>블로그 소개 <span class="counter" id="description-count">0/160</span><textarea maxlength="160" name="description" placeholder="블로그를 한 줄로 소개해보세요."></textarea></label><p class="form-error" hidden></p><button class="primary-button">블로그 만들기　→</button></form></div></main>`
  }

  function hub(kind) {
    const skin = kind === 'skin'
    const items = skin ? ['Whatever 스킨', 'Book Club 스킨', 'Portfolio 스킨'] : ['티스토리 공지사항', '블로그 운영 질문', '스킨 제작 정보']
    return shell(`<main id="main" class="page-main"><div class="section-inner"><div class="page-intro"><p class="eyebrow">${skin ? 'TISTORY SKIN' : 'TISTORY FORUM'}</p><h1>${skin ? '내 블로그에 어울리는 스킨을 만나보세요.' : '티스토리 이용자들과 이야기를 나눠보세요.'}</h1><p class="muted">${skin ? '다양한 레이아웃의 스킨을 둘러볼 수 있습니다.' : '공지, 질문, 팁을 공유하는 포럼입니다.'}</p></div><div class="feed-list">${items.map((title, index) => `<article class="feed-row"><div><p class="post-blog">${skin ? 'SKIN STORE' : 'FORUM'}</p><h2><button data-go="/feed">${title}</button></h2><p class="excerpt">${skin ? '콘텐츠가 돋보이는 티스토리 스킨입니다.' : '티스토리 사용자들과 나누는 이야기입니다.'}</p></div><div class="row-stat">${index + 1}</div></article>`).join('')}</div></div></main>`)
  }

  function editor(id = '') {
    const post = state.pageData || {}
    return `<main id="main" class="editor-page"><div class="editor-top"><button data-go="/blog/me/manage">← 나가기</button><div><button class="save-button" data-save="DRAFT">임시저장</button><button class="publish-button" data-save="PUBLISHED">발행하기</button></div></div><div class="editor-body"><input class="title-input" id="editor-title" value="${esc(post.title || '')}" placeholder="제목을 입력하세요" maxlength="100"><div class="editor-meta"><span id="title-count">${(post.title || '').length}/100</span><span id="content-count">${(post.content || '').length}/20,000</span></div><textarea class="content-editor" id="editor-content" maxlength="20000" placeholder="여기에 이야기를 적어보세요.">${esc(post.content || '')}</textarea><p class="form-error" hidden></p><input type="hidden" id="editor-id" value="${esc(id)}"></div></main>`
  }

  function blog(slug) {
    const data = state.pageData
    const item = data?.blog
    const mine = Boolean(state.user && item?.owner?.id === state.user.id)
    const posts = data?.posts?.items || []
    return shell(`<main id="main" class="blog-page"><div class="blog-cover"><div class="section-inner"><p class="eyebrow">MY BLOG</p><h1>${esc(item?.name || slug)}</h1><p>${esc(item?.description || '이 블로그의 이야기를 불러오는 중입니다.')}</p>${mine ? `<button class="outline-button light" data-go="/blog/${esc(slug)}/manage">관리하기</button>` : item ? `<button class="subscribe-button ${item.isSubscribed ? 'subscribed' : ''}" data-subscribe="${esc(slug)}">${item.isSubscribed ? '구독 중' : '+ 구독하기'}</button>` : ''}</div></div><div class="section-inner blog-content"><div class="blog-heading"><h2>최근 글</h2>${mine ? '<button class="primary-button compact" data-go="/write">✎ 새 글 쓰기</button>' : ''}</div>${posts.length ? posts.map((post) => postRow(post)).join('') : empty('아직 발행된 글이 없습니다.', mine ? '첫 글을 작성해 블로그를 채워보세요.' : '')}</div></main>`)
  }

  function detail(id) {
    const post = state.pageData
    if (!post?.title) return shell(`<main class="detail-page"><div class="detail-inner">${empty('글을 불러오는 중입니다.')}</div></main>`)
    const mine = state.user?.id === post.author?.id
    return shell(`<main id="main" class="detail-page"><div class="detail-inner"><p class="eyebrow">${esc(post.blog?.name)}</p><h1>${esc(post.title)}</h1><div class="detail-info"><span>${esc(post.author?.nickname)}</span><span>${date(post.publishedAt || post.updatedAt)}</span><span>◉ ${Number(post.viewCount || 0)}</span></div><div class="detail-content">${esc(post.content || '').replaceAll('\n', '<br>')}</div><div class="detail-actions">${mine ? `<button class="outline-button" data-go="/post/${id}/edit">수정하기</button><button class="danger-button" data-delete="${id}">삭제</button>` : ''}</div></div></main>`)
  }

  function manage() {
    const data = state.pageData || { blog: null, posts: [] }
    const posts = data.posts || []
    const shown = state.manageFilter === 'ALL' ? posts : posts.filter((post) => post.status === state.manageFilter)
    return shell(`<main id="main" class="manage-page"><div class="section-inner"><div class="manage-head"><div><p class="eyebrow">MY TISTORY</p><h1>${esc(data.blog?.name || '내 블로그 관리')}</h1><p>${esc(data.blog?.description || '')}</p></div><button class="primary-button compact" data-go="/write">✎ 새 글 쓰기</button></div><div class="manage-tabs"><div>${[['ALL', '전체'], ['PUBLISHED', '발행됨'], ['DRAFT', '임시저장']].map(([value, label]) => `<button data-filter="${value}" class="${state.manageFilter === value ? 'active' : ''}">${label}</button>`).join('')}</div>${data.blog ? `<button data-go="/blog/${esc(data.blog.slug)}">내 블로그 보기　→</button>` : ''}</div>${shown.length ? `<div class="feed-list">${shown.map((post) => postRow(post, true)).join('')}</div>` : empty('작성한 글이 없습니다.', '첫 글을 작성해보세요.')}</div></main>`)
  }

  async function loadFeed() {
    const query = new URLSearchParams(location.search).get('q') || ''
    try { state.feedError = ''; state.feedPosts = await api(`/posts?scope=${state.user ? 'following' : 'public'}&q=${encodeURIComponent(query)}&sort=${state.feedSort}&page=1&size=10`) || [] }
    catch (error) { state.feedPosts = []; state.feedError = error.message }
    if (path() === '/feed') root.innerHTML = feed()
  }

  async function loadData(route) {
    try {
      if (route.startsWith('/blog/') && !route.endsWith('/manage') && route !== '/blog/new') state.pageData = await api(`/blogs/${encodeURIComponent(route.split('/')[2])}?page=1&size=50`)
      else if (route.startsWith('/post/')) state.pageData = await api(`/posts/${route.split('/')[2]}`)
      else if (route === '/blog/me/manage' || route.endsWith('/manage')) {
        const [myBlog, posts] = await Promise.all([api('/blogs/me').catch(() => null), api('/posts?scope=mine&size=50').catch(() => [])])
        state.pageData = { blog: myBlog, posts }
      }
    } catch (error) { state.pageData = { error: error.message } }
    if (path() === route) render(false)
  }

  function render(load = true) {
    const route = path()
    if (route === '/') root.innerHTML = home()
    else if (route === '/feed') { root.innerHTML = feed(); if (load) loadFeed() }
    else if (route === '/login') root.innerHTML = auth('login')
    else if (route === '/signup') root.innerHTML = auth('signup')
    else if (route === '/agreement/third-party-consent') root.innerHTML = state.user ? agreement() : auth('login')
    else if (route === '/notice/2702') root.innerHTML = notice()
    else if (route === '/blog/new') root.innerHTML = setup()
    else if (route === '/skin' || route === '/forum') root.innerHTML = hub(route.slice(1))
    else if (route === '/write') root.innerHTML = state.user ? editor() : auth('login')
    else if (route === '/blog/me/manage' || route.endsWith('/manage')) { root.innerHTML = manage(); if (load) loadData(route) }
    else if (route.startsWith('/post/') && route.endsWith('/edit')) { root.innerHTML = editor(route.split('/')[2]); if (load) loadData(route) }
    else if (route.startsWith('/post/')) { root.innerHTML = detail(route.split('/')[2]); if (load) loadData(route) }
    else if (route.startsWith('/blog/')) { root.innerHTML = blog(route.split('/')[2]); if (load) loadData(route) }
    else root.innerHTML = home()
  }

  root.addEventListener('click', async (event) => {
    const link = event.target.closest('[data-go]')
    if (link) { event.preventDefault(); go(link.dataset.go); return }
    if (event.target.matches('[data-modal]')) { event.stopPropagation(); return }
    const action = event.target.closest('[data-action]')?.dataset.action
    if (action === 'modal-open') { state.modal = true; render(false) }
    if (action === 'modal-close') { state.modal = false; render(false) }
    if (action === 'profile') { state.profile = !state.profile; render(false) }
    if (action === 'profile-close') { state.profile = false; render(false) }
    if (action === 'mobile') { state.mobile = !state.mobile; render(false) }
    if (action === 'credentials') { sessionStorage.setItem('login-step', 'credentials'); render(false) }
    if (action === 'intro') { sessionStorage.removeItem('login-step'); render(false) }
    if (action === 'footer') event.target.closest('.footer-group')?.querySelector('.footer-list')?.classList.toggle('expanded')
    if (action === 'logout') { try { await api('/auth/logout', { method: 'POST' }) } finally { state.user = null; go('/') } }
    if (action === 'slug') {
      const slug = root.querySelector('[name="slug"]').value
      const node = root.querySelector('#slug-result')
      try { const result = await api(`/blogs/check-slug?slug=${encodeURIComponent(slug)}`); node.textContent = result.available ? '사용할 수 있는 주소입니다.' : '이미 사용 중인 주소입니다.'; node.className = result.available ? 'available' : 'unavailable' } catch (error) { node.textContent = error.message }
    }
    const category = event.target.closest('[data-category]')
    if (category) { state.category = category.dataset.category; state.categoryPage = 1; render(false) }
    const pageButton = event.target.closest('[data-page]')
    if (pageButton) { const key = pageButton.dataset.page; const total = Number(pageButton.dataset.total); state[key] = ((state[key] - 1 + Number(pageButton.dataset.delta) + total) % total) + 1; render(false) }
    const sort = event.target.closest('[data-sort]')
    if (sort) { state.feedSort = sort.dataset.sort; render(false); loadFeed() }
    const filter = event.target.closest('[data-filter]')
    if (filter) { state.manageFilter = filter.dataset.filter; render(false) }
    const consent = event.target.closest('[data-consent]')
    if (consent) { sessionStorage.setItem('tistory-third-party-consent', consent.dataset.consent); go('/') }
    const save = event.target.closest('[data-save]')
    if (save) await savePost(save.dataset.save)
    const deletion = event.target.closest('[data-delete]')
    if (deletion && confirm('이 글을 삭제할까요?')) { const post = state.pageData; await api(`/posts/${deletion.dataset.delete}`, { method: 'DELETE' }); go(`/blog/${post.blog.slug}`) }
    const subscribe = event.target.closest('[data-subscribe]')
    if (subscribe) {
      if (!state.user) { state.modal = true; render(false); return }
      const item = state.pageData?.blog
      await api(`/blogs/${subscribe.dataset.subscribe}/subscription`, { method: item.isSubscribed ? 'DELETE' : 'POST' })
      item.isSubscribed = !item.isSubscribed; render(false)
    }
  })

  root.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (['header-search', 'feed-search'].includes(event.target.id)) {
      const query = new FormData(event.target).get('query')?.toString().trim() || ''
      go(`/feed${query ? `?q=${encodeURIComponent(query)}` : ''}`)
    }
    if (event.target.id === 'auth-form') {
      const form = event.target, signup = path() === '/signup', errorNode = form.querySelector('.form-error')
      try { const result = await api(`/auth/${signup ? 'signup' : 'login'}`, { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); state.user = result.user; sessionStorage.removeItem('login-step'); go(signup ? '/blog/new' : path() === '/write' ? '/write' : '/agreement/third-party-consent') }
      catch (error) { errorNode.hidden = false; errorNode.textContent = error.message }
    }
    if (event.target.id === 'setup-form') {
      const form = event.target, errorNode = form.querySelector('.form-error')
      try { const item = await api('/blogs', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(form))) }); go(`/blog/${item.slug}/manage`) }
      catch (error) { errorNode.hidden = false; errorNode.textContent = error.message }
    }
  })

  root.addEventListener('input', (event) => {
    if (event.target.name === 'description') root.querySelector('#description-count').textContent = `${event.target.value.length}/160`
    if (event.target.id === 'editor-title') root.querySelector('#title-count').textContent = `${event.target.value.length}/100`
    if (event.target.id === 'editor-content') root.querySelector('#content-count').textContent = `${event.target.value.length.toLocaleString()}/20,000`
  })

  async function savePost(status) {
    const id = root.querySelector('#editor-id').value
    const payload = { title: root.querySelector('#editor-title').value, content: root.querySelector('#editor-content').value, status }
    const errorNode = root.querySelector('.form-error')
    try { const post = await api(id ? `/posts/${id}` : '/posts', { method: id ? 'PATCH' : 'POST', body: JSON.stringify(payload) }); go(status === 'PUBLISHED' ? `/post/${post.id}` : '/blog/me/manage') }
    catch (error) { errorNode.hidden = false; errorNode.textContent = error.message }
  }

  addEventListener('popstate', () => { state.pageData = null; render() })
  addEventListener('scroll', () => document.querySelector('.site-header')?.classList.toggle('is-fixed', scrollY > 90), { passive: true })
  render()
  api('/me').then((result) => { state.user = result.user; render() }).catch(() => {})
})()
