# Google SSO – Setup & Re-auth Guide

## When does Google SSO break?

Any time the **frontend URL changes**, Google will reject the OAuth request with a silent failure or "redirect_uri_mismatch" error. This happens because Google only allows OAuth requests from pre-approved origins.

---

## Fix: add the new URL to Google Cloud Console

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **APIs & Services → Credentials**
3. Click your **OAuth 2.0 Client ID**
4. Under **Authorized JavaScript origins**, add the new frontend URL
   - Example: `https://shared-todo-maor765.vercel.app`
5. Click **Save** — takes effect within a few minutes (no redeploy needed)

---

## Current authorized origins

| URL | Status |
|-----|--------|
| `https://shared-todo-maor765.vercel.app` | ✅ Active |

---

## Environment variables required

| Variable | Where | Value |
|----------|-------|-------|
| `VITE_GOOGLE_CLIENT_ID` | Vercel (build-time) | Your OAuth client ID |
| `GOOGLE_CLIENT_ID` | Railway (backend) | Same OAuth client ID |

> `VITE_*` variables are baked into the JS bundle at build time. After changing them on Vercel, a redeploy is required.

---

## First-time setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → **Create Project** (or use existing)
2. **APIs & Services → OAuth consent screen** — fill in app name and support email
3. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Authorized JavaScript origins: your frontend URL
4. Copy the **Client ID**
5. Set `VITE_GOOGLE_CLIENT_ID` in Vercel dashboard
6. Set `GOOGLE_CLIENT_ID` in Railway dashboard
7. Redeploy frontend
