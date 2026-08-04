# 블로그 클론 서비스 API 명세서

## 1. 문서 정보

- **기준 문서**: `instruction/PRD.md`
- **참고 서비스**: [티스토리](https://www.tistory.com/)
- **API 기본 경로**: `/api`
- **로컬 API 서버**: `http://localhost:4001` (기본 포트 `4000`)
- **콘텐츠 타입**: `application/json`
- **문자 인코딩**: UTF-8
- **시간 형식**: ISO 8601 UTC 문자열 (예: `2026-08-04T09:30:00Z`)

티스토리 공개 홈의 검색, 인기글, 피드, 내 블로그 탐색 흐름을 참고하되, 본 프로젝트에서는 회원·블로그·글·공개 피드만 MVP 범위로 제공한다. 소셜 로그인, 댓글, 좋아요, 구독, 이미지 업로드, 스킨, 포럼 API는 제공하지 않는다.

### 1.1 티스토리 공식 API를 참고할 때의 주의점

티스토리 공식 Open API 문서에는 `blogName`, `postId`, `title`, `content`, `visibility`, `published`, `postUrl`, 페이지별 `count`·`totalCount` 등의 개념이 정의되어 있다. 다만 공식 Open API는 2024년 2월까지 순차 종료되었으므로, 아래 API는 티스토리 서버를 호출하지 않고 우리 서비스의 자체 API로 구현한다.

| 티스토리 개념 | 이 프로젝트의 필드/규칙 |
|---|---|
| `blogName` | `Blog.slug` — URL과 식별자에 사용 |
| `postId` | `Post.id` |
| `visibility=0` | `status=DRAFT` — 외부 공개 불가 |
| `visibility=3` 또는 목록의 발행 상태 | `status=PUBLISHED` — 공개 글 |
| `published` / `date` | `publishedAt` — ISO 8601 UTC 저장 |
| `postUrl` | `url` — `/post/{id}` 형태의 공개 주소 |
| `page`, `count`, `totalCount` | `pagination.page`, `size`, `totalItems` |

티스토리의 보호글(`visibility=1` 또는 일부 문서의 `15`)은 PRD 범위에 없으므로 구현하지 않는다. 카테고리, 태그, 댓글, 첨부파일도 공식 API에는 존재하지만 MVP에서는 제외한다.

## 1.2 구현 아키텍처와 실행 경계

이 API는 여러 마이크로서비스가 아니라 하나의 모놀리식 Node.js 애플리케이션에서 제공한다. 인증·블로그·게시글은 기능별 모듈로 분리하지만 동일한 프로세스와 런타임 저장소를 공유한다.

```text
client (5175) → Vite /api proxy → server (4001) → /api/{resource}
```

- 인증: `/api/auth/*`, `/api/me`
- 블로그: `/api/blogs/*`
- 게시글: `/api/posts/*`
- 모든 모듈은 동일한 세션 쿠키와 공통 에러 포맷을 사용한다.
- 클라이언트는 내부 모듈명이나 포트가 아닌 `/api`만 호출한다.
- 개발 저장소는 메모리 기반이며 서버 재시작 시 데이터가 초기화된다.

## 2. 공통 규칙

### 2.1 인증

회원가입 또는 로그인 성공 시 서버는 `HttpOnly`, `Secure`(운영 환경), `SameSite=Lax` 속성의 세션 쿠키를 발급한다. 회원가입은 자동 로그인으로 처리한다.

- 인증 필요 요청: 브라우저가 세션 쿠키를 자동 전송한다.
- 로그아웃: 서버에서 세션을 폐기하고 쿠키를 만료시킨다.
- 비밀번호와 세션 값은 응답 본문이나 로그에 포함하지 않는다.
- 비로그인 사용자는 공개 글 조회 API만 사용할 수 있다.
- 세션 만료 시간은 마지막 요청 기준 7일로 하며, 로그아웃 시 즉시 폐기한다.

권장 쿠키 이름은 `session_id`이다. 프론트엔드가 다른 출처의 API 서버를 호출하는 경우 `fetch`에 `credentials: "include"`를 지정하고, 서버는 허용된 프론트엔드 origin에 대해서만 credential 요청을 허용한다. 세션 쿠키를 사용하는 변경 요청에는 `X-CSRF-Token` 헤더 검사를 적용한다. 같은 출처 애플리케이션으로 구현하더라도 서버에서 토큰 검사를 생략하지 않는다.

### 2.2 인증 보조 API

#### GET `/api/auth/csrf`

변경 요청에 사용할 CSRF 토큰을 발급한다. 토큰은 응답 본문에만 반환하고 세션에 저장한다.

응답 `200 OK`:

```json
{
  "data": { "csrfToken": "generated-token" }
}
```

`POST`, `PATCH`, `DELETE` 요청은 `X-CSRF-Token: generated-token` 헤더를 포함해야 한다. 토큰이 없거나 일치하지 않으면 `403 CSRF_TOKEN_INVALID`를 반환한다.

개발 서버에서는 CSRF 발급 시 `session_id` HttpOnly 쿠키도 함께 발급한다. 회원가입 또는 로그인 성공 시 인증 세션을 재발급한다.

### 2.3 요청 규칙

- JSON 요청은 `Content-Type: application/json`을 사용한다.
- 경로의 `{id}`는 양의 정수이고 `{slug}`는 URL 인코딩된 slug이다.
- 쿼리의 `q`는 URL 인코딩한다. 앞뒤 공백은 제거하며, 제거 후 빈 문자열이면 검색 조건이 없는 것으로 처리한다.
- `PATCH`는 부분 수정이지만, 전달한 `title`·`content`·`status`가 `null`이면 유효성 오류로 처리한다.
- 생성·수정 API는 저장 트랜잭션을 하나의 작업으로 처리한다.
- 사용자 식별자는 요청 body나 query가 아니라 세션에서만 가져온다.
- 페이지 번호는 1 이상의 정수, `size`는 1~50의 정수만 허용한다.

### 2.4 성공 응답

단일 리소스 응답은 다음 형식을 사용한다.

```json
{
  "data": {}
}
```

목록 응답은 다음 형식을 사용한다.

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

- `page`: 1부터 시작하는 페이지 번호
- `size`: 페이지 크기, 기본값 `10`, 최댓값 `50`
- `totalPages`: `totalItems`가 0이면 `0`
- 기본 목록 정렬은 최신 발행일 내림차순이다.
- `204 No Content` 응답(`logout`, `delete`)은 response body를 반환하지 않는 예외로 한다.

### 2.5 에러 응답

모든 오류는 다음 형식으로 반환한다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값을 확인해 주세요.",
    "fields": {
      "email": "올바른 이메일 형식이 아닙니다."
    }
  }
}
```

`fields`는 입력 필드별 오류가 있을 때만 포함한다.

| HTTP 상태 | code | 의미 |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | 필수값, 형식, 길이 또는 enum 오류 |
| 401 | `UNAUTHENTICATED` | 로그인이 필요하거나 세션이 유효하지 않음 |
| 403 | `FORBIDDEN` | 로그인했지만 리소스 권한이 없음 |
| 403 | `CSRF_TOKEN_INVALID` | CSRF 토큰이 없거나 유효하지 않음 |
| 404 | `NOT_FOUND` | 리소스가 존재하지 않음 |
| 409 | `CONFLICT` | 이메일·slug 중복 또는 상태 충돌 |
| 500 | `INTERNAL_SERVER_ERROR` | 처리하지 못한 서버 오류 |

### 2.6 공통 검증

| 필드 | 규칙 |
|---|---|
| `email` | 필수, 이메일 형식, 최대 255자, 중복 불가 |
| `password` | 필수, 8~72자 |
| `passwordConfirm` | 회원가입 시 필수, `password`와 일치 |
| `nickname` | 필수, 2~30자 |
| `blog.name` | 필수, 2~30자 |
| `blog.slug` | 필수, 3~30자, 영문 소문자·숫자·하이픈만 허용, 전역 unique |
| `blog.description` | 선택, 미입력 시 `""`, 최대 160자 |
| `post.title` | 필수, 최대 100자 |
| `post.content` | 필수, 최대 20,000자 |
| `post.status` | `DRAFT` 또는 `PUBLISHED` |

본문은 MVP에서 일반 텍스트로 저장한다. HTML을 허용하지 않으며, 응답을 HTML로 렌더링할 때도 사용자 입력을 escape하여 XSS를 방지한다. 줄바꿈은 화면에서 `<br>` 또는 CSS `white-space: pre-wrap`으로 표현한다.

## 3. 리소스 표현

### User

```json
{
  "id": 1,
  "email": "user@example.com",
  "nickname": "jungle-user",
  "createdAt": "2026-08-04T09:00:00Z",
  "updatedAt": "2026-08-04T09:00:00Z"
}
```

`passwordHash`는 API 응답에 포함하지 않는다.

### Blog

```json
{
  "id": 10,
  "name": "정글 개발 기록",
  "slug": "jungle-dev",
  "url": "/blog/jungle-dev",
  "description": "매일 배우고 기록합니다.",
  "owner": {
    "id": 1,
    "nickname": "jungle-user"
  },
  "createdAt": "2026-08-04T09:05:00Z",
  "updatedAt": "2026-08-04T09:05:00Z"
}
```

### Post

```json
{
  "id": 100,
  "url": "/post/100",
  "title": "첫 번째 기록",
  "content": "본문 내용입니다.",
  "excerpt": "본문 내용입니다.",
  "status": "PUBLISHED",
  "viewCount": 12,
  "author": {
    "id": 1,
    "nickname": "jungle-user"
  },
  "blog": {
    "id": 10,
    "name": "정글 개발 기록",
    "slug": "jungle-dev"
  },
  "publishedAt": "2026-08-04T09:30:00Z",
  "createdAt": "2026-08-04T09:20:00Z",
  "updatedAt": "2026-08-04T09:30:00Z"
}
```

- `excerpt`는 목록용 본문 요약이며 상세 응답에서는 `content`를 사용한다.
- 공개 목록에서는 `status`가 항상 `PUBLISHED`이다.
- `DRAFT`의 `publishedAt`은 `null`이다.

## 4. 데이터 무결성 및 서버 처리 규칙

### 4.1 데이터베이스 제약

| 테이블 | 제약 및 기본값 |
|---|---|
| `users` | `id` primary key, `email` unique, `passwordHash` 필수, `createdAt`·`updatedAt` 자동 기록 |
| `blogs` | `id` primary key, `ownerId` foreign key, `ownerId` unique, `slug` unique, `name`·`slug` 필수 |
| `posts` | `id` primary key, `blogId` foreign key, `status` 기본 `DRAFT`, `viewCount` 기본 `0`, `publishedAt` nullable |

- `users.email`은 저장 전에 trim 후 소문자로 정규화한다. 응답도 정규화된 이메일을 반환한다.
- `blogs.slug`은 저장 전에 소문자로 정규화한다. 예약어(`api`, `login`, `signup`, `feed`, `post`, `blog`, `me`, `new`)는 사용할 수 없다.
- `posts.blogId`와 `blogs.ownerId`는 foreign key로 연결한다.
- 블로그 삭제 API는 없으므로 블로그 삭제 시 글을 함께 삭제하는 cascade 동작은 MVP에서 사용하지 않는다.
- 글 삭제는 물리 삭제이며, 삭제된 글의 ID를 재사용하지 않는다.

### 4.2 글 상태 및 시간 규칙

허용되는 상태 전이는 다음과 같다.

```text
DRAFT ───────────────→ PUBLISHED
  ↑                         │
  └─────────────────────────┘
