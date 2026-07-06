# Reorder, Quick-Add Bar, Sort Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add drag-and-drop task reordering, a persistent quick-add bar, and per-list sort options to ListDetail.

**Architecture:** Backend gets a `position` column on `tasks` and a new reorder endpoint; all three features live in `ListDetail.tsx` with sort state in localStorage; quick-add bar is an inline component at the bottom of ListDetail; DnD uses `@dnd-kit/sortable`.

**Tech Stack:** `@dnd-kit/core` + `@dnd-kit/sortable` (DnD), localStorage (sort persistence), existing Express + Socket.io + React Query patterns.

## Global Constraints

- No ORM — raw SQL via `query()` helper in `backend/src/db.ts`
- All inline styles — no Tailwind, no CSS-in-JS library
- Design tokens: primary `#178AE8`, success `#639922`, background `#F5F2ED`, border `0.5px solid #e8e4de`
- Socket pattern: emit from controller after DB write, broadcast to `workspace:{workspaceId}`
- Optimistic updates: patch React Query cache before API call, revert on error
- No test suite — verify manually via dev server after each task

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `backend/migrations/002_task_position.sql` | Create | Add `position` column, backfill |
| `backend/src/controllers/tasks.controller.ts` | Modify | Add `reorderTasks`, update `createTask` to set position, include `position` in all RETURNING clauses |
| `backend/src/controllers/lists.controller.ts` | Modify | Change task fetch ORDER BY to `position ASC` in both `getLists` and `getList`, include `amount` + `position` in select |
| `backend/src/routes/tasks.routes.ts` | Modify | Add reorder route BEFORE `/:id` route |
| `frontend/src/types.ts` | Modify | Add `position: number` to `DBTask` |
| `frontend/src/api/tasks.api.ts` | Modify | Add `reorderTasks` method |
| `frontend/src/components/ListDetail.tsx` | Modify | Add sort state + logic, quick-add bar, DnD wrapper + drag handles |

---

## Task 1: DB Migration + Fix Task Queries

**Files:**
- Create: `backend/migrations/002_task_position.sql`
- Modify: `backend/src/controllers/lists.controller.ts` (lines 98-110 in `getLists`, lines 204-208 in `getList`)

**Interfaces:**
- Produces: `tasks.position` column; all task rows returned with `position` field ordered correctly

- [ ] **Step 1: Create migration file**

Create `backend/migrations/002_task_position.sql`:

```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS position INTEGER NOT NULL DEFAULT 0;

UPDATE tasks t
SET position = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY list_id ORDER BY created_at ASC) AS rn
  FROM tasks
) sub
WHERE t.id = sub.id;
```

- [ ] **Step 2: Run migration against the database**

```bash
railway run --service shared-todo-backend psql $DATABASE_URL -f backend/migrations/002_task_position.sql
```

Expected: `ALTER TABLE` then `UPDATE N` (where N is your task count).

- [ ] **Step 3: Fix `getLists` task query to include `position` and order correctly**

In `backend/src/controllers/lists.controller.ts`, find the `getLists` task query (around line 98):

```typescript
// OLD:
const tasksResult = await query(
  `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, created_by, created_at, updated_at
   FROM tasks WHERE list_id = ANY($1) ORDER BY created_at DESC`,
  [listIds],
);

// NEW:
const tasksResult = await query(
  `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, amount, position, created_by, created_at, updated_at
   FROM tasks WHERE list_id = ANY($1) ORDER BY position ASC`,
  [listIds],
);
```

- [ ] **Step 4: Fix `getList` task query to include `position` and order correctly**

In the same file, find the `getList` task query (around line 204):

```typescript
// OLD:
const tasksResult = await query(
  `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, created_by, created_at, updated_at
   FROM tasks WHERE list_id = $1
   ORDER BY created_at DESC`,
  [listId],
);

// NEW:
const tasksResult = await query(
  `SELECT id, list_id, sublist_id, text, done, assignee_id, due, notes, amount, position, created_by, created_at, updated_at
   FROM tasks WHERE list_id = $1
   ORDER BY position ASC`,
  [listId],
);
```

