# Deployment Guide — Shared Todo App

Everything needed to deploy from scratch to Railway, plus every issue encountered and how it was fixed.

---

## Prerequisites

| Tool | Install |
|------|---------|
| Node.js 20+ | https://nodejs.org |
| Railway CLI | `npm i -g @railway/cli` |
| Git | https://git-scm.com |

---

## First-Time Deployment

### 1. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
# Create repo on GitHub, then:
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Add `.claude/` to `.gitignore` to avoid pushing private memory files.

---

### 2. Create Railway Project

```bash
railway login          # opens browser
railway init           # creates a new project
railway link           # links current directory to the project
```

---

### 3. Add PostgreSQL

```bash
railway add --database postgres
```

Railway automatically injects `DATABASE_URL` into all services in the project — no manual wiring needed.

---

### 4. Create the Two Services

In the Railway dashboard, create two services manually:
- `shared-todo-backend`
- `shared-todo-frontend`

Then get their IDs:

```bash
railway status --json
```

Look for `"serviceId"` under each service name.

---

### 5. Set Environment Variables

**Backend service:**

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | `openssl rand -base64 48` (run this locally) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | `https://shared-todo-frontend-production.up.railway.app` |

```bash
railway variable set JWT_SECRET=<value> --service <backend-id>
railway variable set NODE_ENV=production --service <backend-id>
railway variable set FRONTEND_URL=https://shared-todo-frontend-production.up.railway.app --service <backend-id>
```

**Frontend service:**

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | `https://shared-todo-backend-production.up.railway.app` |

```bash
railway variable set VITE_API_URL=https://shared-todo-backend-production.up.railway.app --service <frontend-id>
```

> **Critical:** `VITE_*` variables are baked into the JavaScript bundle at build time by Vite. They must be set **before** the build runs. Setting them after a successful build has no effect — you must redeploy.

---

### 6. Run the Database Migration

After the backend is running, apply the schema against the Railway Postgres URL:

```bash
# Get the public Postgres URL from Railway dashboard or:
railway variable list --service <postgres-id> --json | grep DATABASE_PUBLIC_URL
```

Then run the migration once:

```bash
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: '<DATABASE_PUBLIC_URL>', ssl: { rejectUnauthorized: false } });
pool.query(fs.readFileSync('backend/migrations/001_init.sql', 'utf8')).then(() => { console.log('done'); pool.end(); });
"
```

---

### 7. Deploy Both Services

Always deploy from the **repo root** using `--path-as-root` with the subdirectory path:

```bash
# Backend
railway up backend --path-as-root --service <backend-id> --detach -m "your message"

# Frontend
railway up frontend --path-as-root --service <frontend-id> --detach -m "your message"
```

> **Never** run `railway up` from inside `backend/` or `frontend/` without `--path-as-root`.
> Without the flag, Railway uploads the full git root regardless of the working directory,
> and the root `package.json`'s `start` script runs `concurrently` on both services, causing a 502.

---

## Redeploying (Day-to-Day)

```bash
git add .
git commit -m "description"
git push

# Then redeploy whichever service changed:
railway up backend  --path-as-root --service <backend-id>  --detach -m "description"
railway up frontend --path-as-root --service <frontend-id> --detach -m "description"
```

### Automatic Deploys (Optional)

To skip the manual `railway up` on every push, connect each service to GitHub in the Railway dashboard:

1. Service → **Settings** → **Source** → connect `Maor765/shared-todo-app`
2. Set **Root Directory** to `backend` (or `frontend`)
3. Every push to `main` will auto-deploy with the correct build context

---

## Live URLs

| | URL |
|-|-----|
| Frontend | https://shared-todo-frontend-production.up.railway.app |
| Backend | https://shared-todo-backend-production.up.railway.app |
| Health check | https://shared-todo-backend-production.up.railway.app/api/health |

---

## Issues Encountered

### Issue 1 — Root `package.json` had objects nested inside `scripts`

**Error (Railway build log):**
```
Error reading package.json as JSON
invalid type: map, expected a string at line 46 column 20
```