```

- 신규 글의 `status`가 없으면 `DRAFT`로 저장한다.
- `DRAFT → PUBLISHED`일 때만 `publishedAt`을 현재 UTC 시각으로 기록한다.
- 이미 발행된 글을 수정할 때는 `publishedAt`을 변경하지 않는다.
- `PUBLISHED → DRAFT`일 때 `publishedAt`을 `null`로 변경한다.
- 모든 생성·수정 시 `updatedAt`을 갱신한다. 조회수 증가만으로 `updatedAt`을 변경하지 않는다.
- 공개 피드 반영은 발행 트랜잭션이 commit된 직후부터 허용한다.

### 4.3 목록·검색·요약 규칙

- 검색은 대소문자를 구분하지 않으며 `q`의 앞뒤 공백을 제거한다.
- 본문 검색은 저장된 plain text 기준으로 수행한다.
- `excerpt`는 HTML 태그를 제거한 본문 앞부분을 최대 160자까지 반환하고, 더 긴 경우 `…`을 덧붙인다.
- 목록 API는 `content` 전문을 반환하지 않는다. 상세 API에서만 전체 본문을 반환한다.
- 인기순은 공개 글의 `viewCount`만 사용하며, 동점일 때 최신 발행 글과 큰 `id`를 우선한다.

### 4.4 조회수 처리

- `GET /api/posts/{id}`에서 공개 글을 정상적으로 반환한 경우에만 `viewCount`를 1 증가시킨다.
- 존재하지 않는 글, 삭제된 글, 비공개 글에 대한 요청은 조회수를 증가시키지 않는다.
- 같은 요청이 재시도되면 기본적으로 요청마다 1회 증가한다. 새로고침 중복 방지는 MVP의 클라이언트 책임이다.

## 5. 인증 API

### POST `/api/auth/signup`

회원가입 후 생성된 사용자 정보를 반환하고 자동 로그인한다. 블로그는 별도 API로 생성한다.

요청:

```json
{
  "email": "user@example.com",
  "nickname": "jungle-user",
  "password": "password123",
  "passwordConfirm": "password123"
}
```

응답 `201 Created` 및 세션 쿠키 발급:

```json
{
  "data": {
    "user": { "id": 1, "email": "user@example.com", "nickname": "jungle-user" },
    "message": "회원가입이 완료되었습니다."
  }
}
```

가능한 오류: `400 VALIDATION_ERROR`, `409 EMAIL_ALREADY_EXISTS`.

### POST `/api/auth/login`

이메일과 비밀번호를 검증하고 세션 쿠키를 발급한다.

요청:

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

응답 `200 OK`:

```json
{
  "data": {
    "user": { "id": 1, "email": "user@example.com", "nickname": "jungle-user" },
    "message": "로그인되었습니다."
  }
}
```

가능한 오류: `400 VALIDATION_ERROR`, `401 INVALID_CREDENTIALS`.

### POST `/api/auth/logout`

현재 세션을 폐기한다. 로그인하지 않은 상태에서도 멱등적으로 처리한다.

응답 `204 No Content`.

### GET `/api/me`

현재 로그인한 사용자와 보유 블로그를 반환한다.

블로그를 아직 만들지 않은 사용자는 `blog: null`을 반환한다.

응답 `200 OK`:

```json
{
  "data": {
    "user": { "id": 1, "email": "user@example.com", "nickname": "jungle-user" },
    "blog": { "id": 10, "name": "정글 개발 기록", "slug": "jungle-dev" }
  }
}
```

가능한 오류: `401 UNAUTHENTICATED`.

## 6. 블로그 API

### POST `/api/blogs`

로그인한 사용자의 블로그를 생성한다. 사용자당 하나만 생성할 수 있다.

요청:

```json
{
  "name": "정글 개발 기록",
  "slug": "jungle-dev",
  "description": "매일 배우고 기록합니다."
}
```

응답 `201 Created`: `Blog` 객체를 `data`에 담아 반환한다.

가능한 오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `409 BLOG_ALREADY_EXISTS`, `409 SLUG_ALREADY_EXISTS`.

### GET `/api/blogs/check-slug?slug={slug}`

블로그 생성 전 slug 사용 가능 여부를 확인한다. 인증 없이 호출할 수 있다.

응답 `200 OK`:

```json
{
  "data": {
    "slug": "jungle-dev",
    "available": true
  }
}
```

형식이 잘못된 slug는 `400 VALIDATION_ERROR`를 반환한다. 최종 생성 시점에 중복이 발생하면 반드시 `409`를 반환한다.

### GET `/api/blogs/me`

로그인한 사용자의 블로그를 조회한다. 관리 화면 진입 시 사용한다.

응답 `200 OK`: `Blog` 객체를 `data`에 담아 반환한다.

가능한 오류: `401 UNAUTHENTICATED`, `404 BLOG_NOT_FOUND`.

### GET `/api/blogs/{slug}`

공개 블로그 정보와 공개 글 목록을 조회한다. 비로그인 호출을 허용한다.

쿼리 파라미터:

- `page`: 기본 `1`
- `size`: 기본 `10`, 최대 `50`

응답 `200 OK`:

```json
{
  "data": {
    "blog": { "id": 10, "name": "정글 개발 기록", "slug": "jungle-dev", "description": "매일 배우고 기록합니다." },
    "posts": {
      "items": [],
      "pagination": { "page": 1, "size": 10, "totalItems": 0, "totalPages": 0 }
    }
  }
}
```

공개 응답에는 `DRAFT` 글을 포함하지 않는다. 존재하지 않는 slug는 `404 NOT_FOUND`를 반환한다. 라우터는 고정 경로 `/api/blogs/me`와 `/api/blogs/check-slug`를 동적 경로 `/api/blogs/{slug}`보다 먼저 등록한다.

## 7. 글 API

### GET `/api/posts`

공개 피드 또는 로그인 사용자의 글 관리 목록을 조회한다.

쿼리 파라미터:

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `scope` | `public` | `public` 또는 로그인 사용자 본인의 `mine` |
| `q` | 없음 | 제목·본문·작성자 닉네임·블로그명 대상 검색어 |
| `sort` | `latest` | `latest` 또는 `popular` |
| `page` | `1` | 페이지 번호 |
| `size` | `10` | 페이지 크기, 최대 50 |
| `status` | `scope`에 따라 다름 | `scope=public`은 항상 `PUBLISHED`, `scope=mine`은 기본 `ALL`이며 `DRAFT`, `PUBLISHED`, `ALL` 선택 가능 |

규칙:

- `scope=public`은 `PUBLISHED` 글만 반환하며 인증이 필요 없다.
- `scope=mine`은 현재 사용자의 블로그 글만 반환하며 인증이 필요하다.
- `scope=public`에서 `status`를 전달하면 `400 VALIDATION_ERROR`를 반환한다. `scope=mine`의 기본 `status`는 `ALL`로 하여 임시저장과 발행 글을 모두 관리할 수 있게 한다.
- `q`가 없으면 검색 조건 없이 목록을 반환한다.
- `q`는 제목·본문·작성자 닉네임·블로그명 중 하나라도 포함하면 일치한다.
- `latest`는 `publishedAt` 내림차순, `popular`는 `viewCount` 내림차순이다. 동일 값이면 `publishedAt` 내림차순, 그 다음 `id` 내림차순을 적용한다.
- `scope=mine`에서 `sort=latest`는 `updatedAt` 내림차순을 사용한다. `sort=popular`는 `viewCount` 내림차순을 사용한다.

응답 `200 OK`: `Post` 목록과 `pagination`을 반환한다.

가능한 오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`(`scope=mine`일 때).

