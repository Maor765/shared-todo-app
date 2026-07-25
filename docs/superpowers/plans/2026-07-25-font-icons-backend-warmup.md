# Font Size Bump, Icon Enlargement, Backend/DB Warm-up Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bump the frontend's text scale to a 16px default, enlarge the search and delete icons, and stop the backend/DB from cold-starting between requests.

**Architecture:** Three independent changes against the existing full-stack app (React/Vite frontend, Express/pg backend). No new dependencies, no new services, no test framework introduced (this repo has none — `typecheck` + manual dev-server verification is the existing verification pattern per `CLAUDE.md`).

**Tech Stack:** React 18 + TypeScript (frontend, inline styles only), Express + `pg` (backend), Node.js for the one-off migration script.

## Global Constraints

- No Tailwind, no CSS-in-JS — all styling stays inline `style={{...}}` objects, per `CLAUDE.md`.
- No new design-token/type-scale system — the font-size change is a mechanical value migration only (per spec's Out of Scope).
- No changes to Render/Neon plan tier, and no changes to UptimeRobot's own configuration (per spec's Out of Scope).
- `bcryptjs` / existing libraries unaffected — this plan touches no auth code.
- Every file edit must leave `npm run typecheck` passing (frontend and backend each have this script; no other lint/test command exists in this repo).

Spec: `docs/superpowers/specs/2026-07-25-font-icons-backend-warmup-design.md`

---

### Task 1: Font-size migration (193 occurrences → new scale)

**Files:**
- Modify (via script, not by hand): every `.tsx`/`.ts` file under `frontend/src/` containing a `fontSize:` literal (18 files: `App.tsx`, `pages/*.tsx`, `components/*.tsx`, `components/ui/*.tsx`).
- No change: `frontend/src/index.css` (its `font-size: 16px !important` on inputs already matches the new default).

**Interfaces:** None — this is a pure text substitution across existing files. No function signatures change.

- [ ] **Step 1: Run the migration script**

Create a throwaway script in the OS temp dir (not committed to the repo) and run it against `frontend/src`:

```bash
cat > /tmp/migrate-font-sizes.mjs <<'EOF'
import fs from 'fs';
import path from 'path';

const MAP = {
  9: 10, 12: 13, 13: 14, 14: 15, 15: 16, 16: 17, 17: 18, 18: 19,
  20: 21, 22: 23, 24: 26, 26: 28, 28: 30, 32: 34, 40: 43, 42: 45, 48: 51,
};

const ROOT = path.join(process.cwd(), 'frontend', 'src');

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

let changed = 0;
const skipped = [];

for (const file of walk(ROOT)) {
  const content = fs.readFileSync(file, 'utf8');
  let fileChanged = false;
  const next = content.replace(/fontSize:\s*(\d+)/g, (match, num) => {
    const old = Number(num);
    if (MAP[old] === undefined) {
      skipped.push(`${file}: fontSize ${old}`);
      return match;
    }
    fileChanged = true;
    changed++;
    return `fontSize: ${MAP[old]}`;
  });
  if (fileChanged) fs.writeFileSync(file, next, 'utf8');
}

console.log(`Replaced ${changed} fontSize occurrences.`);
if (skipped.length) {
  console.log('Skipped (no mapping entry found):');
  skipped.forEach((s) => console.log('  ' + s));
} else {
  console.log('No skipped values.');
}
EOF
node /tmp/migrate-font-sizes.mjs
```

Expected output: `Replaced 193 fontSize occurrences.` and `No skipped values.`

If any values are skipped, stop and investigate before continuing — it means a `fontSize` value exists in the codebase that wasn't accounted for in the spec's mapping table; do not guess a mapping, ask the value's context and pick the nearest consistent step by hand.

- [ ] **Step 2: Delete the throwaway script**

```bash
rm /tmp/migrate-font-sizes.mjs
```

- [ ] **Step 3: Typecheck the frontend**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors (this is a pure numeric-literal substitution, so this step mainly guards against the script having mangled a file).

- [ ] **Step 4: Review the diff**

```bash
git diff --stat frontend/src
```

Expected: all 18 files with `fontSize` listed in the spec's file scan show changes; no unrelated files touched.

- [ ] **Step 5: Manual visual check**

Start the local dev stack and confirm text reads larger but the hierarchy (headings vs. body vs. muted labels) still looks correct — no truncation/overflow introduced by the size bump:

```bash
docker compose up -d postgres
cd backend && npm run dev
```

(in a second terminal)

```bash
cd frontend && npm run dev
```

Open `http://localhost:4001` (or the port Vite reports), log in or register, and click through Dashboard, Lists, a list detail view, and Settings. Confirm nothing overflows its container.

