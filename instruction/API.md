# 블로그 클론 서비스 API 명세서

## 1. 실행 구조

- **프론트엔드**: `client`의 페이지별 HTML + Vanilla JavaScript + CSS
- **백엔드**: Supabase Edge Function `api`
- **데이터베이스**: Supabase PostgreSQL
- **인증**: Edge Function의 `users`·`sessions`·HttpOnly 쿠키
- **별도 서버**: 없음. Express `server/` 디렉터리는 사용하지 않는다.

```text
Multi-page HTML client
   │ fetch('/api/...') + credentials: include
   ▼
Supabase Edge Function: api
   ├─ auth/
   ├─ blogs
   └─ posts
          ▼
   Supabase PostgreSQL + RPC
```

로컬 Function 주소는 `http://127.0.0.1:54321/functions/v1/api`이다. 브라우저 코드는 항상
상대 경로 `/api/*`를 호출하며, 로컬에서는 `client/server.js`, 배포 시에는 Vercel rewrite가
Function으로 전달한다.

## 2. 공통 규칙

### 2.1 요청

- JSON 요청은 `Content-Type: application/json`을 사용한다.
- 인증이 필요한 요청은 `credentials: 'include'`로 `session_id` 쿠키를 전송한다.
- `POST`, `PATCH`, `DELETE`는 유효한 `x-csrf-token` 헤더가 필요하다.
- `page`는 1 이상, `size`는 1~50이며 기본값은 각각 `1`, `10`이다.
- 사용자의 ID는 body/query가 아니라 서버 세션에서 가져온다.

### 2.2 성공 응답

단일 리소스:

```json
{ "data": {} }
```

목록:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "size": 10,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

`logout`, `DELETE /posts/{id}`는 `204 No Content`를 반환한다.

