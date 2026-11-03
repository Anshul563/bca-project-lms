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
  is replaced by a small in-house body sanitizer** plus
  `mongoose.set("sanitizeFilter", true)` (cover both body and query paths).
  Route params are whitelisted schemas, never merged with user operators.
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

## Things deliberately NOT done (yet)

- Real email sending — captured/logged until phase 8/9.
- Stripe/Razorpay integration — interface stub only.
- Redis — optional store adapter documented, not installed.
