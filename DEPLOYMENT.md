# 배포 설정

## 흐름

`dev`를 `main`에 반영하고 `main`에 push하면 GitHub Actions가 아래 순서로 실행됩니다.

1. client 빌드
2. Vercel production 배포
3. `supabase/migrations`가 존재할 때만 Supabase 마이그레이션 적용
4. Supabase `api` Edge Function 배포

## GitHub Secrets

Repository Settings → Secrets and variables → Actions에 다음 값을 등록합니다.

- `VERCEL_TOKEN`: Vercel Personal Token
- `VERCEL_ORG_ID`: Vercel 팀/계정 ID
- `VERCEL_PROJECT_ID`: client를 배포할 Vercel 프로젝트 ID
- `SUPABASE_ACCESS_TOKEN`: Supabase Access Token
- `SUPABASE_PROJECT_REF`: Supabase 프로젝트 ref
- `SUPABASE_DB_PASSWORD`: Supabase 데이터베이스 비밀번호

Supabase 마이그레이션이 아직 없으면 Supabase job은 자동으로 건너뜁니다.

## Supabase Edge Function 환경 변수

Supabase Dashboard → Edge Functions → Secrets에 다음 값을 등록합니다.

- `FRONTEND_ORIGIN`: 실제 Vercel 배포 주소
- `SESSION_COOKIE_SECURE`: production에서는 `true`

## 로컬 실행

Supabase Edge Function을 로컬에서 실행한다.

```bash
npm run dev:api
```

프론트엔드 개발 서버는 별도 터미널에서 실행한다.

```bash
npm run dev:client
```

`client/.env.local`에는 다음 값을 설정한다.

```env
VITE_API_URL=http://127.0.0.1:54321/functions/v1
```

프론트엔드는 `/api/*` 경로를 사용하고, Vercel에서는 rewrite를 통해 Supabase Edge Function으로 전달한다.

`SUPABASE_URL`과 `SUPABASE_SERVICE_ROLE_KEY`은 Supabase가 기본으로 제공합니다.
