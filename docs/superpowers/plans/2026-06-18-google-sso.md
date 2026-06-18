# Google SSO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Sign in with Google" to LoginPage and RegisterPage alongside existing email/password auth, with auto-linking when a Google email matches an existing account.

**Architecture:** Frontend uses `@react-oauth/google` to show Google's native popup button, which returns a signed ID token. That token is POSTed to a new `POST /api/auth/google` endpoint, which verifies it server-side with `google-auth-library`, then issues the app's own JWT via the existing `signToken()` helper. No redirects, no sessions, no callbacks.

**Tech Stack:** `google-auth-library` (backend, ID token verification), `@react-oauth/google` (frontend, Google button + popup)

## Global Constraints

- All inline styles — no Tailwind, no CSS-in-JS library
- Design tokens: primary `#178AE8`, background `#F5F2ED`, border `0.5px solid #e8e4de`, muted text `#888`
- No ORM — raw SQL via `query()` helper from `../db.js`
- `password_hash` must remain nullable after migration (Google-only users have no password)
- Return shape of `POST /api/auth/google` is identical to existing `AuthResponse`: `{ token, user: PublicUser, workspace: { id, name } }`
- Error responses shape: `{ error: string }` (handled by existing `errorHandler.ts`)
- Frontend env vars prefixed `VITE_` (baked at build time by Vite)

---

## Prerequisite: Google Cloud Console setup

Before writing any code, create the OAuth client:

