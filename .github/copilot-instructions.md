# Copilot Instructions for 2025-Autumn-Software-Engineering

This repo is a 3-tier chess app:
- `frontend/`: Vite + React + TS web client
- `backend/`: NestJS + Prisma + JWT game API
- `ai-service/`: FastAPI skeleton for AI analysis (not yet integrated)
- `infra/docker/`: local Postgres via Docker Compose

## Architecture and boundaries
- Backend HTTP base: `http://localhost:3000`.
  - Auth is **phone + password** with JWT (email optional, not primary).
  - REST modules live under `backend/src/modules/*` (battle, board, metrics, record, user, etc.).
  - User auth contract (see `backend/src/modules/user/user.controller.ts`):
    - POST `/user/register` body `{ phone: string; password: string; email?: string }`
    - POST `/user/login` body `{ phone: string; password: string }`
  - Auth rules (see `user.service.ts` + `jwt-auth.guard.ts`): password hashed with bcrypt; `phone` duplicated to `username`; service returns `{ accessToken, refreshToken }` signed with `process.env.JWT_SECRET`.
  - Data model (see `backend/prisma/schema.prisma` and `migrations/`): Postgres; `User` has unique `phone`, optional unique `email`, `role` enum, and `refreshTokens` string array; additional models cover boards, battles, records and comments.
  - Cross-cutting:
    - Prisma via `backend/src/prisma/prisma.module.ts` / `prisma.service.ts`.
    - Global response shaping in `backend/src/common/interceptors/response-envelope.interceptor.ts`.
    - Global HTTP error handling in `backend/src/common/filters/http-exception.filter.ts`.
    - JWT guard in `backend/src/common/guards/jwt-auth.guard.ts` for protected routes.
    - CORS enabled in `backend/src/main.ts` for Vite dev (`http://localhost:5173`).
- Frontend talks to backend via `VITE_API_BASE` (default `http://localhost:3000`) and stores the JWT access token in `localStorage.token`.
  - Route guard: `frontend/src/routes/ProtectedRoute.tsx` gates `/app/*` by checking `localStorage.token` and redirects to `/login`.
  - Auth pages: `frontend/src/pages/auth/Login.tsx` and `Register.tsx` POST to `/user/login` and `/user/register` using `frontend/src/services/api.ts` / `lib/http.ts`.
  - Domain logic for chess play, records and battle UI lives under `frontend/src/features/*` and `frontend/src/layouts/AppLayout.tsx`.
- AI service (FastAPI) entry is `ai-service/app/main.py`; currently a placeholder without stable HTTP contracts. Do not assume it in new features unless explicitly requested.

Notes: Some legacy docs mention MySQL or other services (Redis, ELK, etc.). **Authoritative runtime is Postgres only**, wired via `infra/docker/docker-compose.yml` and `backend/prisma/schema.prisma`. Prefer REST + JWT; no WebSocket gateway in this repo (chess real-time uses HTTP + polling / client-side state only).

## Developer workflows (Windows PowerShell)
- One-command dev (DB + backend + frontend): run `./scripts/start-all.ps1` from repo root.
  - Accepts `-ResetDb` to drop and recreate the dev DB (dev-only; wipes all data).
- Backend only: `./scripts/start-backend.ps1`.
  - Reads `backend/prisma/.env`, ensures Prisma generate/migrate, then `npm run start:dev` in `backend/`.
- Frontend only: `./scripts/start-frontend.ps1`.
  - Ensures `frontend/node_modules`, writes `.env` with `VITE_API_BASE` if missing, runs Vite dev server on 5173.
- Database via Docker: `infra/docker/docker-compose.yml` defines local Postgres on 5432 (`postgres/postgres`, db `mydb`). Scripts expect it to be up.

Key env/config
- Backend env lives in `backend/prisma/.env` (used both by Prisma and Nest config):
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public`
  - `JWT_SECRET=your-strong-secret`
- Frontend uses `VITE_API_BASE` (in `frontend/.env`) to build API URLs and reads the JWT access token from `localStorage.token`.

## Conventions and patterns
- **Backend modules**: each feature in `backend/src/modules/<feature>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts` and `dto/*.dto.ts` using `class-validator` decorators.
- **Prisma usage**: inject `PrismaService` from `backend/src/prisma/prisma.service.ts`; use `.findFirst`, `.findMany`, `.create`, `.update` etc. with typed `where` / `data` based on `schema.prisma`.
- **Auth and guards**:
  - Use `JwtAuthGuard` for protected controllers; read the user from `req.user` populated by the guard.
  - Treat `phone` as the only required login identifier; email is optional metadata.
- **HTTP responses**: controllers generally return domain data; `response-envelope.interceptor.ts` wraps it into a unified envelope. When adding new endpoints, follow existing controller return shapes and let the interceptor handle wrapping.
- **Routing on frontend**:
  - Only routes under `/app/*` require auth and are wrapped in `ProtectedRoute`.
  - Public pages (login/register/landing) live under `frontend/src/pages/auth` and `frontend/src/pages/app`.
- **API calls on frontend**: prefer using `frontend/src/services/api.ts` and `frontend/src/lib/http.ts` helpers (which already inject base URL and auth headers) over raw `fetch`.
- **Docs as source of truth**: for domain rules (battle flow, board format, metrics, records), consult `docs/BOARD_DATA_FORMAT.md`, `docs/battle-plan.md`, `docs/METRICS.md`, `docs/API_SPEC.md` and align new endpoints/types with them.

## Examples
- Adding a new secured backend endpoint:
  - Create `backend/src/modules/report/report.module.ts`, `report.controller.ts`, `report.service.ts`, `dto/create-report.dto.ts`.
  - Inject `PrismaService` in `report.service.ts` and implement DB operations using existing models (or extend `schema.prisma` and run migrations via `./scripts/start-backend.ps1 -ResetDb`).
  - Decorate controller methods with `@UseGuards(JwtAuthGuard)` and read the current user from the request.
  - Expose it via REST under `/report/...` and document it in `docs/API_SPEC.md` if it becomes stable.
- Consuming the new endpoint from frontend:
  - Add typed API wrapper in `frontend/src/services/api.ts` using the shared `request` helper.
  - Call it from a new React component under `frontend/src/features/...` or a page under `frontend/src/pages/app/...`, behind `ProtectedRoute`.
  - Rely on `localStorage.token` (already wired in `lib/http.ts`) for auth; do not store tokens elsewhere without updating `ProtectedRoute`.

If anything is unclear (e.g., record/battle data shapes, metrics semantics, or how to extend AI service), please leave comments in `docs/` or open an issue so we can refine these instructions.
