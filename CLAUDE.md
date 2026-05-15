# Shared Todo App — CLAUDE.md

Full-stack rewrite of a monolithic React JSX prototype into a production app.
The original design (inline styles, 390px phone shell, component patterns) lives in `shared-todo-app.jsx` and is the source of truth for all UI decisions.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 16 |
| ORM/Query | `pg` (raw SQL, no ORM) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Real-time | Socket.io |
| Frontend | React 18 + Vite + TypeScript |
| Routing | react-router-dom v6 |
| HTTP client | Axios |
| Deploy | Railway (2 services + PostgreSQL plugin) |
| Local dev | docker-compose |

---

## Design System

All inline styles — no Tailwind, no CSS-in-JS library.

| Token | Value |
|-------|-------|
| Background | `#F5F2ED` (warm off-white) |
| Body BG | `#f0ede8` (desktop surround) |
| Primary blue | `#178AE8` |
| Text dark | `#1a1a1a` |
| Text muted | `#888`, `#aaa` |
| Border | `0.5px solid #e8e4de` |
| Success | `#639922` |
| Warning | `#BA7517` |
| Danger | `#A32D2D` |
| Shell width | `390px`, `borderRadius: 32` |
| Heading font | DM Serif Display (Google Fonts) |
| Body font | DM Sans (Google Fonts) |

---

## Directory Structure

```
shared-todo-app/
├── CLAUDE.md
├── README.md
├── railway.toml
├── docker-compose.yml
├── .env.example
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   ├── migrations/
│   │   └── 001_init.sql          ← all CREATE TABLE statements
│   └── src/
│       ├── index.ts              ← Express + Socket.io entry point
│       ├── db.ts                 ← pg Pool singleton + query helper
│       ├── types.ts              ← all TypeScript interfaces
│       ├── middleware/
│       │   ├── auth.ts           ← JWT verify, attaches req.user
│       │   └── errorHandler.ts   ← global Express error handler
│       ├── routes/
│       │   ├── auth.routes.ts
│       │   ├── workspace.routes.ts
│       │   ├── lists.routes.ts
│       │   ├── tasks.routes.ts
│       │   ├── sublists.routes.ts
│       │   ├── members.routes.ts
│       │   └── notifications.routes.ts
│       ├── controllers/
│       │   ├── auth.controller.ts
│       │   ├── workspace.controller.ts
│       │   ├── lists.controller.ts
│       │   ├── tasks.controller.ts
│       │   ├── sublists.controller.ts
│       │   ├── members.controller.ts
│       │   └── notifications.controller.ts
│       ├── services/
│       │   └── notifications.service.ts  ← auto-generates notifications
│       └── sockets/
│           └── socket.handler.ts         ← Socket.io event handlers
│
└── frontend/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── index.html                ← Google Fonts link here
    ├── Dockerfile
    └── src/
        ├── main.tsx              ← React root, wraps with providers
        ├── App.tsx               ← Route definitions + ProtectedRoute
        ├── index.css             ← reset + font-family defaults
        ├── types.ts              ← mirrors backend types.ts (no DB-only fields)
        ├── api/
        │   ├── client.ts         ← Axios instance with JWT interceptor
        │   ├── auth.api.ts
        │   ├── workspace.api.ts
        │   ├── lists.api.ts
        │   ├── tasks.api.ts
        │   ├── sublists.api.ts
        │   ├── members.api.ts
        │   └── notifications.api.ts
        ├── context/
        │   ├── AuthContext.tsx   ← user/token/workspace state
        │   └── SocketContext.tsx ← socket.io-client instance
        ├── hooks/
        │   ├── useAuth.ts
        │   ├── useSocket.ts      ← subscribe to socket events
        │   ├── useLists.ts       ← fetches lists, applies socket updates
        │   └── useNotifications.ts
        ├── pages/
        │   ├── LoginPage.tsx
        │   ├── RegisterPage.tsx
        │   └── AppShell.tsx      ← 390px phone shell + tab routing
        └── components/
            ├── ui/
            │   ├── Avatar.tsx
            │   ├── Badge.tsx
            │   ├── ProgressBar.tsx
            │   ├── CheckCircle.tsx
            │   ├── NavBar.tsx
            │   ├── TopBar.tsx
            │   ├── IconBtn.tsx
            │   ├── Sheet.tsx
            │   └── FilterChips.tsx
            ├── Dashboard.tsx
            ├── Lists.tsx
            ├── ListDetail.tsx
            ├── TaskDetailSheet.tsx
            ├── Notifications.tsx
            └── Team.tsx
```

---

## Database Schema

8 tables. All PKs are UUIDs via `gen_random_uuid()`.