### POST `/api/posts`

로그인한 사용자의 블로그에 글을 생성한다. `DRAFT` 임시저장과 `PUBLISHED` 발행을 모두 처리한다.

요청:

```json
{
  "title": "첫 번째 기록",
  "content": "본문 내용입니다.",
  "status": "DRAFT"
}
```

처리 규칙:

- `DRAFT`: `publishedAt`은 `null`로 저장한다.
- `PUBLISHED`: 저장 시 `publishedAt`을 현재 시각으로 기록한다.
- 사용자가 블로그를 아직 만들지 않았다면 `409 BLOG_REQUIRED`를 반환한다.

응답 `201 Created`: 생성된 `Post`를 `data`에 담아 반환한다.

가능한 오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `409 BLOG_REQUIRED`.

### GET `/api/posts/{id}`

글 상세를 조회하고 조회수를 1 증가시킨다.

- 공개 글: 누구나 조회 가능
- 임시저장 글: 작성자 본인만 조회 가능
- 공개 글의 작성자 본인 조회도 조회수 증가 규칙을 동일하게 적용
- 목록 조회는 조회수를 증가시키지 않음
- 작성자가 아닌 사용자가 임시저장 글을 요청하면 존재 여부를 노출하지 않도록 `404 NOT_FOUND`를 반환한다. 비로그인 요청도 동일하게 처리한다.
- 조회수 증가와 상세 조회는 하나의 트랜잭션으로 처리한다.