- [ ] **Step 5: Update `createTask` to auto-assign position**

In `backend/src/controllers/tasks.controller.ts`, replace the INSERT in `createTask`:

```typescript
// Replace the existing INSERT + RETURNING with:
const result = await query(
  `INSERT INTO tasks (list_id, sublist_id, text, assignee_id, due, notes, amount, created_by, position)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8,
     COALESCE((SELECT MAX(position) FROM tasks WHERE list_id = $1), 0) + 1
   )
   RETURNING id, list_id, sublist_id, text, done, assignee_id, due, notes, amount, position, created_by, created_at, updated_at`,
  [listId, sublist_id || null, text, assignee_id || null, due || null, notes || '', amount ?? null, userId],
);
```

- [ ] **Step 6: Verify manually**

Start the backend (`npm run dev` in `backend/`), open the app, create a new task — confirm it appears at the bottom of the list and the network response includes `position`.

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/002_task_position.sql backend/src/controllers/tasks.controller.ts backend/src/controllers/lists.controller.ts
git commit -m "feat: add position column to tasks, order by position"
```

---

## Task 2: Backend Reorder Endpoint

**Files:**
- Modify: `backend/src/controllers/tasks.controller.ts`
- Modify: `backend/src/routes/tasks.routes.ts`

**Interfaces:**
- Consumes: `io` from `initTasksIO`, `query` from `../db.js`
- Produces: `PATCH /api/lists/:listId/tasks/reorder` — body `{ orderedIds: string[] }` → 200 `{ ok: true }`; emits `task:reordered { list_id, orderedIds }` to workspace room

- [ ] **Step 1: Add `reorderTasks` controller function**

Add to the bottom of `backend/src/controllers/tasks.controller.ts`:

```typescript
export async function reorderTasks(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { listId } = req.params;
    const workspaceId = req.user?.workspace_id;
    const { orderedIds } = req.body;

    if (!workspaceId) throw new AppError(401, 'Unauthorized');
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      throw new AppError(400, 'orderedIds must be a non-empty array');
    }

    // Update all positions in one query using unnest
    await query(
      `UPDATE tasks SET position = u.pos
       FROM (SELECT unnest($1::uuid[]) AS id, generate_series(1, $2) AS pos) AS u
       WHERE tasks.id = u.id AND tasks.list_id = $3`,
      [orderedIds, orderedIds.length, listId],
    );

    if (io) {
      io.to(`workspace:${workspaceId}`).emit('task:reordered', {
        list_id: listId,
        orderedIds,
      });
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}
```

- [ ] **Step 2: Register the route BEFORE the `/:id` route**

Replace the contents of `backend/src/routes/tasks.routes.ts`:

```typescript
import { Router } from 'express';
import * as tasksController from '../controllers/tasks.controller.js';

const router = Router();

router.post('/:listId/tasks', tasksController.createTask);
router.patch('/:listId/tasks/reorder', tasksController.reorderTasks);
router.patch('/:listId/tasks/:id', tasksController.updateTask);
router.delete('/:listId/tasks/:id', tasksController.deleteTask);

export default router;
```

> ⚠️ The `reorder` route MUST come before `/:id` — Express matches left-to-right and would otherwise treat the string "reorder" as a task ID.

- [ ] **Step 3: Verify manually**

With the backend running, use curl (replace values):

```bash
curl -X PATCH http://localhost:3001/api/lists/<listId>/tasks/reorder \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"orderedIds":["<id1>","<id2>"]}'
```

Expected: `{"ok":true}` and tasks appear in new order when you reload the list.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/tasks.controller.ts backend/src/routes/tasks.routes.ts
git commit -m "feat: add reorder tasks endpoint with socket broadcast"
```