- [ ] Go to [console.cloud.google.com](https://console.cloud.google.com) → **APIs & Services → Credentials**
- [ ] Create a new **OAuth 2.0 Client ID** → Application type: **Web application**
- [ ] Add **Authorized JavaScript origins**: `http://localhost:5173` (dev) and your production frontend URL
- [ ] No redirect URIs needed — this is not a redirect flow
- [ ] Copy the **Client ID** (looks like `123456789.apps.googleusercontent.com`)

---

## Files

| File | Action | Purpose |
|------|--------|---------|
| `backend/migrations/002_sso.sql` | Create | Make `password_hash` nullable, add `google_id` column |
| `backend/src/controllers/auth.controller.ts` | Modify | Add `googleAuth()` export |
| `backend/src/routes/auth.routes.ts` | Modify | Register `POST /google` route |
| `backend/package.json` | Modify | Add `google-auth-library` dependency |
| `frontend/src/main.tsx` | Modify | Wrap root with `GoogleOAuthProvider` |
| `frontend/src/api/auth.api.ts` | Modify | Add `googleAuth()` function |
| `frontend/src/pages/LoginPage.tsx` | Modify | Add Google Sign-In button |
| `frontend/src/pages/RegisterPage.tsx` | Modify | Add Google Sign-In button |
| `frontend/package.json` | Modify | Add `@react-oauth/google` dependency |
| `.env.example` | Modify | Document `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID` |

---

## Task 1: Database Migration

**Files:**
- Create: `backend/migrations/002_sso.sql`

**Interfaces:**
- Produces: `users.google_id TEXT UNIQUE NULL`, `users.password_hash` nullable

- [ ] **Step 1: Create the migration file**

Create `backend/migrations/002_sso.sql` with this exact content:

```sql
-- Allow Google-only users who have no password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google's stable user identifier (sub claim) for account matching and linking
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
```

- [ ] **Step 2: Apply the migration**

Run against your local Postgres (adjust credentials to match your `.env`):

```bash
docker exec -i shared-todo-app-postgres-1 psql -U todo -d todo < backend/migrations/002_sso.sql
```

Or if running Postgres directly:
```bash
psql $DATABASE_URL < backend/migrations/002_sso.sql
```

- [ ] **Step 3: Verify schema**

```bash
docker exec -it shared-todo-app-postgres-1 psql -U todo -d todo -c "\d users"
```

Expected: `password_hash` column shows no `not null` constraint, and a `google_id` column of type `text` appears with a unique constraint.

- [ ] **Step 4: Commit**

```bash
git add backend/migrations/002_sso.sql
git commit -m "feat: add google_id column and make password_hash nullable"
```

---

## Task 2: Backend — install package, controller, route

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts` (add after `resetPassword` export)
- Modify: `backend/src/routes/auth.routes.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes: existing `query()`, `signToken()`, `toPublicUser()`, `getInitials()`, `getAvatarColor()`, `AppError` — all already in `auth.controller.ts`
- Produces: `export async function googleAuth(req, res, next)` — same `AuthResponse` shape as `login()`

- [ ] **Step 1: Install `google-auth-library` in the backend**

```bash
cd backend && npm install google-auth-library
```

Expected: `google-auth-library` appears in `backend/package.json` dependencies.

- [ ] **Step 2: Add the `OAuth2Client` import to `auth.controller.ts`**

At the top of `backend/src/controllers/auth.controller.ts`, add this import after the existing imports:

```typescript
import { OAuth2Client } from 'google-auth-library';
```

Also add a module-level client instance after the `AVATAR_PALETTE` constant:

```typescript
const googleOAuthClient = new OAuth2Client();
```

- [ ] **Step 3: Add `googleAuth()` to `auth.controller.ts`**

Append this function at the end of `backend/src/controllers/auth.controller.ts`, after `resetPassword`:

```typescript
export async function googleAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { credential } = req.body;
    if (!credential) throw new AppError(400, 'Missing credential');

    const googleClientId = process.env.GOOGLE_CLIENT_ID;
    if (!googleClientId) throw new AppError(500, 'Google auth not configured');

    const ticket = await googleOAuthClient.verifyIdToken({
      idToken: credential,
      audience: googleClientId,
    });

    const payload = ticket.getPayload();
    if (!payload) throw new AppError(401, 'Invalid Google token');

    const { sub: googleId, email: rawEmail, name: googleName } = payload;
    if (!rawEmail) throw new AppError(400, 'Google account has no email');

    const email = rawEmail.toLowerCase();
    const name = googleName || email.split('@')[0];

    // Case 1: returning Google user matched by google_id
    let userResult = await query(
      `SELECT id, email, name, initials, color, text_color, role, status
       FROM users WHERE google_id = $1`,
      [googleId],
    );

    if (userResult.rowCount === 0) {
      const emailResult = await query(
        `SELECT id, email, name, initials, color, text_color, role, status
         FROM users WHERE email = $1`,
        [email],
      );

      if (emailResult.rowCount > 0) {
        // Case 2: email matches existing account — auto-link
        await query(`UPDATE users SET google_id = $1 WHERE email = $2`, [googleId, email]);
        userResult = emailResult;
      } else {
        // Case 3: brand new user
        const userCountResult = await query(`SELECT COUNT(*) as count FROM users`);
        const userCount = parseInt(userCountResult.rows[0].count, 10);
        const { color, text_color } = getAvatarColor(userCount);
        const initials = getInitials(name);

        const newUserResult = await query(
          `INSERT INTO users (email, password_hash, name, initials, color, text_color, role, status, google_id)
           VALUES ($1, NULL, $2, $3, $4, $5, 'member', 'active', $6)
           RETURNING id, email, name, initials, color, text_color, role, status`,
          [email, name, initials, color, text_color, googleId],
        );

        const user = newUserResult.rows[0];
        const userId = user.id;
        const workspaceName = `${name}'s Workspace`;

        const workspaceResult = await query(
          `INSERT INTO workspaces (name, owner_id) VALUES ($1, $2) RETURNING id, name`,
          [workspaceName, userId],
        );
        const newWorkspace = workspaceResult.rows[0];
        const workspaceId = newWorkspace.id;

        await query(
          `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
          [workspaceId, userId],
        );

        // Honour a pending invite (same logic as register())
        const inviteResult = await query(
          `SELECT wi.id, wi.role, w.id as workspace_id, w.name as workspace_name
           FROM workspace_invites wi
           JOIN workspaces w ON w.id = wi.workspace_id
           WHERE LOWER(wi.email) = $1 LIMIT 1`,
          [email],
        );

        if (inviteResult.rowCount > 0) {
          const invite = inviteResult.rows[0];
          await query(
            `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [invite.workspace_id, userId, invite.role],
          );
          await query(`DELETE FROM workspace_invites WHERE id = $1`, [invite.id]);
          await query(`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`, [workspaceId, userId]);
          await query(`DELETE FROM workspaces WHERE id = $1`, [workspaceId]);
          const sharedToken = signToken(userId, invite.workspace_id, invite.role);
          res.status(201).json({
            token: sharedToken,
            user: toPublicUser(user),
            workspace: { id: invite.workspace_id, name: invite.workspace_name },
          });
          return;
        }

        const token = signToken(userId, workspaceId, 'admin');
        res.status(201).json({
          token,
          user: toPublicUser(user),
          workspace: { id: workspaceId, name: workspaceName },
        });
        return;
      }
    }

    // Existing user (Case 1 or auto-linked Case 2) — look up their workspace
    const user = userResult.rows[0];
    const workspaceResult = await query(
      `SELECT workspaces.id, workspaces.name, workspace_members.role as ws_role
       FROM workspace_members
       JOIN workspaces ON workspaces.id = workspace_members.workspace_id
       WHERE workspace_members.user_id = $1
       ORDER BY (workspaces.owner_id = $1) DESC
       LIMIT 1`,
      [user.id],
    );

    if (workspaceResult.rowCount === 0) throw new AppError(500, 'User workspace not found');

    const workspace = workspaceResult.rows[0];
    const token = signToken(user.id, workspace.id, workspace.ws_role);
    res.json({
      token,
      user: toPublicUser({ ...user, role: workspace.ws_role }),
      workspace: { id: workspace.id, name: workspace.name },
    });
  } catch (error) {
    if (error instanceof AppError) return next(error);
    // google-auth-library throws on invalid/expired tokens — never expose its internals
    next(new AppError(401, 'Invalid Google token'));
  }
}
```

- [ ] **Step 4: Register the route in `auth.routes.ts`**

In `backend/src/routes/auth.routes.ts`, add this line after `router.post('/reset-password', ...)`:

```typescript
router.post('/google', authController.googleAuth);
```

The full file should now read:

```typescript
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