- [ ] **Step 6: Commit**

```bash
git add frontend/src
git commit -m "$(cat <<'EOF'
feat: bump frontend font-size scale to 16px default

Applies a fixed old->new pixel mapping across all inline fontSize
literals (193 occurrences, 18 files) so the app's de facto default
text size (15px) becomes 16px and the rest of the scale shifts up
proportionally (~7%).
EOF
)"
```

---

### Task 2: Enlarge the search icon via `IconBtn`

**Files:**
- Modify: `frontend/src/components/ui/IconBtn.tsx`
- Modify: `frontend/src/components/Dashboard.tsx:85` (search `IconBtn` call site)
- Modify: `frontend/src/components/Lists.tsx:307-310` (search `IconBtn` call site — do NOT touch the add-list `IconBtn` at lines 311-314)

**Interfaces:**
- Produces: `IconBtn` gains an optional `size?: { svg: number; btn: number }` prop, defaulting to `{ svg: 18, btn: 34 }` (today's values, unchanged for every caller that doesn't pass it — `Team.tsx:87`, `Notifications.tsx:84`, and the add-list `IconBtn` in `Lists.tsx` all keep their current size).

- [ ] **Step 1: Add the `size` prop to `IconBtn`**

Replace the full contents of `frontend/src/components/ui/IconBtn.tsx`:

```tsx
interface IconBtnProps {
  icon: string;
  onClick: () => void;
  size?: { svg: number; btn: number };
}

export function IconBtn({ icon, onClick, size = { svg: 18, btn: 34 } }: IconBtnProps) {
  return (
    <button
      onClick={onClick}
      style={{
        width: size.btn, height: size.btn, borderRadius: '50%',
        background: 'var(--bg)', border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', color: 'var(--text-dim)', flexShrink: 0,
      }}
    >
      <svg width={size.svg} height={size.svg} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={icon} />
      </svg>
    </button>
  );
}
```

- [ ] **Step 2: Pass the larger size at the Dashboard search call site**

In `frontend/src/components/Dashboard.tsx`, find:

```tsx
            <IconBtn icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" onClick={() => { setShowSearch((s) => !s); setSearch(''); }} />
```

Replace with:

```tsx
            <IconBtn icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0" onClick={() => { setShowSearch((s) => !s); setSearch(''); }} size={{ svg: 22, btn: 40 }} />
```

- [ ] **Step 3: Pass the larger size at the Lists search call site**

In `frontend/src/components/Lists.tsx`, find:

```tsx
            <IconBtn
              icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
              onClick={() => setShowSearch((s) => !s)}
            />
```

Replace with:

```tsx
            <IconBtn
              icon="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"
              onClick={() => setShowSearch((s) => !s)}
              size={{ svg: 22, btn: 40 }}
            />
```

Leave the very next `IconBtn` (the `M12 5v14M5 12h14` add-list plus icon, lines 311-314) untouched — it should keep the default size.

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Manual visual check**

With the dev stack still running from Task 1 (or restart it — `docker compose up -d postgres`, `cd backend && npm run dev`, `cd frontend && npm run dev`), open the Dashboard and Lists screens and confirm the search (magnifying-glass) icon is visibly larger than the other round icon buttons next to it (e.g. the add-list `+` button on Lists), and that toggling search still opens/closes the search input correctly.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/IconBtn.tsx frontend/src/components/Dashboard.tsx frontend/src/components/Lists.tsx
git commit -m "$(cat <<'EOF'
feat: enlarge search icon on Dashboard and Lists

Adds an optional size prop to IconBtn (defaults unchanged) and uses
it only at the two search-toggle call sites, so other icons that
share the component (add-list, back/close) are unaffected.
EOF
)"
```

---

### Task 3: Enlarge ListDetail's toolbar icon row (search, sort, menu)

**Files:**
- Modify: `frontend/src/components/ListDetail.tsx:305,310,314` (the three `<svg>` tags in the toolbar row)

**Interfaces:** None — inline JSX attribute changes only, no prop/type changes.

- [ ] **Step 1: Enlarge the sort icon**

Find:

```tsx
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
```

Replace with:

```tsx
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 6h18M7 12h10M11 18h2"/></svg>
```

- [ ] **Step 2: Enlarge the search icon**

Find:

```tsx
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
```

Replace with:

```tsx
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
```

- [ ] **Step 3: Enlarge the menu-dots icon (keeping its aspect ratio)**

Find:

```tsx
              <svg width="18" height="4" viewBox="0 0 18 4" fill="currentColor"><circle cx="2" cy="2" r="2"/><circle cx="9" cy="2" r="2"/><circle cx="16" cy="2" r="2"/></svg>
