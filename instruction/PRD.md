# 블로그 클론 서비스 PRD

## 1. 문서 개요

- **문서 목적**: 티스토리의 핵심 사용자 흐름을 학습용 클론 서비스로 구현하기 위한 제품 요구사항을 정의한다.
- **참고 서비스**: [TISTORY](https://www.tistory.com/)
- **대상 사용자**: 글을 작성·관리하고 다른 사용자의 글을 발견하고 싶은 사용자
- **제품 형태**: 반응형 웹 서비스
- **MVP 목표**: 사용자가 회원가입/로그인 후 자신의 블로그를 만들고, 글을 작성·수정·삭제하며, 공개된 글을 통합 피드에서 읽을 수 있게 한다.

> 참고 사이트의 공개 홈에는 검색, 시작하기/로그인, 인기글 베스트, 내 티스토리, 피드·스킨·포럼 메뉴가 노출된다. 본 프로젝트에서는 구현 난도가 높은 외부 소셜 로그인, 스킨 편집, 포럼은 MVP에서 제외하고 블로그·글·피드의 핵심 루프에 집중한다.

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
- 댓글, 좋아요, 구독, 알림
- 이미지 업로드 및 리치 에디터
- 포럼/커뮤니티
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

## 9. API 요구사항 초안

상세 요청/응답 형식은 `instruction/API.md`에서 관리한다.

- `POST /api/auth/signup` 회원가입
- `POST /api/auth/login` 로그인
- `POST /api/auth/logout` 로그아웃
- `GET /api/auth/csrf` 변경 요청용 CSRF 토큰 발급
- `GET /api/me` 현재 사용자 조회
- `POST /api/blogs` 블로그 생성
- `GET /api/blogs/check-slug` slug 중복 확인
- `GET /api/blogs/{slug}` 공개 블로그 조회
- `GET /api/blogs/me` 내 블로그 조회
- `GET /api/posts` 공개 글 피드/검색/정렬/페이지네이션
- `POST /api/posts` 글 생성 또는 임시저장
- `GET /api/posts/{id}` 글 상세 및 조회수 처리
- `PATCH /api/posts/{id}` 글 수정/발행
- `DELETE /api/posts/{id}` 글 삭제

공통 원칙:

- `logout`, `post delete`의 `204 No Content`를 제외한 성공 응답은 JSON으로 반환한다.
- 유효성 오류는 `400`, 인증 오류는 `401`, 권한 오류는 `403`, 리소스 없음은 `404`, 서버 오류는 `500`을 사용한다.
- 목록 응답은 `data`와 `pagination(page, size, totalPages, totalItems)`를 포함한다.
- 공개 글 검색은 제목, 본문, 작성자 닉네임, 블로그명을 대상으로 한다.

## 10. 서버 아키텍처

본 프로젝트는 MVP 범위와 팀 규모를 고려한 모놀리식 Node.js 애플리케이션으로 구현한다. 프론트엔드와 백엔드는 하나의 저장소에서 관리하고, 모든 API는 하나의 백엔드 프로세스가 제공한다. 마이크로서비스, API Gateway, 서비스 간 네트워크 호출, 메시지 브로커는 사용하지 않는다.

```text
Browser :5175
   │ /api proxy
   ▼
Node API :4001 (개발) / :4000 (기본)
   ├─ auth: 회원가입·로그인·로그아웃·CSRF·현재 사용자
   ├─ blog: 블로그 생성·조회·slug 확인
   └─ post: 글 작성·발행·피드·상세·수정·삭제
```

- `server/src/index.ts`는 애플리케이션 조립, 미들웨어, API 진입점을 담당한다.
- 기능별 코드는 `auth`, `blog`, `post` 단위로 분리해 모듈 경계를 유지한다.
- 로컬 인증 저장소는 개발용 메모리 저장소이며 서버 재시작 시 초기화된다.
- 운영 전환 시 API 계약을 유지한 채 저장소 구현만 영속 DB 구현으로 교체한다.
- 클라이언트는 개발 환경에서 Vite proxy를 통해 백엔드에 접근한다.

### 10.1 모듈 의존성 원칙

- HTTP 핸들러는 요청 파싱, 응답 형식, 상태 코드만 담당한다.
- 인증·권한 규칙은 인증 서비스 계층에 둔다.
- 비밀번호 해시, 세션, 저장소는 교체 가능한 내부 인프라 경계로 둔다.
- 사용자 식별자는 body/query가 아니라 세션에서만 획득한다.
- 기능 모듈 간 전역 상태 직접 접근을 금지하고 공개 인터페이스를 통해 접근한다.

## 11. 권장 기술 스택

3일 안에 MVP를 완성해야 하고 Windows와 macOS 개발 환경이 섞여 있으므로, 프론트엔드와 백엔드를 하나의 저장소에서 관리하며 단순한 Node.js 실행 명령을 기준으로 개발·배포한다. 복잡한 마이크로서비스나 외부 인프라는 사용하지 않는다.

### 프론트엔드

- **React + TypeScript**: 컴포넌트 기반 화면 개발과 타입 안정성 확보
- **Vite**: 빠른 개발 서버와 단순한 빌드 설정
- **React Router**: 홈, 인증, 블로그, 글 관련 경로 관리
- **TanStack Query**: 서버 데이터 조회, 캐시, 로딩·오류 상태 관리
- **CSS Modules 또는 일반 CSS**: 별도 UI 프레임워크 없이 MVP 스타일 구현
- **React Hook Form + Zod**: 폼 상태와 입력 검증 관리

### 백엔드

- **Node.js + TypeScript**: 프론트엔드와 언어를 통일해 개발·리뷰 비용을 낮춘다.
- **Express**: API 라우팅과 미들웨어 구성이 단순하고 문서화가 쉽다.
- **Zod**: 요청 body와 query 입력을 서버에서 동일한 기준으로 검증한다.
- **bcrypt**: 비밀번호 해시 처리
- **express-session + connect-pg-simple**: API 문서에 정의된 서버 세션·HttpOnly 쿠키 인증 구현. 세션은 Supabase PostgreSQL에 저장한다.

### 데이터베이스 및 개발 도구

- **Supabase PostgreSQL**: User–Blog–Post 관계, unique 제약, 권한 검증, 발행 상태 변경을 안정적으로 처리할 수 있는 관계형 데이터베이스
- **Prisma**: 타입 안전한 데이터 접근과 마이그레이션 관리
- **Vitest**: 단위 테스트 및 API 테스트
- **Supertest**: Express API 요청 테스트
- **ESLint + Prettier**: 코드 스타일 통일
- **npm scripts**: 통일된 개발·테스트 실행 명령
- **GitHub**: 브랜치, PR, 이슈 관리 및 Vercel 자동 배포 연동

### 사용하지 않는 기술

- 마이크로서비스, 별도 API 게이트웨이, 이벤트 브로커
- Redis와 별도 세션 저장소
- 이미지 저장소, 외부 검색 엔진, 소셜 로그인
- 실시간 통신(WebSocket)

### PostgreSQL을 선택한 이유

- User, Blog, Post 사이의 명확한 관계를 foreign key로 보장할 수 있다.
- 이메일과 블로그 주소의 중복을 unique 제약으로 막을 수 있다.
- 글 발행과 조회수 갱신처럼 데이터 일관성이 필요한 작업에 트랜잭션을 사용할 수 있다.
- Prisma와의 연동이 안정적이고, 이후 서비스 확장에도 적합하다.
- MongoDB는 이번 MVP의 핵심 데이터가 관계형이고 조인·소유권·일관성 검증이 많아 우선순위에서 제외한다.

## 11. 시스템 아키텍처

### 아키텍처 방향

**React SPA + Supabase Edge Functions + Supabase PostgreSQL을 사용하는 계층형 구조**로 구성한다.

- 프론트엔드와 백엔드는 같은 저장소에서 관리한다.
- 프론트엔드는 API를 통해서만 데이터를 읽고 변경한다.
- Vercel은 React 정적 빌드 결과를 제공한다.
- `/api/*` 요청은 Supabase Edge Functions로 전달한다.
- 백엔드는 라우터에서 직접 DB를 조작하지 않고 Service를 거친다.
- 인증·권한 검사는 API 진입점과 Service 양쪽에서 일관되게 적용한다.
- 데이터베이스는 백엔드에서만 접근한다.

### 선택한 디자인 패턴

3일이라는 기간을 고려해 이해하기 쉽고 테스트하기 쉬운 패턴만 적용한다. 패턴 적용 자체를 목표로 하지 않으며, 코드 중복과 계층 간 결합을 줄이는 데 필요한 범위로 제한한다.

#### 1. Layered Architecture

전체 백엔드를 다음 계층으로 나눈다.

```text
Route/Controller → Middleware → Service → Repository → Database
```

- **Route/Controller**: HTTP 요청을 받고 Service를 호출한 뒤 응답을 반환한다.
- **Middleware**: 인증, 권한 사전 확인, 입력 검증, 공통 오류 처리를 담당한다.
- **Service**: 회원·블로그·글의 업무 규칙과 트랜잭션을 담당한다.
- **Repository**: Prisma를 이용한 데이터 조회·저장만 담당한다.
- **Database**: Supabase PostgreSQL에 데이터를 영속화한다.

Controller에서 직접 Prisma를 호출하거나, Repository에서 권한을 판단하지 않는다.

#### 2. Controller–Service–Repository 패턴

기능별로 Controller, Service, Repository를 분리한다.

```text
auth.controller.ts
auth.service.ts
user.repository.ts

blog.controller.ts
blog.service.ts
blog.repository.ts

post.controller.ts
post.service.ts
post.repository.ts
```

- Controller는 얇게 유지한다.
- Service에 업무 규칙을 정리해 단위 테스트가 가능하게 한다.
- Repository는 재사용 가능한 데이터 접근 함수만 제공한다.
- 여러 Repository를 함께 사용하거나 여러 변경을 묶어야 하는 경우 Service에서 트랜잭션을 시작한다.

#### 3. DTO 및 Schema Validation

- 요청 데이터는 Zod Schema로 검증한다.
- Controller와 Service 사이에는 검증이 끝난 입력 객체만 전달한다.
- DB 모델을 API 응답에 그대로 노출하지 않고 필요한 필드만 DTO로 변환한다.
- `passwordHash`, 세션 값 등 민감한 필드는 DTO에 포함하지 않는다.
- API의 상세 필드와 오류 형식은 `instruction/API.md`를 기준으로 한다.

#### 4. Middleware 패턴

공통 요청 처리는 Middleware로 분리한다.

- `sessionMiddleware`: 세션 쿠키를 확인하고 현재 사용자 정보를 설정한다.
- `requireAuth`: 로그인이 필요한 요청을 차단한다.
- `validate`: body/query/params를 Schema로 검증한다.
- `errorHandler`: 예외를 공통 오류 응답으로 변환한다.
- `notFoundHandler`: 존재하지 않는 경로를 처리한다.

리소스의 최종 소유권 확인은 Middleware에만 두지 않고 Service에서 다시 확인한다.

#### 5. Feature-based Module 구조

레이어만 나누지 않고 기능 단위로 관리해 개발자별 작업 경계를 명확히 한다.

```text
server/src/
├── modules/
│   ├── auth/
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── auth.schema.ts
│   │   └── auth.repository.ts
│   ├── blog/
│   └── post/
├── middleware/
├── database/
└── app.ts
```

- `auth`는 회원가입·로그인·로그아웃을 담당한다.
- `blog`는 블로그 생성·조회와 소유권을 담당한다.
- `post`는 글·피드·검색을 담당한다.
- 기능 모듈끼리 직접 Repository를 호출하지 않고 Service 또는 명확한 공통 인터페이스를 통해 협력한다.

### 적용하지 않는 패턴

이번 MVP에서는 다음 패턴을 적용하지 않는다.

- 마이크로서비스: 배포와 통신 복잡도만 증가한다.
- CQRS/Event Sourcing: 글·피드 규모에 비해 과하다.
- 복잡한 DI Container: TypeScript 생성자 주입만으로 충분하다.
- Repository 추상화 계층의 과도한 일반화: Prisma Repository를 감싸는 최소 구조만 사용한다.
- 전역 Singleton 상태: 서버리스 환경에서 요청 간 상태 공유 문제가 생길 수 있으므로 사용하지 않는다.

### 패턴 적용 판단 기준

- 같은 코드가 두 번 이상 반복되고 변경 가능성이 있으면 공통 모듈로 분리한다.
- 업무 규칙이 포함된 코드는 Service에 둔다.
- 단순 조회·저장 함수까지 불필요하게 추상화하지 않는다.
- 새 패턴을 추가할 때는 팀 전체가 이해할 수 있는지와 테스트 이점을 먼저 확인한다.

### 요청 흐름

```text
사용자 브라우저
      │
      ▼
React 페이지/컴포넌트
      │  fetch + credentials: include
      ▼
Express Router
      │
      ├── 인증 미들웨어
      ├── 입력 검증(Zod)
      ▼
Service Layer
      │
      ├── 업무 규칙
      ├── 권한 확인
      └── 트랜잭션 처리
      ▼
Prisma Repository
      ▼
Supabase PostgreSQL
```

### 계층별 책임

| 계층 | 책임 | 포함하지 않는 것 |
|---|---|---|
| React UI | 사용자 입력, 화면 표시, 로딩·오류 상태 | DB 접근, 권한 판단의 최종 결정 |
| API Router | HTTP 경로·메서드 연결, 응답 상태 코드 | 복잡한 업무 로직 |
| Middleware | 세션 확인, 공통 오류 처리, 요청 검증 | 화면 상태 관리 |
| Service | 회원·블로그·글의 업무 규칙, 권한 확인, 트랜잭션 | HTTP 객체에 직접 의존 |
| Repository/Prisma | DB 조회·생성·수정·삭제 | 사용자에게 보여줄 메시지 결정 |
| Supabase PostgreSQL | 관계형 데이터 및 세션 영속 저장 | 인증·업무 로직 |

### 인증 아키텍처

- 로그인 성공 시 Express Session이 세션을 생성하고 `HttpOnly` 쿠키를 발급한다.
- 세션 데이터는 Vercel 함수 메모리에 저장하지 않고 `connect-pg-simple`을 통해 Supabase PostgreSQL에 저장한다.
- 프론트엔드는 인증 정보를 직접 저장하지 않고 요청 시 쿠키를 포함한다.
- 백엔드는 `req.session.userId`를 기준으로 현재 사용자를 확인한다.
- 글 수정·삭제와 비공개 글 조회는 Service에서 리소스 소유자를 재확인한다.
- 로그아웃 시 세션을 폐기하고 쿠키를 만료시킨다.
- 비밀번호와 세션 값은 응답 및 로그에 포함하지 않는다.

### Redis 사용 여부

- MVP에서는 Redis를 사용하지 않는다.
- 세션 저장소로 Supabase PostgreSQL의 `Session` 테이블을 사용한다.
- 이 서비스의 트래픽과 세션 규모에서는 PostgreSQL 세션 저장만으로 충분하다.
- 향후 트래픽 증가, 세션 조회 부하, rate limit, 캐시 요구가 생길 때 Redis 도입을 검토한다.
- 세션 테이블에는 만료 시간을 저장하고 만료된 세션을 정리한다.

### 상태 관리 원칙

- 로그인 사용자, 블로그, 글 목록 등 서버 데이터는 TanStack Query가 관리한다.
- 입력 중인 제목·본문은 각 폼의 로컬 상태로 관리한다.
- 전역 상태 라이브러리는 인증 사용자처럼 여러 화면에서 필요한 최소 상태에만 사용한다.
- 로딩, 성공, 빈 결과, 오류 상태를 각 조회 단위에서 명시적으로 처리한다.

## 12. 권장 디렉터리 구조

```text
project-root/
├── client/                    # React + Vite
│   └── src/
│       ├── components/        # 재사용 UI
│       ├── pages/             # 경로별 페이지
│       ├── features/          # auth, blog, post 기능 단위
│       ├── lib/               # query client, API client, 공통 유틸
│       └── styles/
├── server/                    # Express + TypeScript
│   └── src/
│       ├── modules/            # auth, blog, post 기능 단위
│       ├── middleware/         # session, auth, error, validation
│       ├── database/           # Prisma client, transaction 설정
│       └── app.ts
├── prisma/                    # PostgreSQL 스키마·마이그레이션
│   ├── schema.prisma
│   └── migrations/
├── instruction/
│   ├── PRD.md
│   ├── API.md
│   └── ROLE.md
├── .env.example
└── package.json
```

### 디렉터리 규칙

- `client`에서 DB나 Prisma를 import하지 않는다.
- `modules/*/*.controller.ts`에 복잡한 업무 로직을 작성하지 않는다.
- `modules/*/*.service.ts`는 Express의 `req`, `res` 객체에 직접 의존하지 않는다.
- `modules/*/*.repository.ts`는 데이터 접근만 담당하고 권한 정책은 Service에서 처리한다.
- API 응답 형식은 `instruction/API.md`를 단일 기준으로 사용한다.
- 환경 변수는 `.env`로 관리하고 `.env.example`만 저장소에 커밋한다.

## 13. 배포 아키텍처

### 배포 구성

| 구성 요소 | 서비스 | 담당 내용 |
|---|---|---|
| 웹 애플리케이션 | Vercel | React 정적 빌드 제공 |
| API | Supabase Edge Functions | 서버리스 API 실행 |
| 데이터베이스 | Supabase PostgreSQL | User, Blog, Post, Session 저장 |
| 데이터베이스 관리 | Supabase Dashboard | 테이블 확인, SQL 실행, 로그 확인 |
| 소스 저장소 | GitHub | 브랜치 병합 시 Vercel 자동 배포 |

### 배포 요청 흐름

```text
브라우저
  ├── 페이지 요청 ───────▶ Vercel 정적 파일
  └── /api 요청 ────────▶ Supabase Edge Functions
                              │
                              └── Supabase PostgreSQL
```

### 배포 원칙

- 프론트엔드와 API는 각각 Vercel과 Supabase에서 독립적으로 제공해 CORS 설정을 명시적으로 관리한다.
- 프론트엔드와 백엔드는 각각 독립적으로 빌드·배포·로그 확인이 가능해야 한다.
- API 경로는 항상 `/api` 아래에 둔다.
- 서버리스 실행 환경은 상태를 유지하지 않으므로 세션·데이터를 전역 변수나 로컬 파일에 저장하지 않는다.
- Prisma와 세션 저장소는 Supabase의 연결 풀링 또는 서버리스 환경에 맞는 연결 설정을 사용한다.
- Supabase 데이터베이스의 직접 접근 권한은 서버 환경에만 둔다.
- `DATABASE_URL`, `DIRECT_URL`, `SESSION_SECRET`, `FRONTEND_ORIGIN`은 Vercel 환경 변수로 등록한다.
- `DATABASE_URL`은 런타임용 pooled connection, `DIRECT_URL`은 Prisma 마이그레이션용 direct connection으로 분리한다.
- `SESSION_SECRET`은 충분히 긴 랜덤 값으로 설정하고 저장소에 커밋하지 않는다.

### 개발 및 배포 결정

- 로컬 개발은 npm scripts와 Supabase CLI를 사용한다.
- 로컬 PostgreSQL은 개발·테스트 전용이며, 운영 데이터베이스는 Supabase PostgreSQL을 사용한다.
- Production 프론트엔드는 Vercel 정적 빌드로 배포한다.
- Production 백엔드는 Supabase Edge Functions로 배포한다.

결론적으로 이번 MVP의 기본 배포 조합은 다음과 같다.

`Vite Build → Vercel`

`PostgreSQL + Session Store → Supabase`

### 프로젝트 구성

```text
project-root/
├── client/                  # React + Vite 프론트엔드
├── server/                  # 백엔드 개발 코드
├── supabase/functions/      # Supabase Edge Functions
└── instruction/             # API 및 제품 명세
```

### 개발 명령 기준

```bash
# 프론트엔드 개발 서버
npm run dev:client

# 프론트엔드 production 빌드
npm run build

# 백엔드 테스트
npm test

# Supabase Edge Function 배포
npx supabase functions deploy api --no-verify-jwt
```

개발자는 운영체제별 Node.js나 PostgreSQL 설치 방식에 의존하지 않고 위 명령을 기준으로 프로젝트를 실행한다. 환경 변수 설정만 각 개발 환경에서 선행한다.

### 환경별 구성

| 환경 | 프론트엔드/API | 데이터베이스 | 목적 |
|---|---|---|---|
| 로컬 | Vite 개발 서버 + Express | Supabase 개발 프로젝트 또는 로컬 PostgreSQL | 기능 개발·테스트 |
| Preview | Vercel Preview | Supabase 개발 프로젝트 | PR별 통합 확인 |
| Production | Vercel Production | Supabase 운영 프로젝트 | 최종 서비스 |

개발 데이터와 운영 데이터는 Supabase 프로젝트를 분리한다. 운영 데이터베이스에 로컬 테스트 데이터를 직접 입력하지 않는다.

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
