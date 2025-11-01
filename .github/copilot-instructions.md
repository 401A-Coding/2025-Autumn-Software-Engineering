# Copilot Instructions for 2025-Autumn-Software-Engineering

This repo is a 3-tier app:
- frontend (Vite + React + TS) in `frontend/`
- backend (NestJS + Prisma + JWT) in `backend/`
- ai-service (FastAPI) in `ai-service/` (placeholder for now)
- local infra (Docker Compose for Postgres) in `infra/docker/`

## Architecture and boundaries
- Backend exposes REST under `http://localhost:3000`. Auth is email/phone + password with JWT.
  - User endpoints (see `backend/src/modules/user/user.controller.ts`):
    - POST `/user/register` body `{ phone: string, password: string, email?: string }`
    - POST `/user/login` body `{ phone: string, password: string }`
  - Service rules (see `user.service.ts`): passwords hashed with bcrypt; `phone` also stored in `username`; returns `{ accessToken, refreshToken }` signed by `@nestjs/jwt` using `process.env.JWT_SECRET`.
  - Data model (see `backend/prisma/schema.prisma`): PostgreSQL; `User` has unique `phone`, optional unique `email`, `role` enum, `refreshTokens` string array.
  - Cross-cutting: Prisma provided via `PrismaModule` (`backend/src/prisma`); CORS enabled in `src/main.ts` for Vite dev (5173).
- Frontend hits backend via `VITE_API_BASE` (defaults to `http://localhost:3000`) and keeps `accessToken` in `localStorage.token`.
  - Route guard: `frontend/src/routes/ProtectedRoute.tsx` gates `/app/*` by checking `localStorage.token` and redirects to `/login`.
  - Auth pages: `pages/auth/Login.tsx` and `Register.tsx` POST to `/user/login` and `/user/register` respectively.
- AI service (FastAPI) scaffold exists (`ai-service/app/main.py`) but is empty; not yet wired to backend.

Notes: Some legacy docs mention MySQL, but current stack uses Postgres (see `infra/docker/docker-compose.yml` and `docs/STARTUP.md`).

## Developer workflows (Windows PowerShell)
- One-command local dev (DB + backend + frontend): `./scripts/start-all.ps1` (opens two terminals). Optional `-ResetDb` to wipe dev DB.
- Backend only: `./scripts/start-backend.ps1` (reads `backend/prisma/.env`, runs Prisma generate/migrate, `npm run start:dev`).
- Frontend only: `./scripts/start-frontend.ps1` (ensures deps and writes `.env` with `VITE_API_BASE` if missing; runs Vite on 5173).
- Postgres via Docker Compose: `infra/docker/docker-compose.yml` (5432; user/pass `postgres`/`postgres`, db `mydb`).

Key env/config
- Backend DB URL and JWT secret reside in `backend/prisma/.env`:
  - `DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/mydb?schema=public`
  - `JWT_SECRET=your-strong-secret`
- Frontend reads `VITE_API_BASE`; token stored at `localStorage.token`.

## Conventions and patterns to follow
- Nest module layout: feature modules under `backend/src/modules/<feature>` with `*.module.ts`, `*.controller.ts`, `*.service.ts` and `dto/*` using `class-validator`.
- Prisma access through injected `PrismaService`; prefer `findFirst`/`create` with typed where/data.
- Auth: treat `phone` as primary login; when extending, keep token issuance via `JwtService` and update `ProtectedRoute` if storage changes.
- CORS: if adding new dev origins, update `backend/src/main.ts` `app.enableCors({ origin: [...] })`.
- Tests: Jest is configured in backend (see `backend/package.json` and `test/`); run `npm test` inside `backend`.

## Examples
- Add a new secured endpoint in backend: create a new module under `src/modules/foo/`, inject `PrismaService`, and read JWT from `Authorization` header. Mirror frontend calls via `fetch(`${VITE_API_BASE}/foo/...`)` and gate route with `ProtectedRoute`.
- Extend `User` with profile fields: edit `backend/prisma/schema.prisma`, then run `./scripts/start-backend.ps1 -ResetDb` (dev-only) or `npm run prisma:migrate` to evolve schema.

If anything is unclear (e.g., token refresh storage, AI-service integration plan), please comment and we’ll refine these instructions.
