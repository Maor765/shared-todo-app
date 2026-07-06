# Design: Reorder, Quick-Add Bar, Sort Options

**Date:** 2026-07-06
**Status:** Approved

---

## Overview

Three UX improvements to `ListDetail` that make the app feel faster and more natural as a shared to-do/shopping list tool:

1. **Drag-and-drop reorder** — manually reorder tasks within a list, synced across all users in real time
2. **Quick-add bar** — persistent bottom bar for rapid task entry without opening a sheet
3. **Sort options** — per-list and global sort preferences (A→Z, Done last, By amount, Default)

---

## Feature 1: Drag-and-Drop Reorder

### Backend

**Migration** — add `position` to `tasks`:
```sql
ALTER TABLE tasks ADD COLUMN position INTEGER NOT NULL DEFAULT 0;
UPDATE tasks t
SET position = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY created_at) AS rn
  FROM tasks
) sub
WHERE t.id = sub.id;
```

**New endpoint:**
```
PATCH /api/lists/:listId/tasks/reorder
Body: { orderedIds: string[] }
```
Updates all task positions for the list in a single transaction. Only the list owner or a list member may call this.

**New socket event:**
```
task:reordered  { list_id: string, orderedIds: string[] }  → workspace room
```
Broadcast after a successful reorder so all connected clients update their order instantly.

### Frontend

- Install `@dnd-kit/core` and `@dnd-kit/sortable`
- Wrap the task list in `SortableContext` (vertical list strategy)
- Each `TaskRow` becomes a sortable item; a 6-dot grip icon appears on the left as the drag handle
- On drag end:
  1. Optimistically reorder items in the React Query cache
  2. Call `PATCH /reorder` in the background
  3. On error, revert cache to previous order
- The `task:reordered` socket event updates the cache for all other connected users
- Drag handles are **hidden** when any non-Default sort is active (sorting and manual order are mutually exclusive)

---

## Feature 2: Quick-Add Bar

### Backend

No changes. Uses the existing `POST /api/lists/:listId/tasks` endpoint.

### Frontend

A persistent bar pinned to the bottom of `ListDetail`, sitting above the nav bar. Contains:

- **Text input** — placeholder "Add item…", auto-focused on mount
- **Sublist dropdown** — only rendered if the list has sublists; defaults to the last-used sublist (component state), enabling rapid sequential entry into the same section
- **Add button** — submits the form

**Behaviour:**
- Submit via Enter key or tapping Add
- After submit: clear the text input, keep the sublist selection, refocus the input (enables rapid multi-add)
- Optimistic add: item appears in the list immediately; removed on API error
- The existing "+" sheet in the top bar is kept for full-detail entry (assignee, due date, amount)

---

## Feature 3: Sort Options

### Backend

No changes. Sorting is applied client-side over the cached task list.

### Frontend

**Sort button** added to the `ListDetail` top bar (sort icon, turns blue when a non-Default sort is active).

Tapping opens a sheet with four options:

| Option | Behaviour |
|--------|-----------|
| Default | Manual drag order (position column) |
| A→Z | Alphabetical by task text |
| Done last | Unchecked tasks first, checked tasks at bottom |
| By amount | Highest amount first; tasks with no amount go to the bottom |

Active option shows a checkmark.

A **"Set as default for all lists"** secondary action saves the current selection as the global default.

**Persistence:**
- Per-list: `localStorage` key `sort_list_{listId}`
- Global default: `localStorage` key `sort_global`
- Per-list setting takes precedence; falls back to global; falls back to Default

**Interaction with drag-and-drop:**
- When sort is Default → drag handles visible, reordering enabled
- When sort is anything else → drag handles hidden, reordering disabled

---

## Scope Boundaries

- Reordering sublists is out of scope (tasks only)
- Quick-add bar does not support assignee or due date (use the "+" sheet for that)
- Sort does not persist to the server — it is a local UI preference only
- No sort options on the Lists screen (lists themselves are not sorted)