```sql
users              (id, email, password_hash, name, initials, color, text_color, role, status, created_at)
workspaces         (id, name, owner_id→users, created_at)
workspace_members  (workspace_id→workspaces, user_id→users, role, joined_at)  PK: (workspace_id, user_id)
lists              (id, workspace_id→workspaces, name, emoji, shared, created_by→users, created_at)
list_members       (list_id→lists, user_id→users)  PK: (list_id, user_id)
sublists           (id, list_id→lists, name, created_at)
tasks              (id, list_id→lists, sublist_id→sublists NULL, text, done, assignee_id→users NULL, due DATE NULL, notes, created_by→users, created_at, updated_at)
notifications      (id, user_id→users, type, text, context, read, created_at)
```

**Notification types:** `done` | `assign` | `due` | `member` | `create`

---

## TypeScript Interfaces (shared)

```typescript
interface PublicUser {
  id: string; email: string; name: string; initials: string;
  color: string; text_color: string; role: 'admin'|'member'; status: 'active'|'away';
}

interface AuthResponse {
  token: string;
  user: PublicUser;
  workspace: { id: string; name: string };
}

interface DBTask {
  id: string; list_id: string; sublist_id: string|null;
  text: string; done: boolean; assignee_id: string|null;
  due: string|null; notes: string; created_by: string;
  created_at: string; updated_at: string;
}

interface DBSublist { id: string; list_id: string; name: string; created_at: string; }

interface DBList {
  id: string; workspace_id: string; name: string;
  emoji: string; shared: boolean; created_by: string; created_at: string;
}

interface ListWithMembers extends DBList { members: PublicUser[]; }

interface ListDetail extends ListWithMembers {
  sublists: DBSublist[];
  tasks: DBTask[];
}

interface DBNotification {
  id: string; user_id: string;
  type: 'done'|'assign'|'due'|'member'|'create';
  text: string; context: string; read: boolean; created_at: string;
}

interface JWTPayload {
  sub: string; workspace_id: string; role: 'admin'|'member'; iat: number; exp: number;
}
```

---

## API Endpoints

All protected routes require `Authorization: Bearer <token>`.

### Auth (public)
```
POST   /api/auth/register    {email, password, name, workspace_name} → AuthResponse
POST   /api/auth/login       {email, password} → AuthResponse
GET    /api/auth/me          → {user, workspace}
GET    /api/health           → {status:'ok'}
```

### Workspace (JWT)
```
GET    /api/workspace                             → DBWorkspace
PATCH  /api/workspace                (admin)      → DBWorkspace
GET    /api/workspace/members                     → PublicUser[]
POST   /api/workspace/members/invite (admin)      {email, role} → {message}
PATCH  /api/workspace/members/:userId/status      {status} → PublicUser
DELETE /api/workspace/members/:userId (admin)     → {message}
```

### Lists (JWT)
```
GET    /api/lists             → ListWithMembers[]  (shared OR is member)
POST   /api/lists             {name, emoji, shared} → ListWithMembers
GET    /api/lists/:id         → ListDetail (includes sublists + tasks)
PATCH  /api/lists/:id         {name?, emoji?, shared?} → ListWithMembers
DELETE /api/lists/:id         → {message}
POST   /api/lists/:id/members {userId} → ListWithMembers
DELETE /api/lists/:id/members/:userId  → ListWithMembers
```

### Sublists (JWT, nested under lists)
```
POST   /api/lists/:listId/sublists       {name} → DBSublist
PATCH  /api/lists/:listId/sublists/:id   {name} → DBSublist
DELETE /api/lists/:listId/sublists/:id   → {message}
```

### Tasks (JWT, nested under lists)
```
POST   /api/lists/:listId/tasks          {text, sublist_id?, assignee_id?, due?, notes} → DBTask
PATCH  /api/lists/:listId/tasks/:id      {text?, done?, sublist_id?, assignee_id?, due?, notes?} → DBTask
DELETE /api/lists/:listId/tasks/:id      → {message}
```

### Notifications (JWT)
```
GET    /api/notifications           → DBNotification[]  (newest first, limit 50)
PATCH  /api/notifications/:id/read  → DBNotification
POST   /api/notifications/read-all  → {updated: number}
```

---

## Socket.io

### Connection
Client sends `socket.handshake.auth.token = JWT`.
Server verifies JWT, then auto-joins:
- `workspace:{workspace_id}` — all workspace members
- `user:{user_id}` — private per-user room