---

## Task 3: Frontend Types + API Method

**Files:**
- Modify: `frontend/src/types.ts`
- Modify: `frontend/src/api/tasks.api.ts`

**Interfaces:**
- Produces: `DBTask.position: number`; `tasksAPI.reorderTasks(listId: string, orderedIds: string[]): Promise<AxiosResponse>`

- [ ] **Step 1: Add `position` to `DBTask`**

In `frontend/src/types.ts`, update the `DBTask` interface:

```typescript
export interface DBTask {
  id: string;
  list_id: string;
  sublist_id: string | null;
  text: string;
  done: boolean;
  assignee_id: string | null;
  due: string | null;
  notes: string;
  amount: number | null;
  position: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Add `reorderTasks` to tasks API**

Replace the contents of `frontend/src/api/tasks.api.ts`:

```typescript
import client from './client';

export const tasksAPI = {
  createTask: (listId: string, data: any) =>
    client.post(`/api/lists/${listId}/tasks`, data),
  updateTask: (listId: string, taskId: string, data: any) =>
    client.patch(`/api/lists/${listId}/tasks/${taskId}`, data),
  deleteTask: (listId: string, taskId: string) =>
    client.delete(`/api/lists/${listId}/tasks/${taskId}`),
  reorderTasks: (listId: string, orderedIds: string[]) =>
    client.patch(`/api/lists/${listId}/tasks/reorder`, { orderedIds }),
};
```

- [ ] **Step 3: Handle `task:reordered` socket event in `useLists`**

Open `frontend/src/hooks/useLists.ts`. Find where socket events are handled (look for `useSocketEvent`). Add the `task:reordered` handler:

```typescript
useSocketEvent('task:reordered', ({ list_id, orderedIds }: { list_id: string; orderedIds: string[] }) => {
  queryClient.setQueryData<ListDetail>(['list', list_id], (prev) => {
    if (!prev) return prev;
    const taskMap = new Map(prev.tasks.map((t) => [t.id, t]));
    const reordered = orderedIds.map((id, i) => ({ ...taskMap.get(id)!, position: i + 1 })).filter(Boolean);
    return { ...prev, tasks: reordered };
  });
  queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => {
      if (l.id !== list_id || !l.tasks) return l;
      const taskMap = new Map(l.tasks.map((t) => [t.id, t]));
      const reordered = orderedIds.map((id, i) => ({ ...taskMap.get(id)!, position: i + 1 })).filter(Boolean);
      return { ...l, tasks: reordered };
    }),
  );
});
```

- [ ] **Step 4: Verify**

Run `npm run dev` in `frontend/`. Open the app — no TypeScript errors, tasks still load normally.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/api/tasks.api.ts frontend/src/hooks/useLists.ts
git commit -m "feat: add position to DBTask type, reorderTasks API method, socket handler"
```

---

## Task 4: Sort Options

**Files:**
- Modify: `frontend/src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: `DBTask.position`, `DBTask.text`, `DBTask.done`, `DBTask.amount`
- Produces: `activeSort` state (used by Task 6 to hide drag handles when sort ≠ 'default')

- [ ] **Step 1: Add sort state + helper at the top of `ListDetail`**

After the existing `useState` declarations in `ListDetail.tsx`, add:

```typescript
type SortOption = 'default' | 'az' | 'done_last' | 'amount';

const getSavedSort = (): SortOption => {
  const perList = localStorage.getItem(`sort_list_${listId}`);
  if (perList) return perList as SortOption;
  const global = localStorage.getItem('sort_global');
  return (global as SortOption) || 'default';
};

const [activeSort, setActiveSort] = useState<SortOption>(getSavedSort);
const [showSortSheet, setShowSortSheet] = useState(false);

