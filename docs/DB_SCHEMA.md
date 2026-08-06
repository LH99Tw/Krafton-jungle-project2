# DB 스키마

기준일: 2026-08-06.

## 카테고리와 분류

두 모델은 이름이 비슷하지만 서로 대체할 수 없다.

| 테이블/컬럼 | 관계 | 의미 |
|---|---|---|
| `blog_categories` | `blogs` 1:N | 관리 페이지에서 만드는 블로그별 글 폴더 |
| `posts.category_id` | `posts` N:1 `blog_categories` | 게시글의 선택적 단일 카테고리 |
| `blog_classifications` | `blogs` 1:N | 관심분야 또는 사용자가 직접 만든 분류 사전 |
| `post_classifications` | `posts` N:M `blog_classifications` | 게시글당 최대 5개 분류와 표시 순서 |
| `users.interests` | `text[]` | 회원가입·설정에서 고른 관심분야 원본 |

### `blog_categories`

- `(blog_id, normalized_name)` 유일성으로 같은 블로그의 중복 이름을 막는다.
- `(blog_id, position)` 유일성으로 관리 페이지 순서를 보존한다.
- 글쓰기에서는 조회·선택만 하며 생성은 관리 페이지 API가 담당한다.
- 사용 중인 카테고리는 삭제하지 않고 `CATEGORY_IN_USE`로 거절한다.

### `blog_classifications`

- `source`는 `INTEREST|CUSTOM`만 허용한다.
- `INTEREST`는 `users.interests`에서 선택해 생성한 분류다.
- `CUSTOM`은 글쓰기에서 직접 만든 분류다.
- UI의 최상단 표시와 `×` 삭제 가능 여부는 이름이 아니라 `source`로 판단한다.
- 사용 중인 분류는 삭제하지 않고 `CLASSIFICATION_IN_USE`로 거절한다.

### `post_classifications`

- 기본키는 `(post_id, classification_id)`로 중복 연결을 막는다.
- `(post_id, position)`은 유일하며 `position`은 0~4만 허용한다.
- 분류 삭제는 `ON DELETE RESTRICT`, 게시글 삭제는 `ON DELETE CASCADE`다.

## 데이터 분리 마이그레이션

- `202608060006`에서 기존 카테고리 행에 `migrated_from_category` 표식을 남긴다.
- `202608060008`은 표식이 있는 행을 `blog_categories`로 복구하고 기존 게시글의 단일 연결을 `posts.category_id`로 이전한다.
- 분리 이후 생성된 관심분야·직접 만든 분류만 `blog_classifications`에 남는다.
- 이미 `202608060006`을 적용한 로컬 DB는 적용 시각 이전 `created_at`을 호환 기준으로 사용한다.

## 게시글 반응

- `post_likes(user_id, post_id)`: 복합 PK로 중복 좋아요 방지.
- `post_bookmarks(user_id, post_id)`: 복합 PK로 중복 북마크 방지.
- `post_comments`: `parent_id`로 한 단계 답글을 표현한다.

## 운영 배너와 권한

- `users.role`: `USER|ADMIN`, 기본값 `USER`.
- `home_banners`: 문구, URL, 이미지 URL, 노출 기간, 순서, 활성 상태.
- 테이블은 RLS를 활성화하고 브라우저 직접 권한을 회수하며 Edge Function의 `service_role`을 통해 접근한다.

## 마켓 상품 좋아요

- 마이그레이션: `202608060010_market_item_likes.sql`.
- `market_item_likes(user_id, item_id, created_at)`: `(user_id, item_id)` 복합 PK로 사용자당 상품별 한 번만 허용한다.
- 사용자와 상품 삭제 시 좋아요 관계도 `ON DELETE CASCADE`로 제거된다.
- `market_item_details` 집계 뷰는 각 상품의 `like_count`를 계산한다. 목록·상세·홈의 인기순 선정이 모두 이 뷰를 사용한다.
- 공개 인기순은 `like_count DESC → created_at DESC → id DESC`이며 삭제되지 않은 `SELLING` 상품만 홈에 포함한다.
