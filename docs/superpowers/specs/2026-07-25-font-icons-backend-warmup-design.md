# Font Size Increase, Icon Enlargement, Backend/DB Warm-up

Date: 2026-07-25

## 1. Font size → 16px default

Text sizes are hardcoded inline (`fontSize: N`) at 193 call sites across 18
frontend components — there is no shared type scale. Today, `15px` plays the
role of "default body text" (names, descriptions, primary content); `13px`
and `14px` are secondary/meta text; other values step up from there for
headings and emphasis.

Apply a fixed old→new pixel lookup table (~7% bump, `15→16`) across every
`fontSize:` literal in `frontend/src`, so the existing size hierarchy is
preserved but the whole scale shifts up and 16px becomes the new default:

| old | 9 | 12 | 13 | 14 | **15** | 16 | 17 | 18 | 20 | 22 | 24 | 26 | 28 | 32 | 40 | 42 | 48 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| new | 10 | 13 | 14 | 15 | **16** | 17 | 18 | 19 | 21 | 23 | 26 | 28 | 30 | 34 | 43 | 45 | 51 |

Apply mechanically (scripted find/replace over `fontSize: N` occurrences, one
value at a time using the table above) rather than by hand, so the change is
consistent and reviewable as a single diff. Any `fontSize` value not in the
table is left untouched (investigate case by case if the script finds one).

`frontend/src/index.css`'s iOS zoom-prevention rule
(`input, select, textarea { font-size: 16px !important }`) already matches
16px and needs no change.

## 2. Icon enlargement

Two distinct implementations need changes:

**`frontend/src/components/ui/IconBtn.tsx`** — shared component, reused for
search (Dashboard, Lists) as well as unrelated icons (add-list, back/close in
Team/Notifications). Add an optional `size` prop:

```ts
{ icon: string; onClick: () => void; size?: { svg: number; btn: number } }
```

Default stays `{ svg: 18, btn: 34 }` (unchanged for existing callers). Pass
`{ svg: 22, btn: 40 }` only at the two search call sites:
- `Dashboard.tsx:85`
- `Lists.tsx:307`

**`frontend/src/components/ListDetail.tsx`** toolbar row (~line 302-315) —
has its own inline search icon (16px) sitting next to a sort icon (16px) and
a menu-dots icon (18px), all currently sized to match each other as a set.
Bump all three together to keep the row visually consistent:
- sort icon svg: 16 → 20
- search icon svg: 16 → 20
- menu-dots icon svg: 18 → 22

**`frontend/src/components/TaskDetailSheet.tsx`** delete button (~line
111-116): svg 18 → 22, button box 44 → 48.

No other icons change. `IconBtn`'s default size is untouched, so add-list,
back, and close icons elsewhere stay exactly as they are today.

## 3. Backend/DB warm-up

`backend/src/index.ts:37-39` — `/api/health` currently responds
`{status:'ok'}` without touching the database. The existing UptimeRobot ping
(external, not in this repo) keeps the Render web service process warm, but
Neon's compute endpoint auto-suspends after 5 minutes of idle regardless,
since nothing was pinging the DB. That's the likely cause of "still slow
despite UptimeRobot."

Change the handler to:

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

Effects:
- Every UptimeRobot ping now also resets Neon's idle timer, so the DB stays
  warm on the same cadence as the backend process — no new infra, no cost.
- `render.yaml`'s `healthCheckPath: /api/health` already points here, so a
  real DB outage now correctly surfaces as an unhealthy deploy instead of
  being silently masked by an always-`ok` response (this was a pre-existing
  correctness gap, not just a side effect).
- No changes to UptimeRobot's own configuration (external service, out of
  repo scope) — this only helps because a ping is already arriving on an
  interval short enough to matter.

## Out of scope

- No new design-token / type-scale system — the font-size change is a
  mechanical value migration, not a refactor to CSS variables.
- No changes to Render/Neon plan tier (staying on free tier).
- No changes to UptimeRobot's ping configuration itself.
- No other icons besides the two named (search, delete) plus the ListDetail
  toolbar trio needed to keep search visually consistent with its neighbors.
