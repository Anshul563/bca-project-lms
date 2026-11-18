# BCA Project — Learning Management System (LMS)

A full-stack LMS where students discover and enroll in courses, learn through
lessons, take quizzes, and earn verifiable certificates. Separate dashboards
exist for students, instructors, and administrators.

## Features

- **Catalog & discovery** — search, category/level/price filters, sorting, rich
  course detail pages, free previews, and published-only visibility.
- **Learning experience** — enrollment, per-lesson progress, resume-where-you-
  left-off, auto-completion at 100%, and gated lesson content.
- **Assessments** — one quiz per course, unlimited retakes, exact set-match
  grading, pass thresholds, and answer-key secrecy.
- **Certificates** — automatic issuance on completion (plus a passed quiz when
  one exists), public serial verification, and a printable certificate page.
- **Reviews** — enrollment-gated ratings with aggregated course averages.
- **Instructor studio** — create drafts, upload thumbnails, manage sections and
  type-aware lessons (article/video/PDF/link), submit for review, and see admin
  feedback inline.
- **Paid courses** — mock checkout: orders, idempotent payment confirmation, and
  enrollment activation only after payment.
- **Admin console** — instructor application approvals, user role/suspension
  management, and course moderation with rejection notes.
- **Auth & security** — JWT access tokens, rotating refresh cookies, lockout,
  RBAC, rate limiting, helmet, and strict Zod validation everywhere.

## Tech stack

| Layer      | Choice |
|------------|--------|
| Language   | TypeScript everywhere (`strict`, ESM) |
| Monorepo   | pnpm workspaces |
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query, RHF + Zod |
| Backend    | Node.js + Express 5 (routes → controller → service → model) |
| Database   | MongoDB (Mongoose), Docker Compose |
| Validation | Zod 4 schemas shared between web and api |
| Auth       | JWT access token + rotating refresh cookie, bcrypt hashing |
| Storage    | Local disk (dev + single-node prod) behind a URL-only contract |
| Testing    | Vitest + Supertest (API integration) |
| Tooling    | ESLint 9 (flat), Prettier, Husky + lint-staged, pino |

## Monorepo layout

```
apps/
  web/     Next.js frontend
  api/     Express backend
packages/
  shared/       Zod schemas, enums, constants, types shared by web + api
  tsconfig/     Shared TS configs
  eslint-config/ Shared flat ESLint configs
docs/            API contract, architecture decisions, deployment guide
```

## Quick start

Prerequisites: Node.js ≥ 20, pnpm ≥ 9 (corepack enables it), Docker with Compose.

```bash
pnpm install
docker compose up -d mongodb

cp apps/api/.env.example apps/api/.env
#   edit JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, e.g. openssl rand -base64 48
cp apps/web/.env.local.example apps/web/.env.local

pnpm seed
pnpm dev       # Web: http://localhost:3000  API: http://localhost:5001
```

### Demo accounts (seeded, development only)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@lms.local` | `Admin123!` |
| Instructor | `instructor@lms.local` | `Instructor123!` |
| Student | `student@lms.local` | `Student123!` |

The seed also creates a free demo bootcamp (`modern-web-development-bootcamp`)
and a paid course (`advanced-react-patterns`, $29.99) to exercise checkout.

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Start Mongo + web + api in watch mode |
| `pnpm dev:api` / `pnpm dev:web` | Single app |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | `tsc --noEmit` for every workspace |
| `pnpm lint` | ESLint for every workspace |
| `pnpm test` | Vitest suites |
| `pnpm format` / `pnpm format:check` | Prettier write / check |
| `pnpm db:up` / `pnpm db:down` | Mongo container |
| `pnpm seed` | Idempotent demo data |

## Environment

`apps/api/.env.example` documents every API variable: Mongo URI, CORS origins,
JWT secrets/TTLs, cookie flags, rate limits, upload storage, and optional SMTP.
Production startup refuses weak JWT secrets when `NODE_ENV=production`.

`apps/web/.env.local.example` covers `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_SITE_URL`. Both are inlined at build time in the Docker image.

## Testing

```bash
docker compose up -d mongodb
pnpm --filter @lms/api test     # 90 integration tests across 10 suites
pnpm typecheck && pnpm lint
pnpm --filter @lms/web build
```

Tests run against a dedicated test database and drop it on teardown.

## Deployment

Production Docker images, a compose file, a reverse-proxy layout, backups, and
a security checklist live in **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)**.
Short version:

```bash
export JWT_ACCESS_SECRET=$(openssl rand -base64 48)
export JWT_REFRESH_SECRET=$(openssl rand -base64 48)
docker compose -f docker-compose.prod.yml up -d --build
```

## Docs

- [`docs/API.md`](docs/API.md) — REST contract (`/api/v1`)
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — assumptions and design rationales
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — production deployment guide

## Security notes

- Helmet on the API; baseline security headers + HSTS (production) on the web app.
- Access tokens are short-lived (15 min default) and held in memory; refresh
  tokens rotate in an httpOnly cookie.
- Auth endpoints are rate-limited separately from the global limiter; repeated
  failed logins lock the account temporarily.
- Uploads validate MIME type and per-type byte limits; filenames are UUIDs.
- No HTML from user content is rendered as raw markup (lesson articles render as
  text), and all request bodies are Zod-validated.
- Next.js may print an upgrade advisory at build time; run
  `pnpm --filter @lms/web exec next upgrade --agent=security` when convenient and
  re-verify the build.

## Status

- [x] Phase 1 — Monorepo foundation, Mongo, health endpoint
- [x] Phase 2 — Auth & RBAC
- [x] Phase 3 — Courses & catalog
- [x] Phase 4 — Enrollment, progress & learning player
- [x] Phase 5 — Quizzes & grading
- [x] Phase 6 — Reviews, ratings & certificates
- [x] Phase 7 — Admin: applications, users & course moderation
- [x] Phase 8 — Orders, mock payments, uploads & instructor authoring
- [x] Phase 9 — Security headers, Docker images, deployment docs & seed polish