### Server → Client Events
```
task:created       {task: DBTask, list_id}         → workspace room
task:updated       {task: DBTask, list_id}         → workspace room
task:deleted       {task_id, list_id}              → workspace room
sublist:created    {sublist: DBSublist, list_id}   → workspace room
sublist:deleted    {sublist_id, list_id}           → workspace room
list:created       {list: ListWithMembers}         → workspace room
list:deleted       {list_id}                       → workspace room
member:status      {user_id, status}               → workspace room
notification:new   {notification: DBNotification} → user room (private)
```

### Client → Server Events
```
status_update      {status: 'active'|'away'}
```

### Frontend state update pattern
API call → socket event arrives → hook updates local state.
No manual state patching after API calls — the echo from the socket is the single source of truth.

---

## Notification Auto-Generation

Handled by `backend/src/services/notifications.service.ts`.

The `io` Socket.io instance is injected via `notificationsService.init(io)` called in `index.ts` at startup. This avoids circular imports between the socket handler and controllers.

| Trigger | Type | Who receives |
|---------|------|-------------|
| Task `done` flips true | `done` | All list members except actor |
| Task `assignee_id` changes | `assign` | New assignee only (skip self-assign) |
| Hourly cron: task due tomorrow | `due` | Task assignee (once per day per task) |
| Member invited to workspace | `member` | All workspace admins |
| Sublist created | `create` | All list members except creator |

After each `INSERT INTO notifications`, the service does:
```typescript
io.to(`user:${notification.user_id}`).emit('notification:new', { notification });
```

---

## Auth Flow

### Register
1. Validate email is unique
2. `bcryptjs.hash(password, 12)`
3. Derive `initials`: first char of first word + first char of last word (uppercase)
4. Assign avatar color pair from 8-entry palette: `index = (SELECT COUNT(*) FROM users) % 8`
5. `INSERT users` → `INSERT workspaces` → `INSERT workspace_members (role='admin')`
6. Sign JWT `{sub: userId, workspace_id, role: 'admin'}` with 24h expiry
7. Return `AuthResponse`

### Avatar Color Palette
```typescript
const PALETTE = [
  { color: "#B5D4F4", text_color: "#0C447C" },  // blue
  { color: "#9FE1CB", text_color: "#085041" },  // green
  { color: "#F4C0D1", text_color: "#72243E" },  // pink
  { color: "#FAC775", text_color: "#633806" },  // orange
  { color: "#C7B8EA", text_color: "#3D1E7A" },  // purple
  { color: "#F4D4A0", text_color: "#6B3E10" },  // warm yellow
  { color: "#B8E8E0", text_color: "#0D5048" },  // teal
  { color: "#F0B8B8", text_color: "#6B1A1A" },  // red
];
```

### Login
1. `SELECT * FROM users WHERE email = $1`
2. `bcryptjs.compare(password, user.password_hash)` — return 401 "Invalid credentials" on any failure (vague by design)
3. Sign JWT, return `AuthResponse`

### Protected Route (frontend)
`<ProtectedRoute>` checks `AuthContext.user`. If null and not loading → `<Navigate to="/login" />`.
Axios 401 interceptor calls `logout()` → clears localStorage → `user` becomes null → redirect fires.

---

## Environment Variables

### Backend (`.env` / Railway)
```
DATABASE_URL=postgres://user:pass@host:5432/dbname   # Railway provides automatically
JWT_SECRET=<48+ random bytes>                         # Use: openssl rand -base64 48
PORT=3001                                             # Railway sets automatically
NODE_ENV=production
FRONTEND_URL=https://your-frontend.railway.app        # For CORS + Socket.io
```

### Frontend (`.env` / Railway build-time)
```
VITE_API_URL=https://your-backend.railway.app
```
Note: Vite bakes `VITE_*` vars at build time. Set in Railway dashboard before deploy.

---

## Key Config Files

### `backend/package.json` scripts
```json
{
  "dev":   "tsx watch src/index.ts",
  "build": "tsc",
  "start": "node dist/index.js"
}
```

### `backend/package.json` dependencies
- Runtime: `express`, `pg`, `bcryptjs`, `jsonwebtoken`, `socket.io`, `cors`, `helmet`, `dotenv`
- Dev: `typescript`, `tsx`, `@types/express`, `@types/pg`, `@types/bcryptjs`, `@types/jsonwebtoken`, `@types/cors`

### `frontend/package.json` dependencies
- Runtime: `react`, `react-dom`, `react-router-dom`, `axios`, `socket.io-client`
- Dev: `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom`

### `vite.config.ts` (critical: WebSocket proxy)
```typescript
server: {
  proxy: {
    '/api':       { target: 'http://localhost:3001', changeOrigin: true },
    '/socket.io': { target: 'http://localhost:3001', ws: true }
  }
}
```