**Cause:**
`scripts-info`, `keywords`, `author`, `license`, and `engines` were accidentally nested *inside* the `"scripts"` block instead of at the top level of the JSON. nixpacks (Railway's build system) validates that every value in `scripts` is a string and fails on objects or arrays.

**Fix:**
Restructured `package.json` so `scripts` contains only string values. Moved `engines` to top-level and removed `scripts-info`.

---

### Issue 2 — Backend TypeScript build error: `rowCount` type mismatch

**Error:**
```
src/db.ts(21,5): error TS2322:
Type 'null' is not assignable to type 'number'.
```

**Cause:**
The `pg` library types `QueryResult.rowCount` as `number | null`, but the `query()` wrapper declared the return type as `{ rowCount: number }`. This passed locally but failed under Railway's stricter TypeScript build.

**Fix:**
```typescript
// Before
return result;

// After
return { rows: result.rows, rowCount: result.rowCount ?? 0 };
```

---

### Issue 3 — Both services building from the root `package.json`

**Symptom:**
Frontend build log showed:
```
> shared-todo-app@1.0.0 build
> npm run build:backend && npm run build:frontend
```
…instead of just `vite build`.

**Cause:**
`railway up` without `--path-as-root` uploads the entire git repository root. The `railway.toml` service names (`"backend"`, `"frontend"`) didn't match the actual Railway service names (`"shared-todo-backend"`, `"shared-todo-frontend"`), so Railway ignored `railway.toml` and built from the root.

**Fix:**
```bash
railway up backend  --path-as-root --service <id> --detach
railway up frontend --path-as-root --service <id> --detach
```

---

### Issue 4 — Frontend 502 after successful build (first deploy)

**Symptom:**
Frontend service status showed SUCCESS but the URL returned HTTP 502.

**Cause:**
The `frontend/Dockerfile` was left over from local dev and ran:
```dockerfile
CMD ["npm", "run", "dev", "--", "--host", "--port", "4001"]
```
This started `vite dev` on a hardcoded port instead of serving the built `dist/` on Railway's dynamic `$PORT`.

**Fix:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
RUN npm install -g serve
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
```

---

### Issue 5 — Frontend API calls pointed to `localhost` instead of the backend

**Symptom:**
In production, all API calls went to `http://localhost:4000/api/...` instead of the Railway backend URL.

**Cause:**
`VITE_API_URL` is baked into the bundle at build time. In the original Dockerfile there was no `ARG VITE_API_URL` line, so the environment variable was not available to `vite build`. Vite substituted it with an empty string and the Axios client fell back to the relative URL `localhost:4000`.

**Fix:**
Added `ARG` + `ENV` to the Dockerfile so the build-time variable is passed through Docker's build args into the Vite build:
```dockerfile
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build
```
And set `VITE_API_URL` in Railway's service variables before deploying.

---

### Issue 6 — Vite dev server returns 504 for TanStack Router

**Symptom:**
After installing `@tanstack/react-router`, the local dev server returned:
```
http://localhost:4001/node_modules/.vite/deps/@tanstack_react-router.js?v=...
504
```

**Cause:**
Vite lazily pre-bundles dependencies on first request. TanStack Router's ESM bundle is large enough that it timed out during Vite's on-demand esbuild optimisation step.

**Fix:**
Force Vite to eagerly pre-bundle it at startup in `vite.config.ts`:
```typescript
optimizeDeps: {
  include: ['@tanstack/react-router', '@tanstack/react-query'],
},
```
Then clear the stale cache:
```bash
rm -rf node_modules/.vite
```

---

### Issue 7 — Sign-in appeared to do nothing (redirect loop)

**Symptom:**
Submitting the login form seemed to do nothing. The user remained on `/login`.

**Cause:**
A React state update race condition. After `await auth.login()` resolved, `navigate({ to: '/' })` was called immediately. But React hadn't committed the `setUser(newUser)` state update yet. `AppShell` mounted, its `useEffect` checked `auth.user === null` (still the old value), and redirected straight back to `/login`.

**Fix:**
Removed the immediate `navigate()` call from the submit handler. Instead, a `useEffect` in `LoginPage` (and `RegisterPage`) watches `auth.user` and navigates only after React has committed the state:
```typescript
useEffect(() => {
  if (auth.user) navigate({ to: '/' });
}, [auth.user]);
```

---

### Issue 8 — 502 on every redeploy (forgot `--path-as-root`)

**Symptom:**
Frontend redeployments occasionally returned 502. Logs showed both backend *and* frontend processes starting inside the same container:
```
[0] > shared-todo-backend@1.0.0 start
[0] > node dist/index.js
[1] > shared-todo-frontend@1.0.0 preview
[1] > vite preview
```
The backend crashed (no database on localhost) and the frontend ran on port 4173 instead of `$PORT`.

**Cause:**
`railway up` was run from inside `frontend/` without `--path-as-root`. Railway uploaded the full git root, which contains the root `package.json`. Its `start` script is:
```json
"start": "concurrently \"npm run start:backend\" \"npm run start:frontend\""
```
This started both services in the same container.

**Fix:**
Always run from the **repo root** with an explicit path and the flag:
```bash
railway up frontend --path-as-root --service <frontend-id> --detach
```

---

## Quick Reference

```bash
# Check what's running
railway logs --service <id> --lines 50

# Check environment variables
railway variable list --service <id> --json

# Check deployment status
railway status --json
```