응답 `200 OK`: 상세 `Post`를 `data`에 담아 반환한다.

가능한 오류: `404 NOT_FOUND`.

### PATCH `/api/posts/{id}`

작성자 본인이 글의 제목, 본문, 상태를 수정한다.

요청은 변경할 필드만 포함할 수 있다.

```json
{
  "title": "수정한 제목",
  "content": "수정한 본문",
  "status": "PUBLISHED"
}
```

처리 규칙:

- `DRAFT → PUBLISHED`: `publishedAt`을 현재 시각으로 기록한다.
- `PUBLISHED → DRAFT`: `publishedAt`을 `null`로 만들고 공개 목록에서 제외한다.
- `PUBLISHED`를 계속 수정해도 기존 `publishedAt`을 유지한다.

응답 `200 OK`: 수정된 `Post`를 `data`에 담아 반환한다.

가능한 오류: `400 VALIDATION_ERROR`, `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`.

### DELETE `/api/posts/{id}`

작성자 본인의 글을 삭제한다. MVP에서는 물리 삭제를 사용한다.

응답 `204 No Content`.

가능한 오류: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`.

## 8. 권한 및 노출 매트릭스

| 기능 | 비로그인 | 로그인 사용자 | 작성자 본인 |
|---|---:|---:|---:|
| 공개 피드 조회 | 가능 | 가능 | 가능 |
| 공개 블로그/글 조회 | 가능 | 가능 | 가능 |
| 회원가입·로그인 | 가능 | 가능 | 가능 |
| 내 사용자/블로그 조회 | 불가 | 가능 | 가능 |
| 글 임시저장·발행 | 불가 | 가능 | 가능 |
| 본인 글 수정·삭제 | 불가 | 불가 | 가능 |
| 타인의 임시저장 글 조회 | 불가 | 불가 | 불가 |

## 9. 핵심 시나리오별 API 호출 순서

### 신규 사용자

`POST /api/auth/signup` → `POST /api/blogs` → `POST /api/posts` → `GET /api/posts/{id}`

### 기존 사용자 글 발행

`POST /api/auth/login` → `GET /api/blogs/me` → `POST /api/posts` (`status=PUBLISHED`) → `GET /api/posts?scope=public`

### 임시저장 글 수정 후 발행

`POST /api/posts` (`DRAFT`) → `GET /api/posts?scope=mine&status=DRAFT` → `PATCH /api/posts/{id}` (`PUBLISHED`)

## 10. 구현 시 확인할 테스트 항목

- 이메일·slug 중복 시 `409`가 반환된다.
- 비밀번호가 평문으로 저장되거나 응답되지 않는다.
- 비로그인 사용자는 공개 글만 조회할 수 있다.
- 임시저장 글은 피드·공개 블로그에 노출되지 않는다.
- 작성자 외 사용자의 수정·삭제 요청은 `403`이다.
- 상세 조회 1회마다 조회수가 1 증가하고 목록 조회에서는 증가하지 않는다.
- 페이지 기본값과 최대 크기(`size=50`)가 지켜진다.
- 검색·최신순·인기순·결과 없음이 정상 동작한다.
- 로그아웃 후 인증 필요 API가 `401`을 반환한다.