### 2.3 오류 응답

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "fields": { "email": "올바른 이메일 형식이 아닙니다." }
  }
}
```

| 상태 | code | 사용처 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 형식·길이·enum 오류 |
| 401 | `UNAUTHENTICATED` | 로그인 필요 |
| 401 | `INVALID_CREDENTIALS` | 로그인 실패 |
| 403 | `CSRF_TOKEN_INVALID` | CSRF 누락·불일치 |
| 403 | `FORBIDDEN` | 소유권 없음 |
| 404 | `NOT_FOUND` | 리소스 없음 또는 비공개 리소스 |
| 409 | `EMAIL_ALREADY_EXISTS` | 이메일 중복 |
| 409 | `BLOG_ALREADY_EXISTS` | 사용자당 블로그 1개 위반 |
| 409 | `SLUG_ALREADY_EXISTS` | slug 중복 |
| 409 | `BLOG_REQUIRED` | 블로그 없이 글 작성 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 처리 오류 |

## 3. 인증·세션

### GET `/auth/csrf`

CSRF 토큰과 초기 세션 쿠키를 발급한다. 로그인 전 회원가입·로그인 요청도 이 API를 먼저 호출한다.

응답 `200`:

```json
{ "data": { "csrfToken": "token" } }
```

`Set-Cookie: session_id=...; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`을 반환한다. 운영 환경에서는 `Secure`를 추가한다.

### POST `/auth/signup`

요청:

```json
{
  "email": "user@example.com",
  "nickname": "jungle-user",
  "password": "password123",
  "passwordConfirm": "password123"
}
```

처리 규칙:

- 이메일은 trim 후 소문자로 정규화한다.
- 비밀번호는 8~72자이며 서버에서 bcrypt 해시로 저장한다.
- `passwordConfirm`은 서버에서도 검증한다.
- 가입 성공 시 현재 세션에 `user_id`를 연결해 자동 로그인한다.

응답 `201`:

```json
{
  "data": {
    "user": {
      "id": 1,
      "email": "user@example.com",
      "nickname": "jungle-user",
      "createdAt": "2026-08-04T09:00:00Z",
      "updatedAt": "2026-08-04T09:00:00Z"
    },
    "message": "회원가입이 완료되었습니다."
  }
}
```

### POST `/auth/login`

요청:

```json
{ "email": "user@example.com", "password": "password123" }
```

성공 시 기존 세션을 폐기하고 새 `session_id` 쿠키를 발급한다. 비밀번호 오류와 존재하지 않는 이메일은 모두 `401 INVALID_CREDENTIALS`로 응답한다.

### POST `/auth/logout`

현재 세션과 쿠키를 만료시킨다. 세션이 없어도 `204`로 처리한다. 세션이 있으면 CSRF 검증이 필요하다.

### GET `/me`

현재 로그인 사용자와 블로그를 반환한다. 블로그가 없으면 `blog: null`이다.

가능한 오류: `401 UNAUTHENTICATED`.

## 4. 데이터 모델

### `users`

`id bigint PK`, `email text unique`, `password_hash text`, `nickname text`, `created_at`, `updated_at`

- 이메일은 lower/trim 정규화 및 unique 제약을 적용한다.
- `password_hash`만 저장하고 원문 비밀번호는 저장·응답·로그 기록하지 않는다.

### `sessions`

`id bigint PK`, `session_hash text unique`, `user_id bigint nullable`, `csrf_token text`, `expires_at`, `created_at`, `updated_at`

- 실제 쿠키 값은 저장하지 않고 SHA-256 해시만 저장한다.
- 만료 시간은 현재 구현 기준 7일이다.
- CSRF 토큰 검증과 로그인 사용자 식별에 사용한다.

### `blogs`

`id bigint PK`, `owner_id bigint unique FK`, `name`, `slug unique`, `description`, `created_at`, `updated_at`

- 이름 2~30자, 소개 최대 160자
- slug 3~30자의 영문 소문자·숫자·하이픈
- 예약어: `api`, `login`, `signup`, `feed`, `post`, `blog`, `me`, `new`, `ai`

### `posts`

`id bigint PK`, `blog_id FK`, `title`, `content`, `status`, `view_count`, `published_at`, `created_at`, `updated_at`

- 제목 1~100자, 본문 1~20,000자
- `status`: `DRAFT | PUBLISHED`
- 초안은 `published_at = null`, 발행 글은 발행 시각을 기록한다.
- 본문은 plain text로 저장하고 HTML을 허용하지 않는다.

## 5. 블로그 API

### 블로그 주소 규칙

- 사용자가 입력하는 주소 식별자는 `slug`다.
- `slug`는 앞뒤 공백을 제거하고 영문 소문자로 정규화한다.
- 영문 소문자, 숫자, 하이픈만 사용할 수 있으며 길이는 3~30자다.
- 하이픈으로 시작하거나 끝날 수 없고 연속된 하이픈(`--`)은 허용하지 않는다.
- `api`, `login`, `signup`, `feed`, `post`, `blog`, `me`, `new`, `manage`, `ai`는 예약어다.
- 공개 블로그의 canonical path는 `/blog/{slug}`다. 전체 URL은 프론트엔드 origin과 응답의 `url`을 조합한다.
- 전체 URL을 DB에 중복 저장하지 않고 `blogs.slug`만 저장한다. `url`은 API 응답에서 파생한다.

### POST `/blogs`

인증 사용자에게 블로그를 생성한다.

```json
{
  "name": "정글 개발 기록",
  "slug": "jungle-dev",
  "description": "매일 배우고 기록합니다."
}
```

성공 시 생성된 공개 주소를 포함한 블로그를 반환한다.

```json
{
  "data": {
    "id": 10,
    "name": "정글 개발 기록",
    "slug": "jungle-dev",
    "url": "/blog/jungle-dev",
    "description": "매일 배우고 기록합니다."
  }
}
```

가능한 오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 CSRF_TOKEN_INVALID`, `409 BLOG_ALREADY_EXISTS`, `409 SLUG_ALREADY_EXISTS`.

