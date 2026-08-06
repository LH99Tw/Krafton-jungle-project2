# 블로그 클론 서비스 PRD

## 1. 문서 개요

- **문서 목적**: 티스토리의 핵심 사용자 흐름을 학습용 클론 서비스로 구현하기 위한 제품 요구사항을 정의한다.
- **참고 서비스**: [TISTORY](https://www.tistory.com/)
- **대상 사용자**: 글을 작성·관리하고 다른 사용자의 글을 발견하고 싶은 사용자
- **제품 형태**: 반응형 웹 서비스
- **MVP 목표**: 사용자가 회원가입/로그인 후 자신의 블로그를 만들고, 글을 작성·수정·삭제하며, 공개된 글을 통합 피드에서 읽을 수 있게 한다.

> 참고 사이트의 공개 홈 메뉴 중 포럼을 AI로 변경한다. AI 메뉴의 화면 경로는 `/ai.html`이며, 이번 단계에서는 메뉴명과 경로 계약만 정의한다. AI 기능의 상세 요구사항과 백엔드 API는 후속 명세에서 확정한다.

## 2. 문제 정의

사용자는 자신의 글을 발행할 공간이 필요하지만, 글쓰기 서비스는 회원 인증·블로그 생성·콘텐츠 관리·공개 글 탐색이 연결되어야 사용성을 갖는다. 따라서 다음 한 가지 흐름을 끊김 없이 제공한다.

`회원가입/로그인 → 블로그 생성 → 글 작성/발행 → 통합 피드 노출 → 글 상세 조회`

## 3. 목표와 성공 기준

### 목표

1. 신규 사용자가 3분 안에 계정을 만들고 블로그를 생성할 수 있다.
2. 로그인 사용자가 5분 안에 글을 작성해 공개 발행할 수 있다.
3. 방문자가 로그인하지 않아도 공개 글 목록과 상세 내용을 읽을 수 있다.
4. 작성자는 자신의 글을 안전하게 수정·삭제할 수 있다.

### 성공 기준

- 인증 완료 사용자의 블로그 생성 성공률 95% 이상
- 공개 글 발행 후 피드 반영까지 5초 이내
- 주요 화면에서 새로고침 후에도 데이터가 유지됨
- 권한 없는 사용자가 다른 사용자의 글을 수정·삭제할 수 없음
- 모바일(375px)과 데스크톱(1440px)에서 주요 흐름을 사용할 수 있음

## 4. 범위

### MVP 포함

- 회원가입, 로그인, 로그아웃
- 블로그 생성 및 내 블로그 조회
- 글 작성, 임시저장, 공개 발행
- 글 목록, 글 상세, 글 수정, 글 삭제
- 공개 글 통합 피드
- 제목/본문/작성자 기준 검색
- 인기글 또는 최신글 정렬
- 기본 반응형 레이아웃 및 빈 상태/오류 상태

### MVP 제외

- 카카오 등 외부 소셜 로그인
- 다중 블로그, 스킨 편집 및 사용자 제작 스킨
- 댓글, 좋아요, 알림
- 이미지 업로드 및 리치 에디터
- AI 상세 기능 및 백엔드 연동
- 관리자 페이지, 신고/차단, 통계
- 실시간 알림 및 무한 스크롤

## 5. 사용자 흐름

### 비로그인 사용자

1. 홈에서 최신/인기 공개 글을 확인한다.
2. 검색어를 입력해 글 목록을 필터링한다.
3. 글 카드를 선택해 상세 내용을 읽는다.
4. 글쓰기 또는 내 블로그 메뉴를 선택하면 로그인 화면으로 이동한다.

### 신규 사용자

1. 시작하기를 선택한다.
2. 이메일, 닉네임, 비밀번호를 입력해 회원가입한다.
3. 가입 직후 블로그 이름과 주소(slug)를 입력한다.
4. 생성 완료 후 내 블로그 관리 화면으로 이동한다.

### 기존 사용자

1. 로그인한다.
2. 내 블로그에서 새 글 쓰기를 선택한다.
3. 제목과 본문을 입력하고 임시저장 또는 공개 발행한다.
4. 발행된 글은 내 블로그와 통합 피드에 노출된다.

## 6. 화면 요구사항

### 6.1 홈 `/`

- 서비스 로고와 홈/피드/내 블로그 메뉴를 제공한다.
- 검색 입력창과 검색 버튼을 제공한다.
- 비로그인 상태에서는 시작하기 버튼, 로그인 상태에서는 내 블로그 링크를 보여준다.
- 인기글 또는 최신 공개 글을 카드 목록으로 보여준다.
- 글 카드에는 제목, 요약, 작성자/블로그명, 작성일, 조회수를 표시한다.
- 데이터가 없으면 “아직 발행된 글이 없습니다” 빈 상태를 표시한다.

### 6.2 인증 `/login`, `/signup`

- 로그인: 이메일과 비밀번호 입력, 로그인 버튼, 회원가입 이동 링크
- 회원가입: 이메일, 닉네임, 비밀번호, 비밀번호 확인 입력
- 필수 입력값 누락, 이메일 형식 오류, 비밀번호 불일치, 잘못된 인증 정보에 대한 메시지를 표시한다.
- 회원가입 성공 시 자동 로그인하며 블로그 생성 화면으로 이동한다.
- 로그인 성공 시 요청 전 페이지로 돌아가며, 없으면 홈으로 이동한다.
- 비밀번호는 서버에 평문으로 저장하지 않는다.

### 6.3 블로그 생성 `/blog/new`

- 블로그 이름(필수, 2~30자), 소개(선택, 최대 160자)와 주소(slug, 필수, 영문 소문자/숫자/하이픈)를 입력한다.
- 주소 중복 확인 결과를 즉시 안내한다.
- 생성 성공 시 `/blog/{slug}/manage`로 이동한다.
- 이미 블로그를 가진 사용자가 재접근하면 생성 화면 대신 자신의 블로그 관리 화면으로 이동한다.

### 6.4 내 블로그 `/blog/{slug}`

- 블로그 이름, 소개, 글 목록을 보여준다.
- 공개 글만 비로그인 방문자에게 노출한다.
- 본인에게만 글쓰기, 수정, 삭제 버튼을 보여준다.
- 글이 없으면 첫 글 작성을 유도하는 빈 상태를 보여준다.

### 6.5 글 작성/수정 `/write`, `/post/{id}/edit`

- 제목(필수, 최대 100자), 본문(필수, 최대 20,000자), 공개 여부를 입력한다.
- 임시저장과 공개 발행을 구분한다.
- 작성 중 페이지를 이탈할 때 미저장 변경 여부를 확인한다.
- 저장 중에는 버튼을 비활성화해 중복 요청을 방지한다.
- 성공 시 발행 글은 상세 화면, 임시저장 글은 관리 목록으로 이동한다.

### 6.6 통합 피드 `/feed`

- 모든 블로그의 공개 글을 최신순 기본으로 보여준다.
- 최신순/인기순 정렬을 제공한다.
- 한 페이지 10개를 기본으로 제공하고 더보기 또는 페이지네이션을 사용한다.
- 로그인하지 않은 사용자는 읽을 수 있으며, 피드 접근 자체는 로그인으로 강제하지 않는다.
- 로그인 사용자에게는 추후 개인화할 수 있도록 구조를 분리한다.

### 6.7 글 상세 `/post/{id}`

- 제목, 작성자, 블로그명, 작성일, 조회수, 본문을 표시한다.
- 공개 글만 누구나 조회할 수 있다.
- 비공개 글은 작성자 본인만 조회할 수 있고 타인에게는 404 또는 접근 권한 오류를 반환한다.
- 작성자 본인에게만 수정/삭제 버튼을 표시한다.
- 삭제 전 확인 모달을 표시하고 삭제 성공 후 블로그 글 목록으로 이동한다.

## 7. 기능 요구사항

### 인증/권한

- 이메일은 중복될 수 없다.
- 비밀번호는 최소 8자이며 서버에서 해시 처리한다.
- 인증이 필요한 API는 로그인 세션 또는 토큰으로 보호한다.
- 글 수정/삭제는 해당 글의 작성자만 가능하다.
- 로그아웃 시 인증 정보를 폐기한다.

### 블로그

- 사용자 1명당 MVP에서는 블로그 1개만 생성할 수 있다.
- 블로그 주소(slug)는 전역에서 유일해야 한다.
- 블로그 삭제는 MVP에서 제공하지 않는다.

### 글

- 글 상태는 `DRAFT`(임시저장), `PUBLISHED`(공개 발행)로 관리한다.
- 임시저장 글은 피드와 비로그인 블로그 화면에 노출하지 않는다.
- 공개 발행 시 `publishedAt`을 기록한다.
- 삭제는 논리 삭제보다 물리 삭제를 우선하되, 구현 선택에 따라 일관되게 적용한다.
- 조회수는 상세 조회 성공 시 1 증가시키며 목록 조회에서는 증가시키지 않는다.

### 검색

- 검색어가 없으면 전체 공개 글을 보여준다.
- 검색어는 제목, 본문, 블로그명 중 하나 이상을 대상으로 한다.
- 결과가 없을 때 검색어를 포함한 안내 문구와 홈 이동을 제공한다.

## 8. 데이터 모델 초안

### User

- `id`, `email`, `passwordHash`, `nickname`, `createdAt`, `updatedAt`

### Blog

- `id`, `ownerId`, `name`, `slug`, `description`, `createdAt`, `updatedAt`
- `ownerId`는 User를 참조하며, `slug`는 unique이다.

### Post

- `id`, `blogId`, `title`, `content`, `status`, `viewCount`, `publishedAt`, `createdAt`, `updatedAt`
- `status`는 `DRAFT | PUBLISHED`
- `blogId`는 Blog를 참조한다.

## 9. Supabase API 요구사항

상세 구현은 `instruction/API.md`를 기준으로 한다. 별도 Express 서버 없이 Supabase Edge Function `api`가 `/auth`, `/blogs`, `/posts` 경로를 제공한다.

- `GET /auth/csrf` CSRF 토큰 발급
- `POST /auth/signup` 회원가입
- `POST /auth/login` 로그인
- `POST /auth/logout` 로그아웃
- `GET /me` 현재 사용자 조회
- `users`, `sessions` 조회·생성·갱신
- `blogs` 조회·생성 및 slug 중복 확인
- `posts` 공개 피드·내 글 목록·상세·작성·수정·삭제
- `search_public_posts` RPC 검색
- `increment_post_view` RPC 상세 조회 및 조회수 증가

공통 원칙:

- 인증과 세션은 Supabase Edge Function과 PostgreSQL `users`·`sessions` 테이블이 관리한다.
- `service_role` 키는 Edge Function 환경 변수로만 사용하며, 비밀번호는 bcrypt 해시만 저장한다.
- 상태 변경 요청은 CSRF 토큰을 검증한다.
- 공개 글만 비로그인 사용자에게 노출하고, 초안은 소유자에게만 노출한다.
- 목록은 Supabase의 `range`와 `count: 'exact'`를 사용하며 기본 10개, 최대 50개로 제한한다.
- 상세 조회와 조회수 증가는 `increment_post_view` RPC에서 원자적으로 처리한다.

## 10. 데이터 접근 아키텍처

페이지별 HTML에서 공통 Vanilla JavaScript가 Supabase Edge Function `api`를 호출하고,
Edge Function이 PostgreSQL과 RPC를 사용한다.

```text
HTML 페이지 + Vanilla JavaScript
   │ /api
   ▼
Supabase Edge Function api
   │ Supabase JS Client (서버 내부)
   ▼
Supabase PostgreSQL / RPC
```

- 세션 쿠키는 Edge Function이 발급하고 세션은 PostgreSQL `sessions` 테이블에서 검증한다.
- 사용자 식별자는 세션에서 가져오며 body/query로 받지 않는다.
- 조회수 증가와 검색처럼 원자성·조인이 필요한 기능만 PostgreSQL RPC로 제공한다.
- `service_role` 키와 관리자 권한은 클라이언트에서 사용하지 않는다.

## 11. 권장 기술 스택 및 아키텍처

별도 Express 백엔드 서버 없이 각 HTML 페이지의 브라우저 JavaScript가 Supabase Edge Function
`api`를 호출한다. 인증·세션은 Edge Function과 PostgreSQL이 담당하고, 원자적 처리가 필요한
기능만 PostgreSQL RPC로 구현한다.

### 프론트엔드

- **HTML**: 화면마다 독립된 문서로 마크업과 접근성 구조를 관리
- **Vanilla JavaScript**: 화면별 이벤트, 폼 검증, API 호출, 로딩·오류 상태 처리
- **Fetch API**: 상대 경로 `/api/*`로 Edge Function 호출
- **일반 CSS**: `src/styles.css`와 `static-pages.css`에서 공통·페이지 스타일 관리
- **Node.js 스크립트**: 로컬 정적 서버와 배포 산출물 생성

### Supabase

- **Supabase Edge Function**: 인증·세션·블로그·글 API 실행
- **Supabase PostgreSQL**: `users`, `sessions`, `blogs`, `posts` 테이블 저장
- **PostgreSQL Function/RPC**: 회원가입·로그인·조회수·검색 등 원자적 처리
- **Supabase CLI**: 로컬 개발, migration, 타입 생성

### 사용하지 않는 기술

- React, TypeScript/TSX, Vite, React Router 및 React 전용 상태·폼 라이브러리
- Express, 별도 `server/` 디렉터리, API Gateway
- Redis
- 별도 파일 저장소, 외부 검색 엔진, 소셜 로그인, WebSocket

### 요청 흐름

```text
HTML page
   │ fetch + credentials: include
   ▼
Supabase Edge Function api
   │ Supabase JS Client (서버 내부)
   ▼
Supabase PostgreSQL / RPC
```

### 인증 원칙

- 세션 쿠키는 `HttpOnly`, `SameSite=Lax`로 발급한다.
- 상태 변경 요청은 `x-csrf-token`을 검증한다.
- `service_role` 키는 Edge Function 환경 변수로만 사용한다.
- 비밀번호는 `bcryptjs`로 해시하며 원문을 저장하지 않는다.

### 권장 디렉터리 구조

```text
project-root/
├── client/                              # 다중 HTML 페이지 프론트엔드
│   ├── public/
│   │   ├── api-docs.html                 # API Swagger 문서 화면
│   │   └── assets/                       # 이미지 등 정적 에셋
│   ├── src/
│   │   └── styles.css                    # 공통 디자인 스타일
│   ├── index.html                        # 홈
│   ├── login.html                        # 로그인
│   ├── signup.html                       # 회원가입
│   ├── agreement.html                    # 개인정보 동의
│   ├── blog-new.html                     # 블로그 생성
│   ├── blog.html                         # 블로그 조회
│   ├── manage.html                       # 블로그 관리
│   ├── write.html                        # 글 작성·수정
│   ├── feed.html                         # 통합 피드
│   ├── post.html                         # 글 상세
│   ├── notice.html                       # 공지
│   ├── skin.html                         # 스킨 소개
│   ├── ai.html                           # AI 메뉴 화면
│   ├── app.js                            # 공통 API·세션 및 화면별 동작
│   ├── layout-client.js                  # 공통 레이아웃의 모바일·스크롤 동작
│   ├── partials/                         # 공통·공지 헤더와 푸터 원본
│   ├── lib/render-layout.js              # 개발 서버·빌드용 partial 합성
│   ├── static-pages.css                  # 페이지별 보조 스타일
│   ├── build.js                          # HTML·에셋을 dist로 복사
│   ├── server.js                         # 로컬 정적 서버와 /api 프록시
│   ├── package.json
│   └── vercel.json
├── supabase/
│   ├── config.toml                       # Supabase 로컬 설정
│   ├── migrations/
│   │   ├── 202608040001_auth_foundation.sql
│   │   ├── 202608040002_signup_user.sql
│   │   ├── 202608040003_login_session.sql
│   │   ├── 202608040004_blogs.sql
│   │   └── 202608040005_posts.sql
│   └── functions/
│       └── api/                          # 단일 Supabase Edge Function 백엔드
│           ├── index.ts                  # 라우팅·블로그·글·OpenAPI·health
│           ├── shared.ts                 # Supabase client·CORS·쿠키·세션 공통 처리
│           ├── .env.example
│           └── auth/
│               ├── auth.routes.ts        # 인증 경로 라우팅
│               ├── auth.service.ts       # 회원가입·로그인·로그아웃·현재 사용자
│               └── auth.repository.ts   # users·sessions·DB·RPC 접근
├── .github/
│   └── workflows/
│       └── ci-cd.yml                     # client 빌드·Vercel·Supabase 배포
├── instruction/                         # 제품·API·협업 문서
│   ├── PRD.md
│   ├── API.md
│   └── ROLE.md
├── DEPLOYMENT.md
├── README.md
├── package.json                          # 루트 실행·배포 scripts
└── .gitignore
```

`client/dist`와 `node_modules`는 빌드·캐시 생성물이므로 커밋 대상에서 제외한다.
`client/server.js`는 프런트엔드 개발용 정적 파일 서버이며 별도의 애플리케이션 백엔드가 아니다.
Express `server/` 디렉터리는 사용하지 않는다.

### 환경 변수

클라이언트는 상대 경로 `/api/*`만 사용하므로 별도 프런트엔드 환경 변수가 없다.
Edge Function 환경 변수는 `supabase/functions/api/.env.local`에서 관리한다.

```text
FRONTEND_ORIGIN=http://localhost:5173
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SESSION_COOKIE_SECURE=false
```

`SUPABASE_SERVICE_ROLE_KEY`는 Edge Function 환경 변수에만 두고 클라이언트에 노출하지 않는다.

### 배포 구성

| 구성 요소 | 서비스 | 담당 내용 |
|---|---|---|
| 웹 애플리케이션 | Vercel 또는 정적 호스팅 | 페이지별 HTML·JavaScript·CSS 제공 |
| 인증·데이터베이스 | Supabase | Auth, PostgreSQL, RLS, RPC |
| 데이터베이스 관리 | Supabase CLI/Dashboard | migration, 함수, 데이터 확인 |
| 소스 저장소 | GitHub | 코드와 migration 관리 |

### 배포 원칙

- 프론트엔드는 상대 경로 `/api/*`로 Edge Function만 호출한다.
- `service_role` 키는 클라이언트 환경 변수에 넣지 않는다.
- 운영과 개발은 Supabase 프로젝트를 분리한다.

### 개발 및 배포 결정

- 로컬 개발은 npm scripts와 Supabase CLI를 사용한다.
- 로컬 PostgreSQL은 개발·테스트 전용이며, 운영 데이터베이스는 Supabase PostgreSQL을 사용한다.
- Production 프론트엔드는 Vercel 정적 빌드로 배포한다.
- Supabase Edge Function과 PostgreSQL/RPC는 Supabase에서 관리한다.

### 프로젝트 구성

```text
project-root/
├── client/                  # HTML + Vanilla JavaScript 프론트엔드
├── supabase/migrations/     # Supabase 스키마·RLS·RPC
└── instruction/             # API 및 제품 명세
```

### 개발 명령 기준

```bash
# 프론트엔드 개발 서버
npm run dev:client

# 프론트엔드 production 빌드
npm run build

# Supabase migration 적용
npx supabase db push
```

개발자는 운영체제별 Node.js나 PostgreSQL 설치 방식에 의존하지 않고 위 명령을 기준으로 프로젝트를 실행한다. 환경 변수 설정만 각 개발 환경에서 선행한다.

### 환경별 구성

| 환경 | 프론트엔드/API | 데이터베이스 | 목적 |
|---|---|---|---|
| 로컬 | Node 정적 서버 + Supabase 로컬 서비스 | Supabase 로컬 PostgreSQL | 기능 개발·테스트 |
| Preview | Vercel Preview | Supabase 개발 프로젝트 | PR별 통합 확인 |
| Production | Vercel Production | Supabase 운영 프로젝트 | 최종 서비스 |

개발 데이터와 운영 데이터는 Supabase 프로젝트를 분리한다. 운영 데이터베이스에 로컬 테스트 데이터를 직접 입력하지 않는다.

## 12. 페이지 파일 및 URL 기준

화면 전환은 SPA 라우팅이 아니라 문서 이동으로 처리한다. 고정 화면은 HTML 파일명을 URL로
사용하고, 블로그 slug나 글 id처럼 동적인 값은 query string으로 전달한다.

| 화면 | 파일 | URL 예시 | 전달 값 |
|---|---|---|---|
| 홈 | `index.html` | `/` | 없음 |
| 로그인 | `login.html` | `/login.html` | 필요 시 `redirect` |
| 회원가입 | `signup.html` | `/signup.html` | 없음 |
| 개인정보 동의 | `agreement.html` | `/agreement.html` | 가입 진행 상태는 세션에서 확인 |
| 블로그 생성 | `blog-new.html` | `/blog-new.html` | 없음 |
| 블로그 조회 | `blog.html` | `/blog.html?slug=jungle-dev` | `slug` |
| 블로그 관리 | `manage.html` | `/manage.html` | 로그인 세션 |
| 글 작성 | `write.html` | `/write.html` | 없음 |
| 글 수정 | `write.html` | `/write.html?id={postId}` | `id` |
| 통합 피드 | `feed.html` | `/feed.html?q=여행&sort=latest&page=1` | `q`, `sort`, `page` |
| 글 상세 | `post.html` | `/post.html?id={postId}` | `id` |
| 공지 | `notice.html` | `/notice.html` | 없음 |
| 스킨 소개 | `skin.html` | `/skin.html` | 없음 |
| AI | `ai.html` | `/ai.html` | 없음 |

모든 내부 링크는 실제 HTML 문서를 가리키는 `<a href>`를 우선한다. JavaScript가 필요한 폼 제출,
필터, 모달 등의 동작만 이벤트 리스너로 보강한다. 각 페이지는 직접 URL로 접근하거나 새로고침해도
같은 화면과 데이터를 복원할 수 있어야 한다.

## 13. 프론트엔드 구현 계획

현재 저장소에는 페이지별 HTML, 공통 CSS, 정적 빌드 스크립트와 로컬 서버가 준비되어 있다.
다만 `index.html`과 `app.js`에는 이전 SPA 렌더링 및 History API 라우팅 코드가 남아 있으므로,
아래 순서로 다중 페이지 구조를 완성한다.

1. **페이지 진입점 확정**
   - 각 HTML의 `data-od-id`를 화면 식별자로 사용하고 공통 `<script src="./app.js" defer>`를 연결한다.
   - `app.js`의 `innerHTML` 기반 전체 화면 템플릿과 `history.pushState` 라우터를 제거한다.
   - 공통 헤더·푸터는 `partials/`에서 한 번만 관리하고 로컬 서버와 빌드 단계에서 각 문서에 합성한다.
2. **문서 이동 연결**
   - 버튼으로 구현된 화면 이동을 실제 `<a href="*.html">` 링크로 바꾼다.
   - 동적 식별자는 path parameter 대신 `URLSearchParams`로 읽는 query string을 사용한다.
   - 인증이 필요한 페이지는 미인증 시 `login.html?redirect=...`로 이동한다.
3. **화면별 JavaScript 분리**
   - 공통 API 요청, CSRF, 세션 확인, 오류 처리는 재사용 함수로 둔다.
   - 초기화 시 현재 문서의 `data-od-id`에 맞는 컨트롤러만 실행한다.
   - 로그인·회원가입 → 블로그 생성 → 글 작성 → 피드 → 상세 순으로 실제 API와 연결한다.
4. **정적 빌드와 배포 정리**
   - 새 페이지와 에셋은 `build.js`가 빠짐없이 `dist`로 복사하도록 검증한다.
   - Vercel의 SPA용 전체 경로 `index.html` fallback은 제거하고 실제 HTML 파일을 제공한다.
   - `/api/*` rewrite만 유지해 로컬과 운영에서 동일한 브라우저 요청 경로를 사용한다.
5. **페이지 단위 검증**
   - 모든 HTML의 직접 접근, 새로고침, 뒤로가기, 페이지 간 링크를 확인한다.
   - 인증 유무, query string 누락·오류, 빈 데이터, API 오류 상태를 페이지마다 확인한다.
   - `npm run build` 후 `dist`의 모든 페이지·CSS·JavaScript·에셋을 확인하고 모바일/데스크톱 회귀 테스트를 수행한다.

## 14. 비기능 요구사항

- 모바일 375px부터 데스크톱까지 레이아웃이 깨지지 않아야 한다.
- 주요 인터랙션은 키보드만으로도 사용할 수 있어야 한다.
- 폼 입력에는 label 또는 접근 가능한 이름이 있어야 한다.
- 서버 오류와 네트워크 오류를 사용자가 이해할 수 있는 문구로 안내한다.
- 인증 정보와 비밀번호를 로그에 남기지 않는다.
- 목록 API는 기본 10개 단위로 응답하고 과도한 전체 조회를 막는다.
- 주요 API와 핵심 사용자 흐름에 대한 테스트를 작성한다.

## 15. 완료 기준(Definition of Done)

- [ ] 비로그인 사용자가 홈/피드/공개 블로그/공개 글 상세를 조회할 수 있다.
- [ ] 신규 사용자가 회원가입 후 블로그를 생성할 수 있다.
- [ ] 로그인 사용자가 글을 임시저장·발행·수정·삭제할 수 있다.
- [ ] 발행 글이 피드에 노출되고 검색/정렬/페이지네이션이 동작한다.
- [ ] 비공개 글이 피드와 공개 블로그에 노출되지 않는다.
- [ ] 작성자 외 사용자의 수정·삭제 요청이 차단된다.
- [ ] 입력 검증, 빈 상태, 로딩 상태, 오류 상태가 각 화면에 구현된다.
- [ ] 새로고침 후에도 회원/블로그/글 데이터가 유지된다.
- [ ] 모바일/데스크톱 주요 화면을 확인하고 API 테스트가 통과한다.

## 16. 후속 확장 후보

1. 카카오계정 로그인 및 계정 연동
2. 댓글, 좋아요, 구독, 알림
3. 이미지 업로드와 마크다운/리치 텍스트 편집기
4. 스킨 선택 및 사용자 정의
5. 다중 블로그와 관리자 통계
6. 개인화 피드와 추천 알고리즘
