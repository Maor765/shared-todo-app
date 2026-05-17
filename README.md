# Shared Todo App

A full-stack collaborative task management app built with Node.js, Express, PostgreSQL, React, and Socket.io for real-time sync.

## Features

- 🔐 JWT authentication (register/login)
- 👥 Multi-user workspaces with role-based access
- 📝 Create, organize, and track tasks in lists and sublists
- 🔔 Real-time notifications (Socket.io)
- 🎯 Task assignment, due dates, and notes
- 📱 Mobile-first responsive design (390px shell)
- 🎨 DM Serif Display + DM Sans typography

## Tech Stack

**Backend:** Node.js + Express + TypeScript + PostgreSQL + Socket.io
**Frontend:** React 18 + TypeScript + Vite + TanStack Router + TanStack Query + Axios
**Deploy:** Railway + Docker

## Getting Started

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for local dev)
- PostgreSQL 16 (or use docker-compose)

### Local Development (Docker)

1. **Clone and install:**
   ```bash
   cd shared-todo-app
   npm install  # root level, or install backend/frontend separately
   ```

2. **Start services:**
   ```bash
   docker-compose up
   ```

   This starts:
   - PostgreSQL on `:5432`
   - Backend on `:3001`
   - Frontend on `:5173`

3. **Access:**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001/api
   - Health check: http://localhost:3001/api/health

4. **Create account:**
   - Register with any email/password (min 8 chars)
   - Workspace auto-created on registration

### Manual Setup

If you prefer without Docker:

1. **Backend:**
   ```bash
   cd backend
   npm install
   # Set DATABASE_URL, JWT_SECRET, FRONTEND_URL in .env
   npm run dev
   ```

2. **Frontend:**
   ```bash
   cd frontend
   npm install
   # Set VITE_API_URL in .env or browser env
   npm run dev
   ```

## Project Structure

```
backend/
├── src/
│   ├── controllers/     # Auth, lists, tasks, notifications, etc.
│   ├── routes/         # Express route handlers
│   ├── middleware/     # Auth, error handling
│   ├── services/       # Notifications service
│   ├── sockets/        # Socket.io event handlers
│   ├── db.ts          # PostgreSQL pool
│   ├── types.ts       # Shared TypeScript types
│   └── index.ts       # Express + Socket.io entry
├── migrations/         # SQL schema (001_init.sql)
└── Dockerfile

frontend/
├── src/
│   ├── api/           # Axios API clients
│   ├── context/       # AuthContext, SocketContext
│   ├── hooks/         # useAuth, useSocket, etc.
│   ├── pages/         # LoginPage, RegisterPage, AppShell
│   ├── components/    # UI primitives + page screens
│   ├── App.tsx        # Router
│   ├── main.tsx       # React entry
│   └── index.css      # Global styles
├── index.html         # With Google Fonts
├── vite.config.ts
└── Dockerfile

docker-compose.yml      # Local dev: postgres, backend, frontend
railway.toml           # Railway deploy config
CLAUDE.md              # Detailed architecture docs
```

## API Endpoints

### Auth (no JWT required)
- `POST /api/auth/register` — Create account + workspace
- `POST /api/auth/login` — Sign in
- `GET /api/auth/me` — Current user + workspace
- `GET /api/health` — Health check

### Workspace
- `GET /api/workspace` — Workspace info
- `GET /api/workspace/members` — All members
- `POST /api/workspace/members/invite` — Invite member (admin)
- `PATCH /api/workspace/members/:userId/status` — Update status

### Lists
- `GET /api/lists` — All visible lists
- `POST /api/lists` — Create list
- `GET /api/lists/:id` — List detail with sublists + tasks
- `PATCH /api/lists/:id` — Update list
- `DELETE /api/lists/:id` — Delete list
- `POST /api/lists/:id/members` — Add member
- `DELETE /api/lists/:id/members/:userId` — Remove member

### Sublists & Tasks
- `POST /api/lists/:listId/sublists` — Create sublist
- `PATCH /api/lists/:listId/sublists/:id` — Update sublist
- `DELETE /api/lists/:listId/sublists/:id` — Delete sublist
- `POST /api/lists/:listId/tasks` — Create task
- `PATCH /api/lists/:listId/tasks/:id` — Update task (toggle done, reassign, etc.)
- `DELETE /api/lists/:listId/tasks/:id` — Delete task

### Notifications
- `GET /api/notifications` — User's notifications (newest first, limit 50)
- `PATCH /api/notifications/:id/read` — Mark one as read
- `POST /api/notifications/read-all` — Mark all as read

## Socket.io Events

**Server → Client:**
- `task:created` — New task added
- `task:updated` — Task changed (done, assigned, due date, etc.)
- `task:deleted` — Task removed
- `sublist:created` — New sublist
- `sublist:deleted` — Sublist removed
- `list:created` — New list
- `list:deleted` — List removed
- `member:status` — User status changed (active/away)
- `notification:new` — New notification (private to user)

**Client → Server:**
- `status_update` — Update own status (active/away)

All events automatically synced across all users in the workspace.

## Deployment (Railway)

1. **Connect repository** to Railway
2. **Set environment variables:**
   - `JWT_SECRET` — Random 48+ bytes (e.g., `openssl rand -base64 48`)
   - `FRONTEND_URL` — Your Railway frontend domain
   - Database: Railway PostgreSQL plugin (provides `DATABASE_URL` automatically)
3. **Deploy** — Railway auto-detects `railway.toml` and deploys both services

## Design System

- **Primary color:** `#178AE8` (blue)
- **Background:** `#f5f2ed` (warm off-white)
- **Typography:** DM Serif Display (headings), DM Sans (body)
- **Shell:** 390px width, centered on desktop, `borderRadius: 32`
- **Responsive:** Mobile-first, tested on iOS/Android

## Next Steps / TODOs

The app is now functional with all backend APIs and core UI infrastructure in place. To complete:

1. **Frontend page implementations** — Replace the placeholder AppShell with actual Dashboard, Lists, ListDetail, Notifications, and Team pages (use existing JSX as reference)
2. **useNotifications & useLists hooks** — Add API + Socket integration to load and reactively update lists and notifications
3. **Styling refinement** — Fine-tune spacing, shadows, hover states
4. **Error handling & validation** — Add user-friendly error boundaries and input validation
5. **Testing** — Add unit tests and E2E tests

See `CLAUDE.md` for complete architecture details.

## Contributing

This is a learning project. Feel free to fork and extend!

## License

MIT