### GET `/blogs/check-slug?slug=jungle-dev`

인증 없이 slug 사용 가능 여부를 확인한다.

```json
{
  "data": {
    "slug": "jungle-dev",
    "url": "/blog/jungle-dev",
    "available": true
  }
}
```

형식이 잘못됐거나 예약어인 경우 `400 VALIDATION_ERROR`, 이미 존재하면 `available: false`를 반환한다. 중복 확인 결과는 안내용이며, 생성 시점의 unique constraint가 최종 중복을 방지한다.

### GET `/blogs/me`

현재 사용자의 블로그를 조회한다. 없으면 `404 BLOG_NOT_FOUND`다.

### GET `/blogs/{slug}`

공개 블로그와 발행 글, 블로그 소유자의 마켓 상품을 반환한다. `DRAFT`는 포함하지 않는다.

쿼리: `page` 기본 1, `size` 기본 10·최대 50

응답 구조:

```json
{
  "data": {
    "blog": {
      "id": 10,
      "name": "정글 개발 기록",
      "slug": "jungle-dev",
      "url": "/blog/jungle-dev",
      "subscriberCount": 12,
      "description": "매일 배우고 기록합니다."
    },
    "posts": {
      "items": [],
      "pagination": { "page": 1, "size": 10, "totalItems": 0, "totalPages": 0 }
    },
    "market": {
      "items": [],
      "pagination": { "page": 1, "size": 8, "totalItems": 0, "totalPages": 0 }
    }
  }
}
```

`market.items`는 블로그 소유자가 등록한 `SELLING`, `RESERVED`, `SOLD` 상품을 최신순 최대 8개 반환한다. 상품이 없으면 빈 배열이며, `subscriberCount`는 현재 전체 구독자 수다.

## 6. 글 API

### GET `/posts`

공개 피드 또는 내 글 관리 목록이다.

| query | 기본값 | 설명 |
|---|---|---|
| `scope` | `public` | `public`, `mine`, `following` |
| `q` | 없음 | 제목·본문·작성자 닉네임·블로그명 검색 |
| `sort` | `latest` | `latest` 또는 `popular` |
| `page` | `1` | 페이지 번호 |
| `size` | `10` | 1~50 |
| `status` | scope별 | `mine`에서 `ALL`, `DRAFT`, `PUBLISHED` |

- `public`: 비로그인 허용, `PUBLISHED`만 반환
- `mine`: 인증 필수, 현재 사용자의 블로그 글만 반환
- `following`: 인증 필수, 구독한 블로그의 `PUBLISHED` 글만 반환
- `public`에서 `status`를 보내면 `400`이다.
- 공개 최신순은 `published_at desc, id desc`다.
- 인기순은 `view_count desc, published_at desc, id desc`다.
- 내 글 최신순은 `updated_at desc, id desc`다.

### POST `/posts`

인증 사용자의 블로그에 글을 생성한다.

```json
{
  "title": "첫 번째 기록",
  "content": "본문 내용입니다.",
  "status": "DRAFT"
}
```

`status`가 없으면 `DRAFT`다. `PUBLISHED`로 생성하면 `published_at`을 현재 시각으로 기록한다. 블로그가 없으면 `409 BLOG_REQUIRED`다.

### GET `/posts/{id}`

상세 조회 성공 시 발행 글의 `view_count`를 1 증가시킨다. `read_post` PostgreSQL RPC가 권한 확인·조회수 증가·상세 반환을 하나의 작업으로 처리한다.

- 발행 글: 누구나 조회 가능
- 초안: 작성자 본인만 조회 가능
- 권한 없는 초안과 존재하지 않는 글: `404 NOT_FOUND`
- 목록 조회는 조회수를 증가시키지 않는다.

### PATCH `/posts/{id}`

작성자 본인만 부분 수정할 수 있다.

