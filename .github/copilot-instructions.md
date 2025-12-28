
# Copilot Instructions

**Project**: Chinese chess (象棋) platform with custom game editor, battle system, game records, and community features.

## Architecture Overview

Three-tier app: React SPA (port 5173) → NestJS REST API (port 3000) → PostgreSQL (port 5432).

**Key modules** (`backend/src/modules/`): `user/` (auth/profile), `board/` (custom layouts & rules), `battle/` (real-time play), `record/` (game history & analysis), `community/` (forums, posts), `metrics/` (Prometheus monitoring).

**Data model** (`backend/prisma/schema.prisma`): User → Board (custom layouts), Record (game history), Battle (live games), Community (posts/comments). Records store move sequences as JSON for playback & AI analysis.

## Critical Developer Workflows

**Start dev stack** (PowerShell, repo root):
- Full stack: `./scripts/start-all.ps1` (or `-ResetDb` to wipe DB)
- Backend only: `./scripts/start-backend.ps1` (auto-runs `prisma generate && prisma migrate`)
- Frontend only: `./scripts/start-frontend.ps1` (writes `.env`, starts Vite)

**Database setup** (dev):
- Postgres runs in Docker: `infra/docker/docker-compose.yml` (user/pass: postgres/postgres, db: mydb)
- Env file: `backend/prisma/.env` (must have `DATABASE_URL` and `JWT_SECRET`)
- After schema changes: `cd backend && npm run prisma:generate && npm run prisma:migrate`

**Testing & validation**:
- Backend: `npm run test` (unit), `npm run test:e2e` (integration via `backend/test/jest-e2e.json`)
- Frontend: use `VITE_API_BASE=http://localhost:3000` for local testing

## Response & Auth Patterns

**Response envelope**: All HTTP responses wrapped as `{ code, message, data }` by `backend/src/common/interceptors/response-envelope.interceptor.ts`. Controllers return **plain domain objects** (not pre-wrapped). Example:

```typescript
// ✅ Controller returns domain object; interceptor wraps it
return { id: 1, name: 'Board' }

// ❌ Don't wrap manually
return { code: 0, data: { id: 1 } }
```

**JWT auth**: 
- Endpoint protection: `@UseGuards(JwtAuthGuard)` (imports from `backend/src/common/guards/`)
- Extract user: `@Request() req => req.user` (set by JWT middleware)
- Client: stores token in `localStorage.token`, passes `Authorization: Bearer <token>` header (auto-added by `frontend/src/lib/http.ts`)
- Token refresh: HTTP interceptor in `frontend/src/lib/http.ts` auto-refreshes on 401

## Backend NestJS Conventions

**Module layout**: Each feature under `backend/src/modules/<feature>/`:
```
<feature>/
├── <feature>.module.ts       # imports, exports
├── <feature>.controller.ts   # route handlers
├── <feature>.service.ts      # business logic
└── dto/
    ├── create-<feature>.dto.ts
    └── update-<feature>.dto.ts
```

**Database access**: Always inject & use `PrismaService` (`backend/src/prisma/prisma.service.ts`):
```typescript
constructor(private prisma: PrismaService) {}
async find() { return this.prisma.board.findMany() }
```

**Validation**: Use `class-validator` decorators in DTOs. Global `ValidationPipe` in `backend/src/main.ts` auto-validates & transforms (e.g., string → number).

**Error handling**: `backend/src/common/filters/http-exception.filter.ts` catches exceptions; return plain `Error` or throw `HttpException` (interceptor wraps into envelope).

## Frontend React Patterns

**API client**: `frontend/src/services/api.ts` contains typed wrappers (uses `frontend/src/lib/http.ts` axios instance):
```typescript
boardApi.create(request)  // Returns typed response or throws
battleApi.move(battleId, moveData)
```

**Route protection**: `frontend/src/routes/ProtectedRoute.tsx` — wrap routes requiring auth. Reads token from `localStorage.token`.

**State & types**: 
- Types from OpenAPI spec: `frontend/src/types/api.ts` (auto-generated or manually mapped)
- UI components: `frontend/src/components/`, features: `frontend/src/features/`

**Environment**: `frontend/.env` must have `VITE_API_BASE=http://localhost:3000` (written by `start-frontend.ps1`)

## Domain Model Specifics

- **Board**: `layout` (piece positions as JSON), `rules` (custom rule set as JSON), flags `isTemplate` (reusable starting positions), `isEndgame` (endgame puzzles)
- **Record**: `moves` (sequence of moves as JSON), `result` (win/loss/draw), `endReason` (checkmate/timeout/resign), `keyTags` (analysis tags)
- **Battle**: live game state, uses Socket.IO for real-time updates (connection via `frontend/src/services/battlesSocket.ts`)
- **Community**: Post, PostComment, PostLike — standard forum structure

## Known Constraints & Cautions

- **No real WebSocket gateway yet**: Battle updates via Socket.IO, but game-loop server-side validation needs design review before production
- **ai-service/**: Placeholder FastAPI app (`ai-service/app/main.py`) — do NOT wire for production without approval
- **CORS**: Auto-enabled for localhost:5173/5174 in dev mode (`backend/src/main.ts`); production relies on Nginx
- **Android builds**: Use `./scripts/generate-android.ps1` for Capacitor; requires JDK 17, Android SDK 15

## Quick Task Templates

**Add protected endpoint**:
1. Create `backend/src/modules/<name>/` with controller/service
2. Inject `PrismaService`, decorate with `@UseGuards(JwtAuthGuard)`
3. Add typed wrapper in `frontend/src/services/api.ts`
4. Call from UI component

**Add API field**:
1. Update `backend/prisma/schema.prisma`
2. `cd backend && npm run prisma:generate && npm run prisma:migrate`
3. Update backend DTO & service
4. Extend frontend type in `frontend/src/services/api.ts`

**Trace issue**: Check logs in order: frontend console → `VITE_API_BASE` config → backend NestJS logs → Postgres query logs (via Docker)
