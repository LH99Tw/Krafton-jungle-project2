# Krafton-jungle-project2
크래프톤 정글 단기 캠프의 두 번째 프로젝트 과제를 위한 레포입니다.

## 실행 구조

- 프론트엔드: 페이지별 HTML + Vanilla JavaScript + CSS → Vercel
- 백엔드: Supabase Edge Function `api`
- 데이터베이스·세션: Supabase PostgreSQL

Express 서버는 사용하지 않습니다. 로컬과 운영 모두 `supabase/functions/api`를 동일하게 실행합니다.

API 코드는 역할별로 나눕니다.

- `index.ts`: 요청 경로를 각 기능으로 전달
- `auth/`: 회원가입·로그인·세션
- `system/`: 상태 확인·OpenAPI·Swagger 문서
- `shared.ts`: Supabase 연결·쿠키·공통 응답

## 로컬 실행

1. Docker Desktop을 실행합니다.
2. Supabase CLI를 설치합니다.
3. `npm run supabase:start`로 로컬 데이터베이스·인증 서비스를 실행합니다.
4. `supabase/functions/api/.env.local`을 만들고 `.env.example` 값을 채웁니다.
터미널을 두 개 열고 실행합니다.

```bash
npm run dev:api
npm run dev:client
```

프론트엔드는 [http://localhost:5173](http://localhost:5173)에서 확인합니다.
`client/server.js`가 정적 HTML을 제공하고 `/api/*` 요청을 로컬 Supabase Edge Function으로 전달하므로 프론트엔드용 환경 변수는 필요하지 않습니다.
공통 헤더와 푸터는 `client/partials`에서 관리하며, 로컬 서버와 production 빌드가 각 HTML에 합성합니다.
작업을 마치면 `npm run supabase:stop`으로 로컬 Supabase 컨테이너를 종료합니다.

Docker는 개발 컴퓨터에서 Supabase와 동일한 환경을 재현할 때만 사용합니다. 운영 백엔드는
별도의 Docker 서버가 아니라 Supabase Edge Function 한 곳에 배포합니다.

## 배포

```bash
npm run build
npm run deploy:api
```

GitHub Actions는 `main`에 반영될 때 Vercel 프론트엔드와 Supabase Edge Function을 배포합니다. 자세한 환경 변수와 시크릿 설정은 [DEPLOYMENT.md](DEPLOYMENT.md)를 참고합니다.