```

Replace with:

```tsx
              <svg width="22" height="5" viewBox="0 0 18 4" fill="currentColor"><circle cx="2" cy="2" r="2"/><circle cx="9" cy="2" r="2"/><circle cx="16" cy="2" r="2"/></svg>
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Manual visual check**

Open a list's detail view (`http://localhost:4001` → any list). Confirm the sort, search, and menu (⋯) icons in the top-right toolbar are all visibly larger than before, and still evenly spaced/aligned as a row — none should look mismatched in size from its neighbors. Confirm clicking each still opens its respective sheet/menu.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ListDetail.tsx
git commit -m "$(cat <<'EOF'
feat: enlarge ListDetail toolbar icons (sort, search, menu)

Bumps all three together since they're a matched set in the same
row — enlarging only search would have looked mismatched against
its neighbors.
EOF
)"
```

---

### Task 4: Enlarge the task-delete icon

**Files:**
- Modify: `frontend/src/components/TaskDetailSheet.tsx:111-116`

**Interfaces:** None — inline JSX attribute changes only.

- [ ] **Step 1: Enlarge the delete button and its icon**

Find:

```tsx
        <button onClick={handleDelete}
          style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--danger-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2M10 11v6M14 11v6" />
          </svg>
        </button>
```

Replace with:

```tsx
        <button onClick={handleDelete}
          style={{ width: 48, height: 48, borderRadius: 10, background: 'var(--danger-bg)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M19 6l-1 14H6L5 6M9 6V4h6v2M10 11v6M14 11v6" />
          </svg>
        </button>
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 3: Manual visual check**

Open any task's detail sheet (tap a task in a list). Confirm the trash/delete icon next to the Save button is visibly larger and the button still sits at the same height as the Save button (both should look aligned in the row).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskDetailSheet.tsx
git commit -m "feat: enlarge task-delete icon in TaskDetailSheet"
```

---

### Task 5: Backend health check warms the DB (fixes Neon cold-start)

**Files:**
- Modify: `backend/src/index.ts:37-39`

**Interfaces:**
- Consumes: `query` from `./db.js` (already imported at `backend/src/index.ts:6` — `import { query } from './db.js';`).
- Produces: `GET /api/health` now returns `200 {status:'ok', timestamp}` only if a DB round-trip succeeds, else `503 {status:'error', timestamp}`.

- [ ] **Step 1: Update the health check handler**

Find (`backend/src/index.ts:37-39`):

```ts
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});
```

Replace with:

```ts
app.get('/api/health', async (req, res) => {
  try {
    await query('SELECT 1');
    res.json({ status: 'ok', timestamp: new Date() });
  } catch (error) {
    res.status(503).json({ status: 'error', timestamp: new Date() });
  }
});
```

- [ ] **Step 2: Typecheck**

```bash
cd backend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 3: Verify the success path locally**

```bash
docker compose up -d postgres
cd backend && npm run dev
```

(in a second terminal, once the backend log shows it's listening)

```bash
curl -i http://localhost:4000/api/health
```

Expected: `HTTP/1.1 200 OK` with body `{"status":"ok","timestamp":"..."}`.

- [ ] **Step 4: Verify the failure path locally**

```bash
docker compose stop postgres
curl -i http://localhost:4000/api/health
```

Expected: `HTTP/1.1 503 Service Unavailable` with body `{"status":"error","timestamp":"..."}`.

Then restore normal state:

```bash
docker compose start postgres
curl -i http://localhost:4000/api/health
```

Expected: back to `200 OK` within a few seconds (once Postgres finishes starting back up).

- [ ] **Step 5: Commit**

```bash
git add backend/src/index.ts
git commit -m "$(cat <<'EOF'
fix: health check warms the DB to prevent Neon cold-start

/api/health previously never touched the database, so the existing
UptimeRobot ping kept the Render process warm but not Neon's
compute endpoint (which auto-suspends after 5 min idle on the free
tier). Running a trivial query on every health check keeps both
warm on the same cadence, and turns the health check into a real
DB-connectivity signal (503 on failure) instead of an always-ok
response.
EOF
)"
```

---

## Post-plan note (not a task — informational only)

This plan does not touch UptimeRobot's own ping interval/config, since that's an external service outside the repo (per spec's Out of Scope). After Task 5 ships to Render, the fix will only take effect if UptimeRobot (or whatever is currently pinging `/api/health`) is actively configured and pinging on an interval shorter than Neon's 5-minute autosuspend window. If cold starts persist after this deploy, the next thing to check is whether that external ping is actually running (not a code change).
