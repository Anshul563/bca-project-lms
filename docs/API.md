# REST API — `/api/v1`

Original contract lives here; every endpoint below is implemented against the
request/response schemas in `@lms/shared`. The doc is extended per phase, and
machine-readable OpenAPI will be published at `/api/v1/docs`.

## Conventions

- **Envelope**: `{ success: true, data, message?, meta? }` |
  `{ success: false, message, errors?: [{ code, message, field? }] }`
- **Validation failures**: HTTP 422 with per-field `errors[]`.
- **Pagination**: `?page=1&limit=12`; responses attach `meta`:
  `{ page, limit, total, totalPages, hasNext, hasPrev }`.
- **Auth**: `Authorization: Bearer <accessToken>`; refresh happens through an
  httpOnly `lms_refresh_token` cookie at `/auth/refresh`.
- **Cookies**: `Secure` in production, `HttpOnly`, sameSite `lax`,
  path `/` (site root, so the Next.js proxy and RSC session checks can read
  it; the API validates it on every use).

## Endpoint groups (implemented vs planned)

| Group | Routes | Phase |
|---|---|---|
| Health | `GET /health` | 1 ✅ |
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/session`, `/auth/me`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/auth/apply-instructor` | 2 ✅ |
| Users (self) | `GET/PATCH /users/me` | 2 ✅ |
| Categories | `GET /categories`, `GET /categories/:id` (public); create/update/delete (admin) | 3 ✅ |
| Courses | `GET /courses`, `GET /courses/:slug` (public); instructor CRUD, sections/lessons, reorder, publish flow | 3 ✅ |
| Enrollment | `POST /enrollments`, `GET /enrollments/my`, `DELETE /enrollments/:id` | 4 ✅ |
| Progress | `GET /progress/courses/:courseId`, `POST /progress/courses/:courseId/lessons/:lessonId/complete` | 4 ✅ |
| Lesson content | `GET /courses/:slug/lessons/:lessonId` | 4 ✅ |
| Quizzes | `/courses/:id/quizzes`, attempts/grading | 5 |
| Reviews | `/courses/:id/reviews` | 6 |
| Certificates | `/certificates`, verify | 6 |
| Notifications | `/notifications` | 7 |
| Admin | `/admin/users`, `/admin/instructor-applications`, `/admin/courses/:id/moderation`, `/admin/categories`, `/admin/audit-log`, `/admin/analytics` | 7 |

---

## Implemented endpoints

### `GET /health`

Liveness/readiness. **Auth**: none.

`200 { success, data: { status: "ok", env, uptimeSeconds, database: "connected" } }`

`503` when the database connection is not ready (`status: "degraded"`).

---

## Auth (Phase 2 — implemented)

All bodies are validated against `@lms/shared` Zod schemas. Rate-limited
endpoints (`register`, `login`, `verify-email`, `forgot-password`,
`reset-password`) use a stricter, failure-counting limiter.

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/auth/register` | — | Creates a student; returns `{ user, accessToken }` + refresh cookie; sends verification email |
| POST | `/auth/login` | — | Returns `{ user, accessToken }` + refresh cookie; locks account after repeated failures (429) |
| POST | `/auth/refresh` | cookie | Rotates the refresh session; old token becomes invalid (replay → 401) |
| POST | `/auth/logout` | cookie | Revokes the presented session |
| GET | `/auth/session` | cookie | **Read-only** validation for Next RSC (`{ authenticated, role? }`); never rotates |
| GET | `/auth/me` | Bearer | Current profile |
| POST | `/auth/verify-email` | — | `{ token }` |
| POST | `/auth/forgot-password` | — | Always 200 (no account enumeration) |
| POST | `/auth/reset-password` | — | `{ token, password }`; revokes all sessions |
| POST | `/auth/change-password` | Bearer | `{ currentPassword, newPassword }`; keeps only the caller's session |
| POST | `/auth/apply-instructor` | Bearer | Students only; creates a pending `InstructorApplication` |

## Users (Phase 2 — implemented)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/users/me` | Bearer | Current profile |
| PATCH | `/users/me` | Bearer | `{ name?, bio? }` |

## Categories (Phase 3 — implemented)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/categories` | — | Sorted by name; includes published `courseCount` per category |
| GET | `/categories/:id` | — | Single active category |
| POST | `/categories` | admin | `{ name, slug?, description?, parent? }`; slug auto-derived, uniqueness enforced (409 `SLUG_TAKEN`) |
| PATCH | `/categories/:id` | admin | Partial update |
| DELETE | `/categories/:id` | admin | Soft delete; published courses simply lose the link |

## Courses (Phase 3 — implemented)

### Public

`GET /courses` — catalog with filters. **Auth**: none (optional bearer lets
owners preview their drafts).

Query: `?page&limit&search&category=<slug>&level&language&priceType=free|paid&minRating&sort=newest|popular|rating|price_asc|price_desc`

`200 { success, data: PublicCourseSummary[], meta }` — summaries include
category, instructor name and counters; text search covers
title/subtitle/tags.

`GET /courses/:slug` — full detail with curriculum. Drafts return `404`
except to their owner (or admins) via the optional bearer token.

### Instructor

All require `Authorization: Bearer` + role `instructor` (admins allowed).

| Method | Path | Notes |
|---|---|---|
| POST | `/courses` | Create draft; slug auto-derived from title |
| GET | `/courses/mine/all` | Own courses incl. unpublished |
| GET | `/courses/id/:id` | Owner-only management view (full sections/lessons) |
| PATCH | `/courses/id/:id` | Partial update |
| DELETE | `/courses/id/:id` | Soft delete |
| POST | `/courses/id/:id/submit-for-review` | `draft|archived → pending_review`; requires ≥1 section and ≥1 lesson (400 `CURRICULUM_INCOMPLETE`) |
| POST | `/courses/id/:courseId/sections` | Create section |
| PATCH/DELETE | `/courses/id/:courseId/sections/:sectionId` | Delete cascades to its lessons |
| PUT | `/courses/id/:courseId/sections/reorder` | `{ orderedIds }` must be a full permutation (400 `INVALID_ORDER`) |
| POST | `/courses/id/:courseId/sections/:sectionId/lessons` | Create lesson (`video/article/pdf/link`, free-preview flag, attachments) |
| PATCH/DELETE | `/courses/id/:courseId/lessons/:lessonId` | Course duration recalculated on every change |
| PUT | `/courses/id/:courseId/sections/:sectionId/lessons/reorder` | `{ orderedIds }` permutation |

Ownership is enforced on every mutation (`403 NOT_COURSE_OWNER`).

## Enrollments (Phase 4 — implemented)

| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/enrollments` | Bearer | `{ courseId }`; course must be published (404 otherwise); re-enrolls cancelled records instead of erroring |
| GET | `/enrollments/my` | Bearer | `?status=active|completed|cancelled`; newest first, includes course summary |
| DELETE | `/enrollments/:id` | Bearer | Owner-only cancel; decrements the course counter |

Errors: `409 ALREADY_ENROLLED`, `409 INVALID_STATUS` (cancelling a
non-active enrollment), `422` invalid courseId.

> Payment hook: paid courses will create an `Order` and enroll on payment
> success (Phase 8); enrollments are currently mock-paid and active
> immediately.