### `frontend/index.html` (Google Fonts in `<head>`)
```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet">
```

### `frontend/src/index.css`
```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'DM Sans', sans-serif; background: #f0ede8; }
h1, h2, h3 { font-family: 'DM Serif Display', serif; }
input, select, textarea, button { font-family: inherit; }
```

---

## Railway Deployment

Two Railway services in one repo. PostgreSQL plugin attached to backend.

```toml
# railway.toml

[[services]]
name = "backend"
rootDirectory = "backend"

[services.build]
buildCommand = "npm install && npm run build"

[services.deploy]
startCommand = "npm run start"
healthcheckPath = "/api/health"

[[services]]
name = "frontend"
rootDirectory = "frontend"

[services.build]
buildCommand = "npm install && npm run build"

[services.deploy]
startCommand = "npx serve -s dist -l $PORT"
```

---

## docker-compose.yml (Local Dev)

Three services: `postgres:16-alpine` (port 5432), `backend` (port 3001), `frontend` (port 5173).
Postgres init script: `./backend/migrations/001_init.sql` mounted at `/docker-entrypoint-initdb.d/init.sql`.
Backend: `tsx watch` for hot reload. Frontend: `vite --host`.

---

## Build Order

### Phase 1 — DB + Infrastructure
1. `backend/migrations/001_init.sql`
2. `docker-compose.yml`
3. `backend/package.json` + `tsconfig.json`
4. `backend/src/db.ts`
5. `backend/src/types.ts`

### Phase 2 — Backend Core
6. `backend/src/middleware/auth.ts` + `errorHandler.ts`
7. `backend/src/services/notifications.service.ts`
8. `backend/src/sockets/socket.handler.ts`
9. `backend/src/index.ts`

### Phase 3 — Backend Controllers + Routes
10. `auth.controller.ts` + `auth.routes.ts`
11. `workspace.controller.ts` + `workspace.routes.ts`
12. `members.controller.ts` + `members.routes.ts`
13. `lists.controller.ts` + `lists.routes.ts`
14. `sublists.controller.ts` + `sublists.routes.ts`
15. `tasks.controller.ts` + `tasks.routes.ts`
16. `notifications.controller.ts` + `notifications.routes.ts`

### Phase 4 — Frontend Scaffolding
17. `frontend/package.json` + `tsconfig.json` + `vite.config.ts`
18. `frontend/index.html`
19. `frontend/src/index.css`
20. `frontend/src/types.ts`
21. `frontend/src/api/client.ts`
22. `frontend/src/context/AuthContext.tsx`
23. `frontend/src/context/SocketContext.tsx`

### Phase 5 — Frontend API + Hooks
24. All `src/api/*.ts` files (independent, can be parallelized)
25. `useAuth.ts`, `useSocket.ts`, `useLists.ts`, `useNotifications.ts`

### Phase 6 — UI Primitives
26. Avatar, Badge, ProgressBar, CheckCircle, NavBar, TopBar, IconBtn, Sheet, FilterChips
    (all direct TypeScript ports of existing JSX components)

### Phase 7 — Pages + Screens
27. `LoginPage.tsx`, `RegisterPage.tsx`
28. `main.tsx`, `App.tsx`
29. `AppShell.tsx`
30. `Dashboard.tsx`, `Lists.tsx`, `ListDetail.tsx`, `TaskDetailSheet.tsx`, `Notifications.tsx`, `Team.tsx`

### Phase 8 — Deploy Config
31. `railway.toml`
32. `.env.example`
33. `backend/Dockerfile` + `frontend/Dockerfile`
34. `README.md`

---

## Known Gotchas

1. **Use `bcryptjs` not `bcrypt`** — Railway Nixpacks fails on native bcrypt compilation
2. **Vite WebSocket proxy** — must set `ws: true` on the `/socket.io` proxy or Socket.io won't upgrade
3. **PostgreSQL `DATE` columns** — `pg` returns JavaScript `Date` objects, not strings; serialize with `.toISOString().slice(0, 10)` before sending to frontend
4. **Circular import: `io` instance** — inject `io` into `notifications.service` via `init(io)` called in `index.ts`, never import `socket.handler` from a controller
5. **VITE_* vars baked at build time** — set them in Railway as build-time variables before triggering a deploy
6. **Socket.io CORS** — must match the exact frontend origin including `https://` protocol; wildcard `*` breaks credentials
7. **Notification dedup for due-soon** — before creating a `due` notification, check `notifications` table for an existing one from today for the same task
8. **Task toggle notification guard** — skip `onTaskCompleted` if the actor is the sole list member (avoids self-notifying on private lists)
