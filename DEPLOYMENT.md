# 배포 설정

## 흐름

`dev`를 `main`에 반영하고 `main`에 push하면 GitHub Actions가 아래 순서로 실행됩니다.

1. client 빌드와 server 테스트
2. Vercel production 배포
3. `supabase/migrations`가 존재할 때만 Supabase 마이그레이션 적용

## GitHub Secrets

Repository Settings → Secrets and variables → Actions에 다음 값을 등록합니다.

- `VERCEL_TOKEN`: Vercel Personal Token
- `VERCEL_ORG_ID`: Vercel 팀/계정 ID
- `VERCEL_PROJECT_ID`: client를 배포할 Vercel 프로젝트 ID
- `SUPABASE_ACCESS_TOKEN`: Supabase Access Token
- `SUPABASE_PROJECT_REF`: Supabase 프로젝트 ref
- `SUPABASE_DB_PASSWORD`: Supabase 데이터베이스 비밀번호

Supabase 마이그레이션이 아직 없으면 Supabase job은 자동으로 건너뜁니다.