router.post('/register', authController.register);
router.post('/login', authController.login);
router.get('/me', authMiddleware, authController.getMe);
router.post('/invites/:inviteId/accept', authMiddleware, authController.acceptInvite);
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);
router.post('/google', authController.googleAuth);

export default router;
```

- [ ] **Step 5: Add `GOOGLE_CLIENT_ID` to your local backend `.env`**

Add this line to `backend/.env`:

```
GOOGLE_CLIENT_ID=<your-client-id-from-google-cloud-console>
```

- [ ] **Step 6: Verify the backend compiles without errors**

```bash
cd backend && npm run build
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 7: Smoke-test the endpoint with curl**

Start the backend (`npm run dev`) then run:

```bash
curl -s -X POST http://localhost:3001/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"not-a-real-token"}' | jq .
```

Expected response:
```json
{ "error": "Invalid Google token" }
```

HTTP status 401. This confirms the route is wired up and the error path works. You can't test a real credential via curl — that happens in Task 5 via the browser.

- [ ] **Step 8: Commit**

```bash
git add backend/package.json backend/package-lock.json \
        backend/src/controllers/auth.controller.ts \
        backend/src/routes/auth.routes.ts
git commit -m "feat: add POST /api/auth/google endpoint"
```

---

## Task 3: Frontend — install package, provider, API function, AuthContext method

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/api/auth.api.ts`
- Modify: `frontend/src/context/AuthContext.tsx`

**Interfaces:**
- Produces: `authAPI.googleAuth(credential: string)` — raw axios call, used by `AuthContext` internally
- Produces: `auth.googleLogin(credential: string): Promise<void>` on the auth context — called by pages in Task 4

**Why a new AuthContext method:** `finalizeSession()` reads from `localStorage` (no args). `login()` calls the API directly and sets React state. `googleLogin()` must do the same — call the API, save to localStorage, and set React state. Adding it to `AuthContext` follows the exact pattern already used by `login()` and `register()`.

- [ ] **Step 1: Install `@react-oauth/google`**

```bash
cd frontend && npm install @react-oauth/google
```

Expected: `@react-oauth/google` appears in `frontend/package.json` dependencies.

- [ ] **Step 2: Add `VITE_GOOGLE_CLIENT_ID` to frontend `.env`**

Add this line to `frontend/.env`:

```
VITE_GOOGLE_CLIENT_ID=<same-client-id-as-backend>
```

- [ ] **Step 3: Wrap the app root with `GoogleOAuthProvider` in `main.tsx`**

Replace the content of `frontend/src/main.tsx` with:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { SettingsProvider } from './context/SettingsContext';
import { router } from './router';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
      <SettingsProvider>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <SocketProvider>
              <RouterProvider router={router} />
            </SocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SettingsProvider>
    </GoogleOAuthProvider>
  </React.StrictMode>,
);
```

