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
  path `/api/v1/auth`.

## Endpoint groups (implemented vs planned)

| Group | Routes | Phase |
|---|---|---|
| Health | `GET /health` | 1 |
| Auth | `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/verify-email`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/change-password`, `/auth/apply-instructor` | 2 |
| Users (admin/self) | `/users`, `/users/:id`, `/users/:id/role`, `/users/me/profile` | 2 |
| Categories | `/categories` CRUD | 3 |
| Courses | `/courses` (public list/detail), instructor CRUD, sections/lessons, publish flow | 3 |
| Enrollment | `/enrollments` | 4 |
| Progress | `/progress/:courseId/lessons/:lessonId/complete` etc. | 4 |
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
