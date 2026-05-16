# Deployment Log — Shared Todo App

This document covers the full Railway deployment process, every issue encountered, and how each was resolved.

---

## What Needed to Be Done

1. Initialize a git repository and push to GitHub
2. Install the Railway CLI and log in
3. Create a Railway project with two services (backend + frontend)
4. Add a PostgreSQL database
5. Set environment variables on each service
6. Deploy both services
7. Run the database migration SQL

---

## Step-by-Step Process

### 1. GitHub Repository

- Initialized git in the project root
- Added `.claude/` to `.gitignore` (private memory files)
- Made an initial commit
- Used the GitHub MCP plugin to create the repo `Maor765/shared-todo-app`
- Pushed with `git push -u origin main`

### 2. Railway CLI

- Installed via `npm i -g @railway/cli`
- Authenticated with `railway login` (opens browser)
- Linked to the Railway project: `railway link --project <id> --environment <id>`

### 3. PostgreSQL Database

- Added via `railway add --database postgres`
- DATABASE_URL is automatically available inside the project

### 4. Environment Variables

Set on the **backend** service:
```
JWT_SECRET    = <48-byte random base64 string>
NODE_ENV      = production
DATABASE_URL  = <from Postgres service>
FRONTEND_URL  = https://shared-todo-frontend-production.up.railway.app
```

Set on the **frontend** service:
```
VITE_API_URL = https://shared-todo-backend-production.up.railway.app
```

> Note: `VITE_*` variables are baked at build time by Vite. They must be set before the build runs.

### 5. Database Migration

After the backend service was running, the migration was applied directly against the Railway Postgres public URL:

```js
const pool = new Pool({
  connectionString: 'postgresql://postgres:<pass>@<host>:<port>/railway',
  ssl: { rejectUnauthorized: false }
});
const sql = fs.readFileSync('backend/migrations/001_init.sql', 'utf8');
await pool.query(sql);
```

### 6. Deployment Commands

```bash
# Backend (deploy only the backend subdirectory as root)
railway up backend --path-as-root --service <backend-id> --detach

# Frontend (deploy only the frontend subdirectory as root)
railway up frontend --path-as-root --service <frontend-id> --detach
```

---

## Issues Encountered

### Issue 1 — Root `package.json` had nested objects inside `scripts`

**Error:**
```
Error reading package.json as JSON
invalid type: map, expected a string at line 46 column 20
```

**Cause:**  
The root `package.json` had a `"scripts-info"` object, a `"keywords"` array, `"author"`, `"license"`, and `"engines"` accidentally nested *inside* the `"scripts"` block instead of at the top level of the JSON. nixpacks (Railway's build system) correctly rejected this as invalid.

**Fix:**  
Restructured the root `package.json` so that `scripts` only contains string values. Moved `engines` to the top level and removed the non-standard `scripts-info` block.

---

### Issue 2 — Backend TypeScript build error: `rowCount` null mismatch

**Error:**
```
src/db.ts(21,5): error TS2322: Type 'QueryResult<any>' is not assignable
to type '{ rows: T[]; rowCount: number; }'.
  Type 'null' is not assignable to type 'number'.
```

**Cause:**  
The `pg` library types `QueryResult.rowCount` as `number | null`, but the `query()` wrapper function's return type declared it as `number`. Locally this passed because the Railway build uses a slightly different TypeScript strictness context.

**Fix:**
```typescript
// Before
return result;

// After
return { rows: result.rows, rowCount: result.rowCount ?? 0 };
```

---

### Issue 3 — Both services building from the root `package.json` instead of their subdirectories

**Error:**  
The frontend service was running:
```
> shared-todo-app@1.0.0 build
> npm run build:backend && npm run build:frontend
```
…instead of just `vite build`.

**Cause:**  
`railway up` without `--path-as-root` uploads the entire git repository root regardless of which subdirectory you run it from. The service's `rootDirectory` was not configured in Railway (the `railway.toml` service names `"backend"` / `"frontend"` didn't match the actual Railway service names `"shared-todo-backend"` / `"shared-todo-frontend"`), so Railway built from the root.

**Fix:**  
Used the `--path-as-root` flag to upload only the relevant subdirectory as the archive root:
```bash
railway up backend --path-as-root --service <id> --detach
railway up frontend --path-as-root --service <id> --detach
```

Long-term fix: in the Railway dashboard, connect each service to the GitHub repo and set `Root Directory` to `backend` / `frontend`. Then every `git push` deploys automatically with the correct context.

---

### Issue 4 — Frontend returning 502 after successful build

**Error:**  
Frontend service deployed with status SUCCESS but returned HTTP 502.

**Cause:**  
The `frontend/Dockerfile` was picked up instead of nixpacks (a Dockerfile takes priority). The Dockerfile was set up for local development:
```dockerfile
CMD ["npm", "run", "dev", "--", "--host", "--port", "4001"]
```
It ran `vite dev` on a hardcoded port `4001` instead of serving the built `dist/` on Railway's dynamic `$PORT`.

**Fix:**  
Updated the Dockerfile to build the app and serve the static output on `$PORT`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
RUN npm install -g serve
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
```

---

## Live URLs

| Service  | URL |
|----------|-----|
| Frontend | https://shared-todo-frontend-production.up.railway.app |
| Backend  | https://shared-todo-backend-production.up.railway.app |
| Health   | https://shared-todo-backend-production.up.railway.app/api/health |

---

## Future Deploys

Currently deployments are triggered manually via `railway up`. To enable automatic deploys on every `git push`:

1. Go to [railway.com](https://railway.com) → your project
2. Click the **backend** service → **Settings** → **Source** → connect `Maor765/shared-todo-app`, set **Root Directory** to `backend`
3. Repeat for **frontend** service with Root Directory `frontend`

After that, every push to `main` will auto-deploy both services with the correct build context.
