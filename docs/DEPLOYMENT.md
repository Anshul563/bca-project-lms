# Deployment guide

This document covers running the LMS in a production-like environment with
Docker Compose. The stack is three containers: **MongoDB**, the **API**
(Express), and the **web app** (Next.js standalone server).

## Topology

```
Browser
  │  HTTPS
  ▼
Reverse proxy (Caddy / nginx / cloud LB)
  ├── /            → web:3000   (Next.js)
  └── /api, /uploads → api:5001 (Express + static uploads)
        │
        └── mongodb:27017
```

Both containers are stateless except for two volumes:

| Volume | Purpose |
|---|---|
| `mongo-data` | MongoDB data directory |
| `api-uploads` | Locally stored media (thumbnails, PDFs, videos) |

## 1. Prerequisites

- Docker Engine 24+ with Compose v2
- Two strong JWT secrets (`openssl rand -base64 48`)
- A hostname with TLS if exposing the app publicly

## 2. Configure

Create a `.env` file in the repository root (Compose reads it automatically).
Only variables listed here are required; everything else has defaults.

```bash
cat > .env <<'EOF'
JWT_ACCESS_SECRET=<paste 48-byte random secret>
JWT_REFRESH_SECRET=<paste a different 48-byte random secret>

# Public URLs (must match what browsers use)
WEB_URL=https://lms.example.com
CORS_ORIGINS=https://lms.example.com
NEXT_PUBLIC_API_URL=https://lms.example.com
NEXT_PUBLIC_SITE_URL=https://lms.example.com

# TLS termination: production cookies require HTTPS
COOKIE_SECURE=true
COOKIE_DOMAIN=.example.com
EOF
```

Notes:

- `NEXT_PUBLIC_*` values are **baked into the web image** at build time. Rebuild
  the web image after changing them.
- `CORS_ORIGINS` is a comma-separated allow-list and must include the web origin.
- For local HTTP smoke tests set `COOKIE_SECURE=false`; never do that on a public
  deployment.
- Startup fails if `NODE_ENV=production` and the JWT secrets are short or still
  contain `replace`/`change`.

## 3. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

Check status and health:

```bash
docker compose -f docker-compose.prod.yml ps
curl -fsS http://localhost:5001/api/v1/health
curl -fsSI http://localhost:3000/ | head -20
```

The API health check returns `200` with `{ status: "ok", database: "connected" }`
when Mongo is reachable, and `503` with `degraded` otherwise.

## 4. Seed an initial admin

The seed is idempotent and safe to re-run:

```bash
docker compose -f docker-compose.prod.yml exec api \
  node apps/api/dist/scripts/seed.js
```

The seeded demo passwords are documented in the README and are **not suitable
for a public deployment** — sign in as the admin, change the passwords, and
create real instructor accounts (or remove the demo data).

## 5. Reverse proxy

Keep the API on the same origin as the web app so refresh cookies are
first-party. Example Caddyfile:

```caddy
lms.example.com {
  encode zstd gzip

  handle /api/* {
    reverse_proxy api:5001
  }
  handle /uploads/* {
    reverse_proxy api:5001
  }
  handle {
    reverse_proxy web:3000
  }
}
```

nginx equivalent (inside the same Docker network):

```nginx
server {
  listen 443 ssl http2;
  server_name lms.example.com;

  client_max_body_size 210m;   # video uploads (API enforces exact limits)

  location /api/      { proxy_pass http://api:5001; include proxy_params; }
  location /uploads/  { proxy_pass http://api:5001; include proxy_params; }
  location /          { proxy_pass http://web:3000;  include proxy_params; }
}
```

Do not publish Mongo (`27017`) on a public interface. It is intentionally
unexposed in `docker-compose.prod.yml`.

## 6. Persistence and backups

```bash
# Dump
docker compose -f docker-compose.prod.yml exec mongodb \
  mongodump --archive=/tmp/lms.archive --gzip
docker compose -f docker-compose.prod.yml cp mongodb:/tmp/lms.archive ./backups/lms-$(date +%F).archive.gz

# Restore
cat ./backups/lms-2026-01-01.archive.gz | \
  docker compose -f docker-compose.prod.yml exec -T mongodb \
  mongorestore --archive --gzip --drop
```

Back up the `api-uploads` volume alongside the database (e.g. `docker run --rm
-v lms-prod_api-uploads:/data -v "$PWD/backups:/backup" alpine tar czf
/backup/uploads.tgz -C /data .`).

## 7. Operations

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api web` (pino
  structured logs on the API; request IDs are returned as `X-Request-Id`).
- **Shutdown**: the API handles `SIGTERM`, stops accepting connections, closes
  Mongoose, and force-exits after 10 s.
- **Scaling**: the API is stateless, but local uploads require a shared volume
  or a single instance. For multi-instance deployments implement the
  object-storage adapter behind `apps/api/src/config/uploads.ts` (URL contract
  stays the same) and use a managed MongoDB.
- **Rate limits**: tune `RATE_LIMIT_GLOBAL_MAX` and `RATE_LIMIT_AUTH_MAX`
  (requests per 15 minutes) per environment; defaults are 300 and 20.

## 8. Security checklist

- [ ] TLS terminated in front of both containers
- [ ] `COOKIE_SECURE=true`, `COOKIE_DOMAIN` set to the site domain
- [ ] 32+ character, unique JWT secrets stored outside the repo
- [ ] Mongo not published publicly; authentication enabled for shared clusters
- [ ] Demo accounts removed or passwords rotated
- [ ] `CORS_ORIGINS` limited to real origins
- [ ] Upload volume backed up and size-monitored
- [ ] Dependency upgrades reviewed (run `pnpm audit` / Dependabot)
- [ ] Next.js security advisory addressed when prompted by the build

## 9. Upgrading

```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

Migrations are not needed for this schema; Mongoose creates indexes on boot.
Re-run the seed only when you want the demo content back.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| API exits immediately with "Invalid environment configuration" | Missing `MONGO_URI` or JWT secrets |
| API exits with "weak JWT secrets" | `NODE_ENV=production` with short/default secrets |
| Web shows API network errors | `NEXT_PUBLIC_API_URL` was wrong at image build time; rebuild web |
| Login succeeds but sessions drop | Cookies are `Secure` while the site is served over HTTP |
| Uploads disappear after redeploy | `api-uploads` volume not mounted/persisted |
| 413 from the proxy | Raise `client_max_body_size` to ≥ 210 MB |