- [ ] **Step 4: Add `googleAuth` to `auth.api.ts`**

Replace the content of `frontend/src/api/auth.api.ts` with:

```typescript
import client from './client';

export const authAPI = {
  register: (name: string, email: string, password: string, workspace_name: string) =>
    client.post('/api/auth/register', { name, email, password, workspace_name }),
  login: (email: string, password: string) =>
    client.post('/api/auth/login', { email, password }),
  getMe: () => client.get('/api/auth/me'),
  googleAuth: (credential: string) =>
    client.post('/api/auth/google', { credential }),
};
```

- [ ] **Step 5: Add `googleLogin` to `AuthContext.tsx`**

`AuthContext.tsx` is at `frontend/src/context/AuthContext.tsx`.

**5a.** In the `AuthContextValue` interface, add `googleLogin` after `login`:

```typescript
export interface AuthContextValue {
  user: PublicUser | null;
  workspace: { id: string; name: string } | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  googleLogin: (credential: string) => Promise<void>;
  register: (name: string, email: string, password: string, workspace_name: string) => Promise<WorkspaceInvite | null>;
  acceptInvite: (inviteId: string) => Promise<void>;
  finalizeSession: () => void;
  logout: () => void;
}
```

**5b.** Add the `googleLogin` function inside `AuthProvider`, directly after the `login` function:

```typescript
async function googleLogin(credential: string) {
  const response = await client.post('/api/auth/google', { credential });
  const { token: newToken, user: newUser, workspace: newWorkspace } = response.data;
  saveSession(newToken, newUser, newWorkspace);
  setToken(newToken);
  setUser(newUser);
  setWorkspace(newWorkspace);
}
```

**5c.** Add `googleLogin` to the `AuthContext.Provider` value prop:

```typescript
<AuthContext.Provider value={{ user, workspace, token, isLoading, login, googleLogin, register, acceptInvite, finalizeSession, logout }}>
```

- [ ] **Step 6: Verify frontend compiles without errors**

```bash
cd frontend && npm run build
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 7: Update `.env.example`**

Replace the content of `.env.example` with:

```
# Backend
DATABASE_URL=postgres://todo:todo@postgres:5433/todo
JWT_SECRET=your-secret-key-change-in-production
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:4001
GOOGLE_CLIENT_ID=your-google-oauth-client-id

# Frontend
VITE_API_URL=http://localhost:4000
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
```

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json \
        frontend/src/main.tsx \
        frontend/src/api/auth.api.ts \
        frontend/src/context/AuthContext.tsx \
        .env.example
git commit -m "feat: install @react-oauth/google, add googleLogin to AuthContext"
```

---

