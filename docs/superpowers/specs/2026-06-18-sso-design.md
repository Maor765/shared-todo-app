# SSO Design — Google Sign-In

**Date:** 2026-06-18  
**Status:** Approved

---

## Summary

Add Google Sign-In to the shared-todo-app alongside the existing email/password auth. Users can use either method. If a Google email matches an existing password account, the accounts are auto-linked silently.

---

## Decisions

| Question | Decision |
|----------|----------|
| Provider | Google only |
| Mode | Supplement existing email/password (both remain) |
| Account collision | Auto-link: if Google email matches existing account, write `google_id` and log them in |
| OAuth flow | Google Identity Services credential flow (frontend popup → ID token → backend verify) |

---

## Database (migration `002_sso.sql`)

```sql
-- Google-only users have no password
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Stable Google user identifier for linking
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;
```

Existing users get `google_id = NULL`. Auto-link writes `google_id` on first Google login. New Google sign-ups get `password_hash = NULL`.

---

## Backend

**Package:** `google-auth-library`  
**Env var:** `GOOGLE_CLIENT_ID`

### New endpoint

```
POST /api/auth/google   (public, no authMiddleware)
Body: { credential: string }   ← Google ID token from frontend
Returns: AuthResponse
```

### Logic in `auth.controller.ts` → `googleAuth()`

1. `client.verifyIdToken({ idToken: credential, audience: GOOGLE_CLIENT_ID })`
2. Extract `{ sub: google_id, email, name }` from payload
3. **Google user exists** (`google_id` match) → fetch workspace, issue JWT
4. **Email exists, no `google_id`** (auto-link) → `UPDATE users SET google_id = $1 WHERE email = $2`, then issue JWT
5. **New user** → insert user (`password_hash = NULL`), create workspace, insert `workspace_members`, issue JWT

JWT signing and `AuthResponse` shape are identical to the existing `login()` / `register()` functions. Reuse `signToken()` and `toPublicUser()`.

Registered in `auth.routes.ts`:
```
router.post('/google', authController.googleAuth);
```

---

## Frontend

**Package:** `@react-oauth/google`  
**Env var:** `VITE_GOOGLE_CLIENT_ID`

### `main.tsx`

Wrap app root with `<GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>`.

### `auth.api.ts`

New function:
```typescript
export async function googleAuth(credential: string): Promise<AuthResponse> {
  const res = await client.post('/api/auth/google', { credential });
  return res.data;
}
```

### `LoginPage.tsx` and `RegisterPage.tsx`

- Add a visual separator ("or") between the existing form and the Google button
- Render `<GoogleLogin onSuccess={...} onError={...} />`
- `onSuccess` receives `{ credential }` → call `googleAuth(credential)` → store token/user via existing `auth` context methods
- `onError` → show error message

No new pages, no redirect routes, no callback URLs.

---

## Environment Variables

| Variable | Where | Notes |
|----------|-------|-------|
| `GOOGLE_CLIENT_ID` | Backend `.env` + Railway | OAuth client ID from Google Cloud Console |
| `VITE_GOOGLE_CLIENT_ID` | Frontend `.env` + Railway build vars | Same value, baked at Vite build time |

The Google Cloud Console OAuth app must have the frontend URL added as an **Authorized JavaScript origin** (no redirect URIs needed — this is not a redirect flow).

---

## Error Handling

| Scenario | Response |
|----------|----------|
| Invalid/expired Google token | 401 `Invalid Google token` |
| `verifyIdToken` throws | 401 `Invalid Google token` (never expose internal errors) |
| Google payload missing email | 400 `Google account has no email` |

---

## Files Changed

| File | Change |
|------|--------|
| `backend/migrations/002_sso.sql` | New migration |
| `backend/src/controllers/auth.controller.ts` | Add `googleAuth()` |
| `backend/src/routes/auth.routes.ts` | Register `POST /google` |
| `backend/package.json` | Add `google-auth-library` |
| `frontend/src/main.tsx` | Wrap with `GoogleOAuthProvider` |
| `frontend/src/api/auth.api.ts` | Add `googleAuth()` |
| `frontend/src/pages/LoginPage.tsx` | Add Google button |
| `frontend/src/pages/RegisterPage.tsx` | Add Google button |
| `frontend/package.json` | Add `@react-oauth/google` |
| `.env.example` | Document new vars |
