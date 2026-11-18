# Architecture & Product Decisions

Every entry records the assumption made and why. Update this file when a
decision changes.

## Product assumptions

- **Instructor onboarding**: self-registration creates a **student** account.
  To become an instructor the user submits an application (bio + optional
  website); admins approve or reject from the queue. Approved applicants keep
  the same account, upgraded to the instructor role. Admins can also promote
  any user manually.
- **Email**: no real SMTP server is assumed to exist in dev. The mailer logs
  emails to the console when SMTP env vars are absent, and exposes the
  verification/reset token in the log line so flows remain testable.
- **Payments**: enrollment in the MVP is free (or "mock-paid"). An
  `Order`/`Payment` collection with a provider-neutral interface is planned so
  Stripe/Razorpay can be plugged in without schema changes.
- **Certificates** are generated as PDFs via pdf-lib and served through the
  storage abstraction; verification is a public, unguessable certificate id.

## API conventions

- **Envelope**: `{ success: true, data, message?, meta? }` or
  `{ success: false, message, errors? }`. Errors use `errors[]` with
  `{ code, message, field? }`; validation failures return HTTP 422.
- **Ports**: API on **5001** (3000/3001 are reserved for Next.js dev/build),
  web on 3000.
- **Docs**: OpenAPI served at `/api/v1/docs` via swagger-ui + zod-generated
  components in the hardening phase.

## Technical choices and rationale

- **ESM everywhere** (`"type": "module"`, NodeNext modules) — Node ≥ 20 LTS,
  tsx, Vitest, and Next.js all support it; future-proofs the API layer.
- **Express 5** — current stable major; native async error forwarding;
  `req.query` is a read-only getter, which is why **`express-mongo-sanitize`
  is replaced by a small in-house body sanitizer** plus careful query
  construction. Route params are whitelisted schemas, never merged with user
  operators.
- **NoSQL injection strategy** — Mongoose's global `sanitizeFilter` is
  deliberately OFF: it wraps *every* operator value (`$gt`, `$elemMatch`,
  `$in`…) in `$eq`, breaking normal operator queries. Instead: (1) request
  bodies are sanitized by an in-house middleware that strips `$`-keys and
  dotted paths, (2) every endpoint validates inputs with Zod and builds query
  filters from individual validated scalars — raw user objects never flow
  into filters, (3) session-token lookups use dotted paths on unguessable
  random hashes.
- **bcryptjs instead of argon2** — pure-JS implementation avoids native build
  fragility across machines; argon2 can be swapped behind the same service
  boundary later without API changes.
- **zod v4** — current major; schemas are authored in the shared package so
  frontend forms (RHF) and backend validators stay in lockstep.
- **pino/pino-http** — fastest structured logger, request ids via
  `x-request-id` (honored if set by proxies for distributed tracing).
- **In-house `sendSuccess`/`sendError` helpers** keep the envelope shape
  centralized in one module so responses cannot drift apart.
- **Rate limiter** — `express-rate-limit` in-memory by default. Redis-backed
  stores are an optional documented add-on for multi-instance deployments;
  not a hard dependency in MVP.
- **Next.js 16 `cacheComponents` (PPR)** — pages are prerenderable by default
  and dynamic access must stream inside `<Suspense>` or opt out per segment
  with `export const instant = false`. The course detail page opts out
  because `generateMetadata` + draft preview read the request's cookies; its
  body still streams via an inner Suspense boundary (partial prerender).
  Current time (copyright year) is read client-side via `useSyncExternalStore`
  — sync IO like `new Date()` can never be deferred and fails the build.
- **MongoDB pinned to `mongo:8.3.17`** — mongo:8 hard-fails on Linux kernels
  ≥ 6.19 (SERVER-121912 rseq/TCMalloc incompatibility); 8.3.17 contains the
  fixed build and boots on kernel 7.x.
- **Session lookups use dotted paths** (`refreshSessions.tokenHash` +
  `refreshSessions.expiresAt`) instead of `$elemMatch` — they are equivalent
  here because the token hash is an unguessable random key, and dotted paths
  survive any future filter-sanitization changes.

## Things deliberately NOT done (yet)

- Real email sending — captured/logged until phase 8/9.
- Stripe/Razorpay integration — interface stub only.
- Redis — optional store adapter documented, not installed.

## Quizzes (Phase 5)

- **One quiz per course** (MVP). `POST /courses/id/:id/quizzes` upserts
  (create or replace) and returns 200 for both; documented in docs/API.md.
- **Correct answers are stored as option ids, authored as indexes.** The
  authoring payload uses `correctOptionIndexes`; the service generates option
  ids up front (`new Types.ObjectId()`) and persists `correctOptionIds`.
  Student endpoints strip all grading data (`PublicQuiz` shape).
- **Grading** = exact set match between submitted and correct option ids per
  question; percent = earned/total points; `passed = scorePercent >= passScore`
  (default 70). Unanswered questions count as incorrect; a submission
  answering no seeded question is rejected (400 `EMPTY_ATTEMPT`).
- **Retakes are unlimited** in the MVP; attempt history is kept for review
  (instructor sees all, student sees own). A pass/attempt gate for
  certificates is a natural Phase 6 hook.
- Quiz routes mount on `/courses` alongside the course router
  (`/id/:courseId/quiz...` for students, `/id/:id/quizzes...` for
  instructors) — no path collisions with `/:slug` routes.
