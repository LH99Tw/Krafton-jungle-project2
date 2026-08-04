# 블로그 클론 서비스 API 명세서

## 1. 문서 정보

- **기준 문서**: `instruction/PRD.md`
- **참고 서비스**: [티스토리](https://www.tistory.com/)
- **API 기본 경로**: `/api`
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

## 2. 공통 규칙

### 2.1 인증

로그인 성공 시 서버는 `HttpOnly`, `Secure`(운영 환경), `SameSite=Lax` 속성의 세션 쿠키를 발급한다.

- 인증 필요 요청: 브라우저가 세션 쿠키를 자동 전송한다.
- 로그아웃: 서버에서 세션을 폐기하고 쿠키를 만료시킨다.
- 비밀번호와 세션 값은 응답 본문이나 로그에 포함하지 않는다.
- 비로그인 사용자는 공개 글 조회 API만 사용할 수 있다.

권장 쿠키 이름은 `session_id`이다. 프론트엔드가 다른 출처의 API 서버를 호출하는 경우 `fetch`에 `credentials: "include"`를 지정하고, 서버는 허용된 프론트엔드 origin에 대해서만 credential 요청을 허용한다. 세션 쿠키를 사용하는 변경 요청에는 CSRF 방어를 적용한다.

### 2.2 요청 규칙

- JSON 요청은 `Content-Type: application/json`을 사용한다.
- 경로의 `{id}`는 양의 정수이고 `{slug}`는 URL 인코딩된 slug이다.
- 쿼리의 `q`는 URL 인코딩하며 공백 검색어는 `400 VALIDATION_ERROR`로 처리한다.
- `PATCH`는 부분 수정이지만, 전달한 `title`·`content`·`status`가 `null`이면 유효성 오류로 처리한다.
- 생성·수정 API는 저장 트랜잭션을 하나의 작업으로 처리한다.

### 2.3 성공 응답

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

### 2.4 에러 응답

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
| 404 | `NOT_FOUND` | 리소스가 존재하지 않음 |
| 409 | `CONFLICT` | 이메일·slug 중복 또는 상태 충돌 |
| 500 | `INTERNAL_SERVER_ERROR` | 처리하지 못한 서버 오류 |

### 2.5 공통 검증

| 필드 | 규칙 |
|---|---|
| `email` | 필수, 이메일 형식, 최대 255자, 중복 불가 |
| `password` | 필수, 8~72자 |
| `nickname` | 필수, 2~30자 |
| `blog.name` | 필수, 2~30자 |
| `blog.slug` | 필수, 3~30자, 영문 소문자·숫자·하이픈만 허용, 전역 unique |
| `post.title` | 필수, 최대 100자 |
| `post.content` | 필수, 최대 20,000자 |
| `post.status` | `DRAFT` 또는 `PUBLISHED` |

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

## 4. 인증 API

### POST `/api/auth/signup`

회원가입 후 생성된 사용자 정보를 반환한다. 블로그는 별도 API로 생성한다.

요청:

```json
{
  "email": "user@example.com",
  "nickname": "jungle-user",
  "password": "password123"
}
```

응답 `201 Created`:

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

## 5. 블로그 API

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

공개 응답에는 `DRAFT` 글을 포함하지 않는다. 존재하지 않는 slug는 `404 NOT_FOUND`를 반환한다.

## 6. 글 API

### GET `/api/posts`

공개 피드 또는 로그인 사용자의 글 관리 목록을 조회한다.

쿼리 파라미터:

| 파라미터 | 기본값 | 설명 |
|---|---|---|
| `scope` | `public` | `public` 또는 로그인 사용자 본인의 `mine` |
| `q` | 없음 | 제목·본문·블로그명 대상 검색어 |
| `sort` | `latest` | `latest` 또는 `popular` |
| `page` | `1` | 페이지 번호 |
| `size` | `10` | 페이지 크기, 최대 50 |
| `status` | `PUBLISHED` | `scope=mine`에서 `DRAFT`, `PUBLISHED` 또는 `ALL` |

규칙:

- `scope=public`은 `PUBLISHED` 글만 반환하며 인증이 필요 없다.
- `scope=mine`은 현재 사용자의 블로그 글만 반환하며 인증이 필요하다.
- `q`가 없으면 검색 조건 없이 목록을 반환한다.
- `latest`는 `publishedAt` 내림차순, `popular`는 `viewCount` 내림차순이다. 동일 값이면 `publishedAt` 내림차순을 적용한다.

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

응답 `200 OK`: 상세 `Post`를 `data`에 담아 반환한다.

가능한 오류: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`.

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

## 7. 권한 및 노출 매트릭스

| 기능 | 비로그인 | 로그인 사용자 | 작성자 본인 |
|---|---:|---:|---:|
| 공개 피드 조회 | 가능 | 가능 | 가능 |
| 공개 블로그/글 조회 | 가능 | 가능 | 가능 |
| 회원가입·로그인 | 가능 | 가능 | 가능 |
| 내 사용자/블로그 조회 | 불가 | 가능 | 가능 |
| 글 임시저장·발행 | 불가 | 가능 | 가능 |
| 본인 글 수정·삭제 | 불가 | 불가 | 가능 |
| 타인의 임시저장 글 조회 | 불가 | 불가 | 불가 |

## 8. 핵심 시나리오별 API 호출 순서

### 신규 사용자

`POST /api/auth/signup` → `POST /api/blogs` → `POST /api/posts` → `GET /api/posts/{id}`

### 기존 사용자 글 발행

`POST /api/auth/login` → `GET /api/blogs/me` → `POST /api/posts` (`status=PUBLISHED`) → `GET /api/posts?scope=public`

### 임시저장 글 수정 후 발행

`POST /api/posts` (`DRAFT`) → `GET /api/posts?scope=mine&status=DRAFT` → `PATCH /api/posts/{id}` (`PUBLISHED`)

## 9. 구현 시 확인할 테스트 항목

- 이메일·slug 중복 시 `409`가 반환된다.
- 비밀번호가 평문으로 저장되거나 응답되지 않는다.
- 비로그인 사용자는 공개 글만 조회할 수 있다.
- 임시저장 글은 피드·공개 블로그에 노출되지 않는다.
- 작성자 외 사용자의 수정·삭제 요청은 `403`이다.
- 상세 조회 1회마다 조회수가 1 증가하고 목록 조회에서는 증가하지 않는다.
- 페이지 기본값과 최대 크기(`size=50`)가 지켜진다.
- 검색·최신순·인기순·결과 없음이 정상 동작한다.
- 로그아웃 후 인증 필요 API가 `401`을 반환한다.
