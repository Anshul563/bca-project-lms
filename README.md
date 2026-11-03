# BCA Project — Learning Management System (LMS)

A full-stack LMS where students discover and enroll in courses, learn through
lessons, take quizzes, and earn verifiable certificates. Separate dashboards
exist for students, instructors, and administrators.

## Tech stack

| Layer      | Choice |
|------------|--------|
| Language   | TypeScript everywhere (`strict`, ESM) |
| Monorepo   | pnpm workspaces |
| Frontend   | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, TanStack Query, RHF + Zod |
| Backend    | Node.js + Express 5 (layered: routes → controller → service → model) |
| Database   | MongoDB (Mongoose) via Docker Compose |
| Validation | Zod 4 schemas shared between web and api |
| Auth       | JWT access token + rotating refresh cookie, bcrypt hashing |
| Storage    | Pluggable adapter: local disk (dev) / Cloudinary (prod) |
| Testing    | Vitest + Supertest (API), React Testing Library (web), Playwright (E2E) |
| Tooling    | ESLint 9 (flat), Prettier, Husky + lint-staged, Docker Compose, pino |

## Monorepo layout

```
apps/
  web/     Next.js frontend
  api/     Express backend
packages/
  shared/  Zod schemas, enums, constants, types shared by web + api
  tsconfig/  Shared TS configs
  eslint-config/  Shared flat ESLint configs
docs/      API docs, architecture decisions
```

## Quick start

Prerequisites: Node.js ≥ 20, pnpm ≥ 9 (corepack enables it automatically),
Docker with Compose.

```bash
pnpm install

# Start MongoDB
docker compose up -d mongodb

# Configure the API (copy example, generate secrets)
cp apps/api/.env.example apps/api/.env
#   then edit JWT_ACCESS_SECRET / JWT_REFRESH_SECRET, e.g.:
#   openssl rand -base64 48

# Seed an admin + demo data
pnpm seed          # (available from Phase 2)

# Run everything
pnpm dev           # Web: http://localhost:3000  API: http://localhost:5001
```

## Scripts

| Command               | Purpose |
|-----------------------|---------|
| `pnpm dev`            | Start Mongo + web + api in watch mode |
| `pnpm dev:api` / `pnpm dev:web` | Single app |
| `pnpm build`          | Build all workspaces |
| `pnpm typecheck`      | `tsc --noEmit` for every workspace |
| `pnpm lint`           | ESLint for every workspace |
| `pnpm test`           | Vitest suites for every workspace |
| `pnpm format`         | Prettier write |
| `pnpm db:up` / `db:down` | Mongo container |
| `pnpm seed`           | Seed demo data |

## Docs

- `docs/API.md` — REST contract (`/api/v1`)
- `docs/DECISIONS.md` — assumptions and dependency rationales

## Status / roadmap

- [x] Phase 1 — Monorepo foundation, Docker Mongo, health endpoint
- [ ] Phase 2 — Auth & RBAC
- [ ] Phase 3 — Courses & catalog
- [ ] Phase 4 — Enrollment & learning
- [ ] Phase 5 — Assessments
- [ ] Phase 6 — Reviews, ratings & certificates
- [ ] Phase 7 — Dashboards & analytics
- [ ] Phase 8 — Hardening
- [ ] Phase 9 — Testing & docs