```json
{ "title": "수정한 제목", "content": "수정한 본문", "status": "PUBLISHED" }
```

- `DRAFT → PUBLISHED`: `published_at`을 현재 시각으로 설정
- `PUBLISHED → DRAFT`: `published_at = null`
- 발행 글을 계속 수정할 때는 기존 `published_at` 유지
- 수정 시 `updated_at` 갱신

### DELETE `/posts/{id}`

작성자 본인만 휴지통으로 이동할 수 있다. `deleted_at`과 30일 뒤의 `purge_after`를 기록하고 성공 시 `204 No Content`다. `POST /posts/{id}/restore`로 복원하고 `DELETE /posts/{id}/permanent`로 영구 삭제한다.

## 7. 블로그 관리 API

- `PATCH /blogs/me`: `name`, `description`만 수정한다. `slug`가 포함되면 `400 IMMUTABLE_FIELD`다.
- `POST /blogs/me/profile-image`: `file` 필드의 512×512 WebP(최대 2MB)를 저장한다.
- `DELETE /blogs/me/profile-image`: 기본 프로필 이미지로 되돌린다.
- `GET /blogs/me/dashboard`: 글·구독자·상품·휴지통 수와 최근 글·상품 5개를 반환한다.
- `GET|POST /blogs/me/categories`: 카테고리 목록 조회와 생성.
- `PATCH|DELETE /blogs/me/categories/{id}`: 이름 수정과 미사용 카테고리 삭제.
- `PATCH /blogs/me/categories/order`: 현재 카테고리 ID 전체 배열로 노출 순서를 교체한다.

글 생성·수정의 `categoryId`는 현재 블로그 소유 카테고리 또는 `null`만 허용한다. 사용 중이거나 휴지통 글이 연결된 카테고리 삭제는 `409 CATEGORY_IN_USE`다.

마켓 상품의 `DELETE /market/items/{id}`도 30일 휴지통 이동이다. `POST /market/items/{id}/restore`, `DELETE /market/items/{id}/permanent`를 제공한다. 채팅이 있는 상품은 영구 삭제 시 거래 참조용 tombstone으로 남는다.

## 8. 구독 API

### POST `/blogs/{slug}/subscription`

로그인 사용자가 다른 사용자의 블로그를 구독한다. 이미 구독 중이면 그대로 성공하며, 내 블로그는 구독할 수 없다.

```json
{ "data": { "subscribed": true } }
```

### DELETE `/blogs/{slug}/subscription`

구독을 취소한다. 성공 시 `204 No Content`다.

## 9. 시스템 API

### GET `/health`

```json
{ "status": "ok", "service": "jungletory-api", "runtime": "supabase-edge-functions" }
```

### GET `/openapi.json`

현재 Edge Function이 제공하는 OpenAPI 문서를 반환한다.

### GET `/docs`

클라이언트의 `api-docs.html`로 이동한다. `/swagger-ui.css`, `/swagger-ui-bundle.js`는 문서 화면용 정적 리소스다.

## 10. 구현 체크리스트

- `server/` Express 백엔드는 사용하지 않는다.
- `supabase/functions/api`의 공통 CORS·쿠키·세션 처리는 `shared.ts`에서 담당한다.
- auth 기능은 `auth.routes.ts → auth.service.ts → auth.repository.ts` 흐름을 유지한다.
- `SUPABASE_SERVICE_ROLE_KEY`는 Edge Function Secret으로만 관리한다.
- 클라이언트에는 Supabase URL이나 키를 두지 않고 상대 경로 `/api/*`만 사용한다.
- migration 파일은 파일명 순서대로 적용한다.
- RLS가 켜진 테이블은 Edge Function의 service role 접근과 일반 클라이언트 접근을 구분한다.
- 코드와 API 문서의 경로·상태 코드·필드명이 달라지면 API 문서를 먼저 갱신한다.
