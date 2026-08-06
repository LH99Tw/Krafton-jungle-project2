# API 계약

기준일: 2026-08-06. 실행 가능한 OpenAPI 원본은 `supabase/functions/api/system/openapi.ts`이며 브라우저 요청에는 `/api` 접두사를 붙인다.

## 카테고리와 분류의 경계

| 개념 | 용도 | 생성 위치 | 게시글 연결 | API |
|---|---|---|---|---|
| 카테고리 | 블로그 안에서 글을 한 곳에 묶는 단일 폴더 | 블로그 관리 > 카테고리에서만 | `categoryId` 0~1개 | `/blogs/me/categories` |
| 분류 | 홈과 검색에서 `#해시태그`처럼 사용하는 주제 | 회원 관심분야를 선택하거나 글쓰기에서 직접 생성 | `classificationIds` 0~5개 | `/blogs/me/classifications` |

글쓰기 화면은 카테고리를 생성하지 않는다. `GET /blogs/me/categories` 결과를 선택만 한다. 분류는 회원가입·설정에서 저장한 `users.interests`를 기본 선택지로 보여주며, 선택 시 필요한 분류 레코드를 생성할 수 있다.

## 카테고리 API

- `GET /blogs/me/categories`: 현재 블로그의 카테고리를 `position` 순서로 반환한다.
- `POST /blogs/me/categories`: 관리 페이지에서만 호출한다. 이름은 1~30자, 블로그당 최대 30개다.
- `PATCH /blogs/me/categories/{id}`: 이름을 변경한다.
- `PATCH /blogs/me/categories/order`: 현재 전체 ID를 `categoryIds`로 보내 순서를 교체한다.
- `DELETE /blogs/me/categories/{id}`: 사용 중인 글이 있으면 `409 CATEGORY_IN_USE`를 반환한다.

카테고리 응답 필드: `id`, `name`, `position`, `activePostCount`, `trashPostCount`.

## 분류 API

- `GET /blogs/me/classifications`: 현재 블로그에 실제 생성된 분류를 반환한다.
- `POST /blogs/me/classifications`: `{ name, source }`로 생성한다.
  - `source: INTEREST`: 이름이 현재 사용자의 `users.interests`에 있어야 한다.
  - `source: CUSTOM`: 글쓰기에서 직접 만든 분류다.
- `PATCH /blogs/me/classifications/{id}`: 이름을 변경한다.
- `PATCH /blogs/me/classifications/order`: 현재 전체 ID를 `classificationIds`로 보내 순서를 교체한다.
- `DELETE /blogs/me/classifications/{id}`: 직접 만든 `CUSTOM` 분류 UI에서 사용한다. 게시글이 사용 중이면 `409 CLASSIFICATION_IN_USE`를 반환한다.

분류 응답 필드: `id`, `name`, `position`, `source`, `activePostCount`, `trashPostCount`. 클라이언트는 이름 비교로 출처를 추측하지 않고 반드시 `source`를 사용한다.

## 게시글

- `GET /posts`: `scope=public|mine|following|bookmarked`, `sort=latest|popular`.
- `POST /posts`, `PATCH /posts/{id}`: `categoryId` 0~1개와 중복 없는 `classificationIds` 0~5개를 받는다.
- 카테고리와 분류 ID는 모두 현재 사용자가 소유한 블로그의 항목이어야 한다.
- 응답은 `category`, `classifications`, `viewCount`, `likeCount`, `bookmarkCount`, `commentCount`, `isLiked`, `isBookmarked`를 포함한다.
- 좋아요: `POST|DELETE /posts/{id}/like`.
- 북마크: `POST|DELETE /posts/{id}/bookmark`.
- 댓글: `GET|POST /posts/{id}/comments`, `PATCH|DELETE /comments/{id}`. 답글 깊이는 1단계다.

## 홈과 배너

- `GET /home`: `banners`, `popularPosts`, `categoryPosts`, `trendingPosts`, `latestPosts`, `creators`, `marketItems`를 반환한다.
- `marketItems`는 삭제되지 않은 `SELLING` 상품을 `likeCount DESC → createdAt DESC → id DESC`로 정렬한 최대 5개다.
- 반응 점수: `조회수 + 좋아요×3 + 댓글×4 + 북마크×2`, 동점은 최신 발행순.
- `GET /home/banners`: 현재 시각에 활성화된 배너 최대 4개.
- `/admin/home-banners`: `ADMIN` 역할 전용 CRUD.

## 마켓

상품 CRUD·검색·휴지통, 상품 이미지 업로드, 상품별 채팅방, 메시지 조회·전송·읽음 처리를 지원한다. 채팅함은 대화 목록을 5초, 열린 대화를 3초 간격으로 갱신하는 MVP 준실시간 방식이다. 이미지 업로드의 구현 계약은 [MARKET_IMAGE_UPLOAD_DESIGN.md](./MARKET_IMAGE_UPLOAD_DESIGN.md)를 따른다.

- `GET /market/items`: `sort=latest|popular|price_asc|price_desc`. `popular`는 `likeCount DESC → createdAt DESC → id DESC` 순이다.
- 목록·상세·홈의 상품 응답은 같은 DTO를 사용하며 `likeCount`, 현재 사용자 기준 `isLiked`를 포함한다. 비로그인은 `isLiked=false`다.
- `POST /market/items/{id}/like`: 삭제되지 않은 `SELLING` 상품에 좋아요를 추가한다. 복합 키와 upsert로 중복 요청을 안전하게 처리한다.
- `DELETE /market/items/{id}/like`: 자신의 좋아요를 제거하며 중복 호출에도 `204`를 반환한다.
- `GET /market/conversations`: 구매자·판매자 공용 채팅 목록과 상대방, 상품, 마지막 메시지, 안 읽은 개수를 반환한다.
- `POST /market/conversations/{id}/read`: 상대방이 보낸 안 읽은 메시지를 읽음 처리한다.
