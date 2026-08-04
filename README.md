# Krafton-jungle-project2
크래프톤 정글 단기 캠프의 두 번째 프로젝트 과제를 위한 레포입니다.

## 실행 구조

- 프론트엔드: React + Vite → Vercel
- 백엔드: Supabase Edge Function `api`
- 데이터베이스·세션: Supabase PostgreSQL

Express 서버는 사용하지 않습니다. 로컬과 운영 모두 `supabase/functions/api`를 동일하게 실행합니다.

## 로컬 실행

1. Supabase CLI를 설치합니다.
2. `supabase/functions/api/.env.local`을 만들고 `.env.example` 값을 채웁니다.
3. `client/.env.local`을 만듭니다.

```env
VITE_API_URL=http://127.0.0.1:54321/functions/v1
```

터미널을 두 개 열고 실행합니다.

```bash
npm run dev:api
npm run dev:client
```

프론트엔드는 [http://localhost:5173](http://localhost:5173)에서 확인합니다.

## 배포

```bash
npm run build
npm run deploy:api
```

GitHub Actions는 `main`에 반영될 때 Vercel 프론트엔드와 Supabase Edge Function을 배포합니다. 자세한 환경 변수와 시크릿 설정은 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고합니다.