## Task 4: Frontend — Google button on LoginPage and RegisterPage

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/RegisterPage.tsx`

**Interfaces:**
- Consumes: `auth.googleLogin(credential: string): Promise<void>` added to `AuthContext` in Task 3 Step 5

- [ ] **Step 1: Add the Google button to `LoginPage.tsx`**

Replace the content of `frontend/src/pages/LoginPage.tsx` with:

```typescript
import { useState, useEffect } from 'react';
import { useNavigate, Link } from '@tanstack/react-router';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../context/SettingsContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = useAuth();
  const navigate = useNavigate();
  const { t } = useSettings();

  useEffect(() => {
    if (auth.user) navigate({ to: '/' });
  }, [auth.user]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await auth.login(email, password);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (response: { credential?: string }) => {
    if (!response.credential) return;
    setError('');
    try {
      await auth.googleLogin(response.credential);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Google sign-in failed');
    }
  };

  const inputStyle = {
    width: '100%', height: 40, borderRadius: 10,
    background: 'var(--bg-card)', border: '0.5px solid var(--border)',
    padding: '0 12px', fontSize: 15, marginBottom: 12,
    outline: 'none', color: 'var(--text)',
  } as const;

  return (
    <div style={{ width: '100%', maxWidth: 480, minHeight: '100dvh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: 'var(--text)' }}>{t('welcome_back')}</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 32 }}>{t('sign_in_sub')}</p>

        <form onSubmit={handleLogin} style={{ width: '100%', maxWidth: 280 }}>
          <input type="email" placeholder={t('email_ph')} value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          <input type="password" placeholder={t('password_ph')} value={password} onChange={(e) => setPassword(e.target.value)} style={{ ...inputStyle, marginBottom: 6 }} />
          <div style={{ textAlign: 'right', marginBottom: 16 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--text-muted)', textDecoration: 'none' }}>{t('forgot_password')}?</Link>
          </div>
          {error && <div style={{ color: 'var(--danger)', fontSize: 14, marginBottom: 12 }}>{error}</div>}
          <button type="submit" disabled={loading}
            style={{ width: '100%', height: 40, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 15, fontWeight: 600, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? t('signing_in') : t('sign_in')}
          </button>
        </form>

        <div style={{ width: '100%', maxWidth: 280, margin: '20px 0 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>or</span>
            <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} width="280" />
          </div>
        </div>

        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 16 }}>
          {t('no_account')}{' '}
          <Link to="/register" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>{t('create_one')}</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the Google button to `RegisterPage.tsx`**

In `frontend/src/pages/RegisterPage.tsx`:

1. Add this import at the top:
```typescript
import { GoogleLogin } from '@react-oauth/google';
```

2. Add a `handleGoogleSuccess` handler inside the component, before `handleRegister`:
```typescript
const handleGoogleSuccess = async (response: { credential?: string }) => {
  if (!response.credential) return;
  setError('');
  try {
    await auth.googleLogin(response.credential);
  } catch (err: any) {
    setError(err.response?.data?.error || 'Google sign-in failed');
  }
};
```

3. Add the divider + Google button inside the `<form>` block, after the submit button and before the closing `</form>` tag:
```tsx
<div style={{ margin: '16px 0 4px' }}>
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>or</span>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
  </div>
  <div style={{ display: 'flex', justifyContent: 'center' }}>
    <GoogleLogin onSuccess={handleGoogleSuccess} onError={() => setError('Google sign-in failed')} width="280" />
  </div>
</div>
```

- [ ] **Step 3: Verify frontend compiles**

```bash
cd frontend && npm run build
```

Expected: exits with code 0, no TypeScript errors.

- [ ] **Step 4: End-to-end test — new Google user**

1. Start both services: `docker-compose up`
2. Open `http://localhost:5173/login`
3. Click "Sign in with Google" — Google popup should open
4. Complete sign-in with a Google account **not already registered**
5. Expected: you land on the app's main page, authenticated

Verify in the database:
```bash
docker exec -it shared-todo-app-postgres-1 psql -U todo -d todo \
  -c "SELECT email, google_id, password_hash IS NULL as google_only FROM users ORDER BY created_at DESC LIMIT 3;"
```
Expected: the new user row has a `google_id` value and `google_only = true`.

- [ ] **Step 5: End-to-end test — auto-link**

1. Register a new account via the email/password form (use a fresh email)
2. Log out
3. Click "Sign in with Google" using the **same email address** as the account just created
4. Expected: signs in successfully (not a new account — same user row updated with `google_id`)

Verify:
```bash
docker exec -it shared-todo-app-postgres-1 psql -U todo -d todo \
  -c "SELECT email, google_id IS NOT NULL as linked FROM users WHERE email = '<your-test-email>';"
```
Expected: `linked = true`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/LoginPage.tsx frontend/src/pages/RegisterPage.tsx
git commit -m "feat: add Google Sign-In button to login and register pages"
```

---

## Railway Deployment Checklist

After all tasks are complete and working locally:

- [ ] In Railway dashboard, set `GOOGLE_CLIENT_ID` as a backend environment variable
- [ ] In Railway dashboard, set `VITE_GOOGLE_CLIENT_ID` as a frontend **build-time** variable (not runtime)
- [ ] In Google Cloud Console, add your production frontend URL to **Authorized JavaScript origins**
- [ ] Trigger a new Railway deploy and smoke-test Google Sign-In in production