const applySort = (tasks: DBTask[]): DBTask[] => {
  const copy = [...tasks];
  if (activeSort === 'az') return copy.sort((a, b) => a.text.localeCompare(b.text));
  if (activeSort === 'done_last') return copy.sort((a, b) => Number(a.done) - Number(b.done));
  if (activeSort === 'amount') return copy.sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  return copy.sort((a, b) => a.position - b.position);
};

const saveSort = (sort: SortOption, asGlobal = false) => {
  localStorage.setItem(`sort_list_${listId}`, sort);
  if (asGlobal) localStorage.setItem('sort_global', sort);
  setActiveSort(sort);
  setShowSortSheet(false);
};
```

- [ ] **Step 2: Apply `applySort` when deriving `looseTasks` and sublist tasks**

Find where `looseTasks` is computed (around line 164):

```typescript
// OLD:
const looseTasks = list.tasks.filter((task) => !task.sublist_id && filterTask(task));

// NEW:
const looseTasks = applySort(list.tasks.filter((task) => !task.sublist_id && filterTask(task)));
```

Also find where sublist tasks are derived (search for `sublist_id === sl.id`). Wrap those filtered arrays with `applySort(...)` as well.

- [ ] **Step 3: Add sort button to the TopBar `right` prop**

Find the existing `<TopBar` in ListDetail. Add a sort icon button alongside the existing ones:

```typescript
// Add inside the right= prop div, after the search icon:
<div
  onClick={() => setShowSortSheet(true)}
  style={{ cursor: 'pointer', padding: 6, borderRadius: 8, color: activeSort !== 'default' ? 'var(--primary)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
>
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="18" x2="15" y2="18"/>
  </svg>
</div>
```

- [ ] **Step 4: Add sort Sheet at the bottom of the JSX (before the final `</div>`)**

```typescript
<Sheet open={showSortSheet} onClose={() => setShowSortSheet(false)} title="Sort by">
  {([
    { key: 'default', label: 'Default order' },
    { key: 'az',      label: 'A → Z' },
    { key: 'done_last', label: 'Open first' },
    { key: 'amount',  label: 'By amount (high → low)' },
  ] as { key: SortOption; label: string }[]).map((opt) => (
    <div
      key={opt.key}
      onClick={() => saveSort(opt.key)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 0', borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer' }}
    >
      <span style={{ fontSize: 16, color: 'var(--text)' }}>{opt.label}</span>
      {activeSort === opt.key && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2.5" strokeLinecap="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      )}
    </div>
  ))}
  <button
    onClick={() => saveSort(activeSort, true)}
    style={{ marginTop: 16, width: '100%', padding: 12, borderRadius: 10, background: 'var(--bg)', border: '0.5px solid var(--border)', fontSize: 14, color: 'var(--text-muted)', cursor: 'pointer' }}
  >
    Set as default for all lists
  </button>
</Sheet>
```

- [ ] **Step 5: Verify manually**

Open any list → tap the sort icon → select "A → Z" → items reorder alphabetically. Refresh page — same sort is still active. Switch to another list — it has its own sort.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ListDetail.tsx
git commit -m "feat: add per-list sort options with localStorage persistence"
```

---

## Task 5: Quick-Add Bar

