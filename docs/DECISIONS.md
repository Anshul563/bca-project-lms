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

## Reviews & certificates (Phase 6)

- **One review per learner per course**, create-or-replace via `PUT …
  /reviews/my`. Only actively-enrolled (active/completed) learners may
  review; comments are optional. `ratingAverage`/`ratingCount` are
  denormalized onto the course and recomputed from an aggregation on every
  save/delete (small scale; if review volume grows this becomes an
  incremental update or scheduled rollup).
- **Certificate policy**: lessons at 100% AND, when the course has a quiz, a
  passed attempt. This matches the core journey (learn → quiz → certificate)
  without blocking quiz-less courses. Issuance is attempted from both
  `completeLesson` and quiz submission and is idempotent (unique `user+course`
  index), so ordering doesn't matter. Certificates are immutable snapshots
  (lesson counts + quiz score at issue time).
- **Verification is public** by serial (`/certificates/:serial`) — the page is
  designed for sharing/printing; serials are random (4 bytes hex) rather than
  sequential so they can't be enumerated.
- Quiz/review/certificate routes apply `authenticate` **per-route**, never via
  `router.use`, because multiple routers share the `/courses` mount and
  router-level auth would gate unrelated public paths.

## Admin moderation (Phase 7)

- **Course lifecycle stays four-state**: `draft → pending_review → published`
  (approve) or `pending_review → draft` (reject with a required note).
  Rejections store `reviewNote` on the course; it is cleared on approval and
  exposed only on owner views (public detail omits it).
- **Instructor applications are a separate collection** with `reviewNote` for
  rejection reasons. Approving flips `User.role` to `instructor` without
  touching sessions (the authenticator re-reads role per request). Rejected
  applicants may re-apply, which resets the application to `pending`.
- **User administration safeguards**: admins cannot modify their own
  role/status (`CANNOT_MODIFY_SELF`), and a defensive `LAST_ADMIN` check
  prevents demoting/suspending the final active admin (normally unreachable
  through the API because the caller is always an active admin). Suspension
  clears `refreshSessions` so existing sessions die on the next refresh.
- **Search inputs are regex-escaped** before building case-insensitive
  matches, so `.`/`(`/etc. in user input are literals (no ReDoS/injection).
- **`/admin` uses router-level auth**: unlike `/courses`, no public paths share
  that mount, so gating the whole router is safe and simpler.

## Payments & media (Phase 8)

- **Paid courses are gated at enrollment.** `POST /enrollments` rejects paid
  courses with `402 PAYMENT_REQUIRED`; the only path to an enrollment is a paid
  order. Free courses continue to enroll directly, so the MVP demo flow does not
  require checkout.
- **Payment provider is behind an interface.** `order.service.ts` defines a
  `PaymentProvider` contract and ships a deterministic `mockProvider` that
  returns a synthetic reference immediately. A real provider (Stripe/Razorpay)
  implements `charge` and confirms via webhooks; the order state machine
  (`pending → paid | failed`) and the enrollment-on-payment hook stay the same.
- **Order idempotency**: one pending order per `(user, course)` is reused on
  repeat clicks, and paying an already-paid order is a no-op. Enrollment
  activation is shared with free enrollment (`activateEnrollmentRecord`).
- **Uploads are local-disk development storage.** `uploads/` is gitignored and
  served statically by Express at `/uploads`. Production swaps this for object
  storage behind the same URL contract — the API and DB only ever store URL
  strings, never binaries.
- **Validation is two-layered for uploads**: multer's global byte ceiling
  catches oversize requests early, then per-MIME limits are enforced after the
  file is written (unlinking rejected files). Filenames are UUIDs with a
  sanitized extension, so user input never reaches the filesystem.
- **Authoring UI covers the full draft lifecycle** (`/instructor/courses/new`,
  `/instructor/courses/[id]`): metadata + thumbnail upload, section/lesson
  CRUD, submit-for-review, and inline display of admin `reviewNote`. Lesson
  authoring is type-aware (article content, video/PDF upload or URL, external
  link), and the course duration is recalculated server-side.