**Files:**
- Modify: `frontend/src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: `tasksAPI.createTask`, `list.sublists`, existing React Query cache patch pattern
- Produces: visible quick-add bar UI; new tasks appear instantly

- [ ] **Step 1: Add quick-add state variables**

Add these `useState` calls near the top of `ListDetail` (with the other state):

```typescript
const [quickText, setQuickText] = useState('');
const [quickSublist, setQuickSublist] = useState<string | null>(null);
const [quickAdding, setQuickAdding] = useState(false);
```

- [ ] **Step 2: Add `handleQuickAdd` function**

Add this function alongside `toggleTask` and other handlers:

```typescript
const handleQuickAdd = async () => {
  const text = quickText.trim();
  if (!text) return;

  const tempId = `temp-${Date.now()}`;
  const optimistic: DBTask = {
    id: tempId, list_id: listId, sublist_id: quickSublist, text,
    done: false, assignee_id: null, due: null, notes: '', amount: null,
    position: (list.tasks.length + 1), created_by: auth.user?.id || '',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  };

  queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: [...prev.tasks, optimistic] } : prev,
  );
  setQuickText('');

  setQuickAdding(true);
  try {
    await tasksAPI.createTask(listId, { text, sublist_id: quickSublist, assignee_id: null, due: null, notes: '' });
  } catch {
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== tempId) } : prev,
    );
  } finally {
    setQuickAdding(false);
  }
};
```

- [ ] **Step 3: Add the quick-add bar JSX**

Find the closing `</div>` of the main scrollable task area in `ListDetail`. Add the bar AFTER the scroll area and BEFORE the last `</div>`:

```typescript
<div style={{ borderTop: '0.5px solid var(--border)', padding: '10px 12px', background: 'var(--bg)', display: 'flex', alignItems: 'center', gap: 8 }}>
  {(list.sublists || []).length > 0 && (
    <select
      value={quickSublist || ''}
      onChange={(e) => setQuickSublist(e.target.value || null)}
      style={{ height: 36, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--border)', padding: '0 8px', fontSize: 14, color: 'var(--text)', outline: 'none', flexShrink: 0, maxWidth: 120 }}
    >
      <option value="">No section</option>
      {(list.sublists || []).map((sl) => (
        <option key={sl.id} value={sl.id}>{sl.name}</option>
      ))}
    </select>
  )}
  <input
    value={quickText}
    onChange={(e) => setQuickText(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') handleQuickAdd(); }}
    placeholder="Add item…"
    style={{ flex: 1, height: 36, borderRadius: 10, background: 'var(--bg-input)', border: '0.5px solid var(--border)', padding: '0 12px', fontSize: 15, color: 'var(--text)', outline: 'none' }}
  />
  <button
    onClick={handleQuickAdd}
    disabled={!quickText.trim() || quickAdding}
    style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: !quickText.trim() || quickAdding ? 0.5 : 1, flexShrink: 0 }}
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  </button>
</div>
```

- [ ] **Step 4: Verify manually**

Open a list → type an item name in the bottom bar → press Enter → item appears instantly at the bottom. Open a list with sublists → the section dropdown appears.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ListDetail.tsx
git commit -m "feat: add quick-add bar to list detail"
```

---

## Task 6: Drag-and-Drop Reorder

**Files:**
- Modify: `frontend/package.json` (add deps)
- Modify: `frontend/src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: `activeSort` (from Task 4) — drag handles are hidden when `activeSort !== 'default'`
- Consumes: `tasksAPI.reorderTasks(listId, orderedIds)`
- Consumes: `DBTask.position` for initial order

- [ ] **Step 1: Install DnD dependencies**

```bash
cd frontend && npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `node_modules`, no errors.

- [ ] **Step 2: Add DnD imports to `ListDetail.tsx`**

Add at the top of `ListDetail.tsx`:

```typescript
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
```

- [ ] **Step 3: Add `handleDragEnd` function**

Add alongside the other handlers in `ListDetail`:

```typescript
const handleDragEnd = async (event: DragEndEvent) => {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const tasks = list.tasks;
  const oldIndex = tasks.findIndex((t) => t.id === active.id);
  const newIndex = tasks.findIndex((t) => t.id === over.id);
  const reordered = arrayMove(tasks, oldIndex, newIndex);
  const orderedIds = reordered.map((t) => t.id);

  // Optimistic update
  queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: reordered.map((t, i) => ({ ...t, position: i + 1 })) } : prev,
  );

  try {
    await tasksAPI.reorderTasks(listId, orderedIds);
  } catch {
    // Revert on error
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks } : prev,
    );
  }
};
```

- [ ] **Step 4: Add sensors**

Add alongside `handleDragEnd`:

```typescript
const sensors = useSensors(
  useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
);
```

- [ ] **Step 5: Create `SortableTaskRow` wrapper**

Add this component inside `ListDetail` (just before the `return`), replacing the existing `TaskRow`:

```typescript
const SortableTaskRow = ({ task }: { task: DBTask }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const isOverdue = task.due && task.due < today && !task.done;
  const isDueSoon = task.due && task.due >= today && !task.done;
  const assignee = list.members?.find((m) => m.id === task.assignee_id);

  return (
    <div ref={setNodeRef} style={style}>
      <div onClick={() => setTaskSheet(task)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)', cursor: 'pointer' }}>
        {activeSort === 'default' && (
          <div
            {...attributes}
            {...listeners}
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: 'grab', padding: '2px 0', color: 'var(--text-faint)', flexShrink: 0, marginTop: 2, touchAction: 'none' }}
          >
            <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
              <circle cx="4" cy="3" r="1.5"/><circle cx="8" cy="3" r="1.5"/>
              <circle cx="4" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
              <circle cx="4" cy="13" r="1.5"/><circle cx="8" cy="13" r="1.5"/>
            </svg>
          </div>
        )}
        <div onClick={(e) => e.stopPropagation()}>
          <CheckCircle done={task.done} onToggle={() => toggleTask(task.id)} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 17, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
            {task.amount != null && (
              <span style={{ flexShrink: 0, background: 'var(--bg)', border: '0.5px solid var(--border)', borderRadius: 6, padding: '1px 7px', fontWeight: 600, color: 'var(--text-dim)', fontSize: 13 }}>
                {task.amount % 1 === 0 ? task.amount : task.amount.toFixed(2)}
              </span>
            )}
          </div>
          {assignee && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
              <Avatar member={assignee} size={16} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{assignee.name}</span>
            </div>
          )}
          {(task.due) && (
            <div style={{ fontSize: 13, color: isOverdue ? 'var(--danger)' : 'var(--text-muted)', marginTop: 2 }}>
              {task.due.slice(0, 10)}
            </div>
          )}
        </div>
        {isOverdue && <Badge variant="danger">Overdue</Badge>}
        {!isOverdue && isDueSoon && <Badge variant="warn">Due soon</Badge>}
      </div>
    </div>
  );
};
```

- [ ] **Step 6: Wrap the loose tasks list with `DndContext` + `SortableContext`**

Find where `looseTasks` is rendered (the `.map()` call). Replace it with:

```typescript
<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={looseTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
    {looseTasks.map((task) => <SortableTaskRow key={task.id} task={task} />)}
  </SortableContext>
</DndContext>
```

Do the same for each sublist's task list (wrap each sublist's task array with its own `DndContext` + `SortableContext`).

- [ ] **Step 7: Verify manually**

Open a list in Default sort → grip icons appear on each item → drag an item to a new position → it snaps into place and the backend saves the order. Switch to A→Z sort → grip icons disappear.

- [ ] **Step 8: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/components/ListDetail.tsx
git commit -m "feat: drag-and-drop task reorder with DnD Kit"
```

---

## Task 7: Deploy

- [ ] **Step 1: Deploy backend to Railway**

```bash
git push origin main
```

Railway auto-deploys on push. Watch the Railway dashboard to confirm the backend build succeeds.

- [ ] **Step 2: Run migration on production DB**

```bash
railway run --service shared-todo-backend psql $DATABASE_URL -f backend/migrations/002_task_position.sql
```

- [ ] **Step 3: Deploy frontend to Vercel**

```bash
vercel --prod --cwd frontend
```

- [ ] **Step 4: Smoke test on production**

- Open https://shared-todo-app.vercel.app
- Open a list → quick-add bar is visible at the bottom
- Add an item via quick-add → appears instantly
- Tap the sort icon → sort sheet opens, options work
- Drag an item → reorders and persists after refresh
