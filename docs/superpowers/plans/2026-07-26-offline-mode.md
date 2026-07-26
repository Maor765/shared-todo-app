# Offline Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist the TanStack Query cache to `localStorage` for instant-paint reloads, and let task/list/sublist writes keep working (and sync later) when the device or backend is unreachable.

**Architecture:** Build on the app's existing TanStack Query v5 setup. Reads: `PersistQueryClientProvider` snapshots/restores the whole cache. Writes: a single `defaultMutationFn` registered on the `QueryClient` (required so paused mutations survive a page reload — a per-call-site closure can't be serialized), driving new `useTaskMutations`/`useListMutations`/`useSublistMutations` hooks that replace today's direct `await tasksAPI.xxx()` calls, with optimistic cache updates via a small shared `cachePatches` module.

**Tech Stack:** React 18 + TypeScript, `@tanstack/react-query` v5 (existing) + two new official companion packages (`@tanstack/query-sync-storage-persister`, `@tanstack/react-query-persist-client`).

## Global Constraints

- No Tailwind, no CSS-in-JS — inline `style={{...}}` only, per `CLAUDE.md`.
- No test framework in this repo — verification is `npm run typecheck` (frontend) plus manual review of the diff, matching the project's existing pattern.
- `strict: true` in `frontend/tsconfig.json`, but `noUnusedLocals`/`noUnusedParameters` are OFF — unused imports won't fail typecheck, but remove them where a step already touches that code, for cleanliness.
- Offline-queued mutations cover **tasks** (create/update/delete/reorder) and **lists** (create/update/delete) and **sublist creation only** — `updateSublist`/`deleteSublist` exist in `frontend/src/api/sublists.api.ts` but have zero call sites in the current UI (verified: only `sublistsAPI.createSublist` is called anywhere), so they're out of scope per YAGNI. Team/workspace mutations are explicitly out of scope (per spec).
- Conflict policy: last-write-wins; a 404 on replay means the target is gone — drop that one change, toast it, don't block the rest of the queue.
- Temp IDs for offline-created items are prefixed `temp-`; while an item has a temp ID, its edit/delete/reorder/drag affordances are disabled in the UI (see Task 12) rather than supporting chained edits to unsynced items.

Spec: `docs/superpowers/specs/2026-07-26-offline-mode-design.md`

---

### Task 1: Persist the query cache (cache-first reads)

**Files:**
- Create: `frontend/src/lib/queryClient.ts`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/hooks/useNotifications.ts`
- Modify: `frontend/src/components/Team.tsx`
- Modify: `frontend/package.json` (via `npm install`)

**Interfaces:**
- Produces: `queryClient` (the app's singleton `QueryClient`) and `QUERY_CACHE_KEY` constant, exported from `frontend/src/lib/queryClient.ts`, consumed by Tasks 2, 3, 6.

- [ ] **Step 1: Install the persistence packages**

```bash
cd frontend && npm install @tanstack/query-sync-storage-persister @tanstack/react-query-persist-client
```

- [ ] **Step 2: Create the queryClient singleton module**

```ts
// frontend/src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const QUERY_CACHE_KEY = 'todo_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
```

- [ ] **Step 3: Wrap the app in `PersistQueryClientProvider`**

In `frontend/src/main.tsx`, replace:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
```

with:

```tsx
import { QueryClientProvider } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { queryClient, QUERY_CACHE_KEY } from './lib/queryClient';
```

Then remove the now-unused local `const queryClient = new QueryClient({...})` block (lines 12-19 of the original file), and add, in its place:

```tsx
const persister = createSyncStoragePersister({
  storage: window.localStorage,
  key: QUERY_CACHE_KEY,
});
```

Finally, replace the `<QueryClientProvider client={queryClient}>...</QueryClientProvider>` wrapper with:

```tsx
<PersistQueryClientProvider client={queryClient} persistOptions={{ persister }}>
  <AuthProvider>
    <SocketProvider>
      <RouterProvider router={router} />
    </SocketProvider>
  </AuthProvider>
</PersistQueryClientProvider>
```

(Same children as before — only the provider component and its props change. `QueryClientProvider` is no longer used directly in this file; `PersistQueryClientProvider` renders its own internal one.)

- [ ] **Step 4: Add `gcTime: Infinity` to the remaining queries**

In `frontend/src/hooks/useNotifications.ts`, find:

```ts
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getNotifications().then((r) => r.data as DBNotification[]),
    staleTime: 2 * 60 * 1000,
  });
```

Replace with:

```ts
  const { data: notifications = [], isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsAPI.getNotifications().then((r) => r.data as DBNotification[]),
    staleTime: 2 * 60 * 1000,
    gcTime: Infinity,
  });
```

In `frontend/src/components/Team.tsx`, find:

```ts
  const { data: members = [] } = useQuery<PublicUser[]>({
    queryKey: ['members'],
    queryFn: () => workspaceAPI.getMembers().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const { data: invites = [] } = useQuery<PendingInvite[]>({
    queryKey: ['invites'],
    queryFn: () => membersAPI.getInvites().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
```

Replace with:

```ts
  const { data: members = [] } = useQuery<PublicUser[]>({
    queryKey: ['members'],
    queryFn: () => workspaceAPI.getMembers().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });

  const { data: invites = [] } = useQuery<PendingInvite[]>({
    queryKey: ['invites'],
    queryFn: () => membersAPI.getInvites().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
  });
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/queryClient.ts frontend/src/main.tsx frontend/src/hooks/useNotifications.ts frontend/src/components/Team.tsx
git commit -m "$(cat <<'EOF'
feat: persist query cache to localStorage for instant reload

Wraps the app in PersistQueryClientProvider so lists/tasks/
notifications/members paint immediately from the last-known cache on
load, while the existing staleTime-driven background refetch replaces
it once the network responds — hides Render/Neon cold-start latency
regardless of cause.
EOF
)"
```

---

### Task 2: Broaden offline detection beyond `navigator.onLine`

**Files:**
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Consumes: `onlineManager` from `@tanstack/react-query`.

- [ ] **Step 1: Hook the axios interceptors into `onlineManager`**

Replace the full contents of `frontend/src/api/client.ts`:

```ts
import axios from 'axios';
import { onlineManager } from '@tanstack/react-query';

const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

const client = axios.create({
  baseURL,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('todo_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    onlineManager.setOnline(true);
    return response;
  },
  (error) => {
    if (!error.response) {
      // No response at all (connection refused/timeout/DNS failure) means the
      // backend is unreachable — as opposed to a real HTTP error like 404/500,
      // which means the server was reached. Treat only the former as "offline"
      // so TanStack Query's mutation pause/resume and the offline banner
      // reflect actual backend reachability, not just navigator.onLine.
      onlineManager.setOnline(false);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('todo_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  },
);

export default client;
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "$(cat <<'EOF'
feat: treat backend-unreachable as offline, not just navigator.onLine

navigator.onLine only reflects the OS network interface, which misses
the actual motivating case here: WiFi/cellular up but Render/Neon
unreachable or cold. Any axios error with no response at all now flips
TanStack's onlineManager offline; the next successful response flips
it back.
EOF
)"
```

---

### Task 3: Clear the persisted cache on logout / 401

**Files:**
- Modify: `frontend/src/lib/queryClient.ts`
- Modify: `frontend/src/context/AuthContext.tsx`
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `clearPersistedCache()` exported from `frontend/src/lib/queryClient.ts`.

- [ ] **Step 1: Add `clearPersistedCache` to the queryClient module**

In `frontend/src/lib/queryClient.ts`, add after the `queryClient` export:

```ts

export function clearPersistedCache() {
  queryClient.clear();
  localStorage.removeItem(QUERY_CACHE_KEY);
}
```

- [ ] **Step 2: Call it from `logout()`**

In `frontend/src/context/AuthContext.tsx`, add the import at the top:

```ts
import { clearPersistedCache } from '../lib/queryClient';
```

Then find:

```ts
  function logout() {
    clearSession();
    setToken(null);
    setUser(null);
    setWorkspace(null);
  }
```

Replace with:

```ts
  function logout() {
    clearSession();
    clearPersistedCache();
    setToken(null);
    setUser(null);
    setWorkspace(null);
  }
```

- [ ] **Step 3: Call it from the 401 interceptor**

In `frontend/src/api/client.ts`, add the import:

```ts
import { clearPersistedCache } from '../lib/queryClient';
```

Find:

```ts
    if (error.response?.status === 401) {
      localStorage.removeItem('todo_token');
      window.location.href = '/login';
    }
```

Replace with:

```ts
    if (error.response?.status === 401) {
      localStorage.removeItem('todo_token');
      clearPersistedCache();
      window.location.href = '/login';
    }
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/queryClient.ts frontend/src/context/AuthContext.tsx frontend/src/api/client.ts
git commit -m "$(cat <<'EOF'
fix: clear persisted query cache on logout and 401

Without this, a second account logging in on the same browser would
briefly see the previous account's cached lists/tasks before the
fresh fetch overwrites it.
EOF
)"
```

---

### Task 4: Minimal toast utility

**Files:**
- Create: `frontend/src/lib/toast.ts`
- Create: `frontend/src/components/ui/ToastStack.tsx`
- Modify: `frontend/src/pages/AppShell.tsx`

**Interfaces:**
- Produces: `showToast(message: string): void` from `frontend/src/lib/toast.ts` — consumed by Tasks 7-9's mutation `onError` handlers. `<ToastStack />` component with no props, self-contained.

- [ ] **Step 1: Create the toast pub-sub module**

```ts
// frontend/src/lib/toast.ts
export interface ToastMessage {
  id: string;
  text: string;
}

type Listener = (messages: ToastMessage[]) => void;

let messages: ToastMessage[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(messages));
}

export function showToast(text: string) {
  const id = crypto.randomUUID();
  messages = [...messages, { id, text }];
  emit();
  setTimeout(() => {
    messages = messages.filter((m) => m.id !== id);
    emit();
  }, 4000);
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener);
  listener(messages);
  return () => listeners.delete(listener);
}
```

- [ ] **Step 2: Create the toast stack UI component**

```tsx
// frontend/src/components/ui/ToastStack.tsx
import { useEffect, useState } from 'react';
import { subscribeToasts, ToastMessage } from '../../lib/toast';

export function ToastStack() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => subscribeToasts(setMessages), []);

  if (messages.length === 0) return null;

  return (
    <div style={{ position: 'absolute', bottom: 70, left: 16, right: 16, zIndex: 30, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
      {messages.map((m) => (
        <div
          key={m.id}
          style={{
            background: 'var(--text)', color: 'var(--bg-card)', borderRadius: 10,
            padding: '10px 14px', fontSize: 15, fontWeight: 500, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          {m.text}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Mount it in `AppShell.tsx`**

In `frontend/src/pages/AppShell.tsx`, add the import:

```tsx
import { ToastStack } from '../components/ui/ToastStack';
```

Find the return block's outer `<div>` (the one with `maxWidth: 480, height: '100dvh'`) and add `<ToastStack />` as the last child, right before its closing tag:

```tsx
      <NavBar
        tab={detailListId ? 'lists' : tab}
        setTab={(t) => { setDetailListId(null); setTab(t); }}
      />
      <ToastStack />
    </div>
  );
}
```

(This replaces the existing `<NavBar .../>\n    </div>\n  );\n}` block — same content, `<ToastStack />` inserted between `<NavBar />` and the closing `</div>`.)

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/toast.ts frontend/src/components/ui/ToastStack.tsx frontend/src/pages/AppShell.tsx
git commit -m "feat: add minimal toast utility for offline conflict notices"
```

---

### Task 5: Cache-patch helper module

**Files:**
- Create: `frontend/src/lib/cachePatches.ts`

**Interfaces:**
- Produces: `insertTask`, `patchTask`, `replaceTaskId`, `removeTask`, `reorderTasks`, `insertList`, `patchList`, `replaceListId`, `removeList`, `insertSublist`, `replaceSublistId`, `removeSublist` — all `(qc: QueryClient, ...) => void`, consumed by Task 7's mutation hooks.

- [ ] **Step 1: Create the module**

```ts
// frontend/src/lib/cachePatches.ts
import { QueryClient } from '@tanstack/react-query';
import { DBTask, DBSublist, ListWithMembers, ListDetail } from '../types';

export function insertTask(qc: QueryClient, listId: string, task: DBTask) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId ? { ...l, tasks: [...(l.tasks || []), task] } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: [...prev.tasks, task] } : prev,
  );
}

export function patchTask(qc: QueryClient, listId: string, taskId: string, patch: Partial<DBTask>) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) =>
      l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : l,
    ),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : prev,
  );
}

export function replaceTaskId(qc: QueryClient, listId: string, tempId: string, realTask: DBTask) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) =>
      l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === tempId ? realTask : t)) } : l,
    ),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === tempId ? realTask : t)) } : prev,
  );
}

export function removeTask(qc: QueryClient, listId: string, taskId: string) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId ? { ...l, tasks: (l.tasks || []).filter((t) => t.id !== taskId) } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== taskId) } : prev,
  );
}

export function reorderTasks(qc: QueryClient, listId: string, orderedIds: string[]) {
  const applyOrder = (tasks: DBTask[]): DBTask[] => {
    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    return orderedIds.map((id, i) => ({ ...taskMap.get(id)!, position: i + 1 })).filter(Boolean);
  };
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId && l.tasks ? { ...l, tasks: applyOrder(l.tasks) } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: applyOrder(prev.tasks) } : prev,
  );
}

export function insertList(qc: QueryClient, list: ListWithMembers) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) => [...(prev ?? []), list]);
}

export function patchList(qc: QueryClient, listId: string, patch: Partial<ListWithMembers>) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId ? { ...l, ...patch } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) => (prev ? { ...prev, ...patch } : prev));
}

export function replaceListId(qc: QueryClient, tempId: string, realList: ListWithMembers) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === tempId ? realList : l)),
  );
}

export function removeList(qc: QueryClient, listId: string) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) => (prev ?? []).filter((l) => l.id !== listId));
  qc.removeQueries({ queryKey: ['list', listId] });
}

export function insertSublist(qc: QueryClient, listId: string, sublist: DBSublist) {
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, sublists: [...prev.sublists, sublist] } : prev,
  );
}

export function replaceSublistId(qc: QueryClient, listId: string, tempId: string, realSublist: DBSublist) {
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, sublists: prev.sublists.map((s) => (s.id === tempId ? realSublist : s)) } : prev,
  );
}

export function removeSublist(qc: QueryClient, listId: string, sublistId: string) {
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, sublists: prev.sublists.filter((s) => s.id !== sublistId) } : prev,
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/cachePatches.ts
git commit -m "feat: add shared cache-patch helpers for optimistic mutations"
```

---

### Task 6: Offline mutation engine (`defaultMutationFn`)

**Files:**
- Create: `frontend/src/lib/offlineMutations.ts`
- Modify: `frontend/src/lib/queryClient.ts`

**Interfaces:**
- Produces: `OfflineMutationVars` type and `defaultMutationFn` from `frontend/src/lib/offlineMutations.ts`, consumed by Task 7's mutation hooks (for the `OfflineMutationVars` type only — `defaultMutationFn` itself is wired once, globally, here).

- [ ] **Step 1: Create the mutation variables type and dispatcher**

```ts
// frontend/src/lib/offlineMutations.ts
import { tasksAPI } from '../api/tasks.api';
import { listsAPI } from '../api/lists.api';
import { sublistsAPI } from '../api/sublists.api';
import { DBTask, DBSublist, ListWithMembers } from '../types';

export type OfflineMutationVars =
  | { type: 'createTask'; listId: string; tempId: string; data: { text: string; sublist_id: string | null; assignee_id?: string | null; due?: string | null; notes: string } }
  | { type: 'updateTask'; listId: string; taskId: string; data: Record<string, unknown> }
  | { type: 'deleteTask'; listId: string; taskId: string }
  | { type: 'reorderTasks'; listId: string; orderedIds: string[] }
  | { type: 'createList'; tempId: string; name: string; emoji: string; shared: boolean }
  | { type: 'updateList'; listId: string; data: Record<string, unknown> }
  | { type: 'deleteList'; listId: string }
  | { type: 'createSublist'; listId: string; tempId: string; name: string };

export async function defaultMutationFn(vars: OfflineMutationVars): Promise<unknown> {
  switch (vars.type) {
    case 'createTask':
      return (await tasksAPI.createTask(vars.listId, vars.data)).data as DBTask;
    case 'updateTask':
      return (await tasksAPI.updateTask(vars.listId, vars.taskId, vars.data)).data as DBTask;
    case 'deleteTask':
      return (await tasksAPI.deleteTask(vars.listId, vars.taskId)).data;
    case 'reorderTasks':
      return (await tasksAPI.reorderTasks(vars.listId, vars.orderedIds)).data;
    case 'createList':
      return (await listsAPI.createList(vars.name, vars.emoji, vars.shared)).data as ListWithMembers;
    case 'updateList':
      return (await listsAPI.updateList(vars.listId, vars.data)).data as ListWithMembers;
    case 'deleteList':
      return (await listsAPI.deleteList(vars.listId)).data;
    case 'createSublist':
      return (await sublistsAPI.createSublist(vars.listId, vars.name)).data as DBSublist;
  }
}
```

- [ ] **Step 2: Register it as the QueryClient's default mutation function**

In `frontend/src/lib/queryClient.ts`, replace:

```ts
import { QueryClient } from '@tanstack/react-query';

export const QUERY_CACHE_KEY = 'todo_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});
```

with:

```ts
import { QueryClient, MutationFunction } from '@tanstack/react-query';
import { defaultMutationFn } from './offlineMutations';

export const QUERY_CACHE_KEY = 'todo_query_cache';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
    mutations: {
      // A per-call-site closure mutationFn can't be serialized to localStorage,
      // so paused (offline) mutations would be lost on page reload. Registering
      // one static, serializable-variables-based function here is what lets
      // TanStack Query's persist plugin restore and resume them after reload.
      mutationFn: defaultMutationFn as unknown as MutationFunction,
    },
  },
});
```

(`clearPersistedCache` from Task 3 stays below this, unchanged.)

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/offlineMutations.ts frontend/src/lib/queryClient.ts
git commit -m "$(cat <<'EOF'
feat: add offline-capable mutation engine

One defaultMutationFn registered on the QueryClient, dispatching on a
serializable OfflineMutationVars union, so paused mutations survive a
page reload and replay once back online.
EOF
)"
```

---

### Task 7: Mutation hooks (`useTaskMutations`, `useListMutations`, `useSublistMutations`)

**Files:**
- Create: `frontend/src/hooks/useOfflineMutations.ts`

**Interfaces:**
- Consumes: `OfflineMutationVars` from `frontend/src/lib/offlineMutations.ts`; cache-patch functions from `frontend/src/lib/cachePatches.ts`; `showToast` from `frontend/src/lib/toast.ts`.
- Produces:
  - `isTempId(id: string): boolean`
  - `useTaskMutations(): { createTask(listId, data), updateTask(listId, taskId, data), toggleTask(listId, taskId, currentDone), deleteTask(listId, taskId), reorderTasks(listId, orderedIds) }`
  - `useListMutations(): { createList(name, emoji, shared), updateList(listId, data), deleteList(listId) }`
  - `useSublistMutations(): { createSublist(listId, name) }`

  All consumed by Tasks 8-11.

- [ ] **Step 1: Create the hooks module**

```ts
// frontend/src/hooks/useOfflineMutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DBTask, DBSublist, ListWithMembers } from '../types';
import * as cache from '../lib/cachePatches';
import { showToast } from '../lib/toast';
import { OfflineMutationVars } from '../lib/offlineMutations';

const TEMP_PREFIX = 'temp-';
export const isTempId = (id: string) => id.startsWith(TEMP_PREFIX);
const newTempId = () => `${TEMP_PREFIX}${crypto.randomUUID()}`;

function isNotFound(error: unknown) {
  return (error as { response?: { status?: number } })?.response?.status === 404;
}

export function useTaskMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<DBTask, Error, Extract<OfflineMutationVars, { type: 'createTask' }>>({
    onMutate: async (vars) => {
      const optimistic: DBTask = {
        id: vars.tempId, list_id: vars.listId, sublist_id: vars.data.sublist_id,
        text: vars.data.text, done: false, assignee_id: vars.data.assignee_id ?? null,
        due: vars.data.due ?? null, notes: vars.data.notes, amount: null, position: 0,
        created_by: '', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      };
      cache.insertTask(qc, vars.listId, optimistic);
    },
    onSuccess: (task, vars) => cache.replaceTaskId(qc, vars.listId, vars.tempId, task),
    onError: (_error, vars) => cache.removeTask(qc, vars.listId, vars.tempId),
  });

  const updateMutation = useMutation<
    DBTask, Error,
    Extract<OfflineMutationVars, { type: 'updateTask' }>,
    { prevTask: DBTask | undefined }
  >({
    onMutate: async (vars) => {
      const prevTask = qc.getQueryData<ListWithMembers[]>(['lists'])
        ?.find((l) => l.id === vars.listId)?.tasks?.find((t) => t.id === vars.taskId);
      cache.patchTask(qc, vars.listId, vars.taskId, vars.data as Partial<DBTask>);
      return { prevTask };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) {
        showToast('Task was already removed — change skipped');
        cache.removeTask(qc, vars.listId, vars.taskId);
        return;
      }
      if (ctx?.prevTask) cache.patchTask(qc, vars.listId, vars.taskId, ctx.prevTask);
    },
  });

  const deleteMutation = useMutation<
    unknown, Error,
    Extract<OfflineMutationVars, { type: 'deleteTask' }>,
    { prevTask: DBTask | undefined }
  >({
    onMutate: async (vars) => {
      const prevTask = qc.getQueryData<ListWithMembers[]>(['lists'])
        ?.find((l) => l.id === vars.listId)?.tasks?.find((t) => t.id === vars.taskId);
      cache.removeTask(qc, vars.listId, vars.taskId);
      return { prevTask };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) return;
      if (ctx?.prevTask) cache.insertTask(qc, vars.listId, ctx.prevTask);
      showToast('Could not delete task — restored');
    },
  });

  const reorderMutation = useMutation<unknown, Error, Extract<OfflineMutationVars, { type: 'reorderTasks' }>>({
    onMutate: async (vars) => {
      cache.reorderTasks(qc, vars.listId, vars.orderedIds);
    },
    onError: (_error, vars) => {
      qc.invalidateQueries({ queryKey: ['list', vars.listId] });
    },
  });

  return {
    createTask: (listId: string, data: { text: string; sublist_id: string | null; assignee_id?: string | null; due?: string | null; notes: string }) =>
      createMutation.mutate({ type: 'createTask', listId, tempId: newTempId(), data }),
    updateTask: (listId: string, taskId: string, data: Record<string, unknown>) =>
      updateMutation.mutate({ type: 'updateTask', listId, taskId, data }),
    toggleTask: (listId: string, taskId: string, currentDone: boolean) =>
      updateMutation.mutate({ type: 'updateTask', listId, taskId, data: { done: !currentDone } }),
    deleteTask: (listId: string, taskId: string) =>
      deleteMutation.mutate({ type: 'deleteTask', listId, taskId }),
    reorderTasks: (listId: string, orderedIds: string[]) =>
      reorderMutation.mutate({ type: 'reorderTasks', listId, orderedIds }),
  };
}

export function useListMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<ListWithMembers, Error, Extract<OfflineMutationVars, { type: 'createList' }>>({
    onMutate: async (vars) => {
      const optimistic: ListWithMembers = {
        id: vars.tempId, workspace_id: '', name: vars.name, emoji: vars.emoji, shared: vars.shared,
        created_by: '', created_at: new Date().toISOString(), members: [], tasks: [],
      };
      cache.insertList(qc, optimistic);
    },
    onSuccess: (list, vars) => cache.replaceListId(qc, vars.tempId, list),
    onError: (_error, vars) => cache.removeList(qc, vars.tempId),
  });

  const updateMutation = useMutation<
    ListWithMembers, Error,
    Extract<OfflineMutationVars, { type: 'updateList' }>,
    { prevList: ListWithMembers | undefined }
  >({
    onMutate: async (vars) => {
      const prevList = qc.getQueryData<ListWithMembers[]>(['lists'])?.find((l) => l.id === vars.listId);
      cache.patchList(qc, vars.listId, vars.data as Partial<ListWithMembers>);
      return { prevList };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) {
        showToast('List was already removed — change skipped');
        cache.removeList(qc, vars.listId);
        return;
      }
      if (ctx?.prevList) cache.patchList(qc, vars.listId, ctx.prevList);
    },
  });

  const deleteMutation = useMutation<
    unknown, Error,
    Extract<OfflineMutationVars, { type: 'deleteList' }>,
    { prevList: ListWithMembers | undefined }
  >({
    onMutate: async (vars) => {
      const prevList = qc.getQueryData<ListWithMembers[]>(['lists'])?.find((l) => l.id === vars.listId);
      cache.removeList(qc, vars.listId);
      return { prevList };
    },
    onError: (error, vars, ctx) => {
      if (isNotFound(error)) return;
      if (ctx?.prevList) cache.insertList(qc, ctx.prevList);
      showToast('Could not delete list — restored');
    },
  });

  return {
    createList: (name: string, emoji: string, shared: boolean) =>
      createMutation.mutate({ type: 'createList', tempId: newTempId(), name, emoji, shared }),
    updateList: (listId: string, data: Record<string, unknown>) =>
      updateMutation.mutate({ type: 'updateList', listId, data }),
    deleteList: (listId: string) =>
      deleteMutation.mutate({ type: 'deleteList', listId }),
  };
}

export function useSublistMutations() {
  const qc = useQueryClient();

  const createMutation = useMutation<DBSublist, Error, Extract<OfflineMutationVars, { type: 'createSublist' }>>({
    onMutate: async (vars) => {
      const optimistic: DBSublist = { id: vars.tempId, list_id: vars.listId, name: vars.name, created_at: new Date().toISOString() };
      cache.insertSublist(qc, vars.listId, optimistic);
    },
    onSuccess: (sublist, vars) => cache.replaceSublistId(qc, vars.listId, vars.tempId, sublist),
    onError: (_error, vars) => cache.removeSublist(qc, vars.listId, vars.tempId),
  });

  return {
    createSublist: (listId: string, name: string) =>
      createMutation.mutate({ type: 'createSublist', listId, tempId: newTempId(), name }),
  };
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/hooks/useOfflineMutations.ts
git commit -m "feat: add useTaskMutations/useListMutations/useSublistMutations hooks"
```

---

### Task 8: Convert Dashboard.tsx to the new mutation hooks

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`

**Interfaces:**
- Consumes: `useTaskMutations` from `frontend/src/hooks/useOfflineMutations.ts`.

- [ ] **Step 1: Replace the imports**

Find:

```tsx
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask, ListWithMembers } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { IconBtn } from './ui/IconBtn';
import { Sheet } from './ui/Sheet';
import { tasksAPI } from '../api/tasks.api';
import TaskDetailSheet from './TaskDetailSheet';
```

Replace with:

```tsx
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLists } from '../hooks/useLists';
import { useTaskMutations } from '../hooks/useOfflineMutations';
import { useSettings } from '../context/SettingsContext';
import { DBTask } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { IconBtn } from './ui/IconBtn';
import { Sheet } from './ui/Sheet';
import TaskDetailSheet from './TaskDetailSheet';
```

- [ ] **Step 2: Replace `toggleTask`/`handleCreateTask` with the mutation hook**

Find:

```tsx
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { lists, isLoading } = useLists();
  const { t } = useSettings();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [creating, setCreating] = useState(false);
```

Replace with:

```tsx
  const auth = useAuth();
  const { lists, isLoading } = useLists();
  const { toggleTask, createTask } = useTaskMutations();
  const { t } = useSettings();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [taskSheet, setTaskSheet] = useState<DBTask | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
```

Find:

```tsx
  const toggleTask = async (taskId: string, listId: string) => {
    const task = allTasks.find((t) => t.id === taskId);
    if (!task) return;
    const newDone = !task.done;
    const patch = (done: boolean) =>
      queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
        (prev ?? []).map((l) =>
          l.id === listId
            ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === taskId ? { ...t, done } : t)) }
            : l,
        ),
      );
    patch(newDone);
    try { await tasksAPI.updateTask(listId, taskId, { done: newDone }); }
    catch { patch(task.done); }
  };

  const handleCreateTask = async () => {
    if (!selectedListId || !search.trim()) return;
    setCreating(true);
    try {
      await tasksAPI.createTask(selectedListId, { text: search.trim(), sublist_id: null, assignee_id: null, due: null, notes: '' });
      setSearch('');
      setShowCreateTask(false);
      setSelectedListId('');
    } catch {}
    finally { setCreating(false); }
  };
```

Replace with:

```tsx
  const handleCreateTask = () => {
    if (!selectedListId || !search.trim()) return;
    createTask(selectedListId, { text: search.trim(), sublist_id: null, assignee_id: null, due: null, notes: '' });
    setSearch('');
    setShowCreateTask(false);
    setSelectedListId('');
  };
```

- [ ] **Step 3: Update the two `toggleTask` call sites' arguments**

Find:

```tsx
                <div onClick={(e) => { e.stopPropagation(); toggleTask(task.id, task.list_id); }}>
                  <CheckCircle done={task.done} onToggle={() => toggleTask(task.id, task.list_id)} />
                </div>
```

Replace with:

```tsx
                <div onClick={(e) => { e.stopPropagation(); toggleTask(task.list_id, task.id, task.done); }}>
                  <CheckCircle done={task.done} onToggle={() => toggleTask(task.list_id, task.id, task.done)} />
                </div>
```

- [ ] **Step 4: Update the create-task button (no more async "..." state)**

Find:

```tsx
        <button
          onClick={handleCreateTask}
          disabled={!selectedListId || creating}
          style={{
            width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !selectedListId || creating ? 0.6 : 1
          }}
        >
          {creating ? '...' : t('add_task')}
        </button>
```

Replace with:

```tsx
        <button
          onClick={handleCreateTask}
          disabled={!selectedListId}
          style={{
            width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !selectedListId ? 0.6 : 1
          }}
        >
          {t('add_task')}
        </button>
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Dashboard.tsx
git commit -m "refactor: convert Dashboard task writes to useTaskMutations"
```

---

### Task 9: Convert Lists.tsx to the new mutation hooks

**Files:**
- Modify: `frontend/src/components/Lists.tsx`

**Interfaces:**
- Consumes: `useTaskMutations`, `useListMutations` from `frontend/src/hooks/useOfflineMutations.ts`.

- [ ] **Step 1: Replace the imports**

Find:

```tsx
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLists } from "../hooks/useLists";
import { useSettings } from "../context/SettingsContext";
import { ListWithMembers, ListDetail, DBTask } from "../types";
import { TopBar } from "./ui/TopBar";
import { IconBtn } from "./ui/IconBtn";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";
import { Avatar } from "./ui/Avatar";
import { Sheet } from "./ui/Sheet";
import { listsAPI } from "../api/lists.api";
import { tasksAPI } from "../api/tasks.api";
import React from "react";
```

Replace with:

```tsx
import { useState } from "react";
import { useLists } from "../hooks/useLists";
import { useTaskMutations, useListMutations, isTempId } from "../hooks/useOfflineMutations";
import { useSettings } from "../context/SettingsContext";
import { ListWithMembers, DBTask } from "../types";
import { TopBar } from "./ui/TopBar";
import { IconBtn } from "./ui/IconBtn";
import { Badge } from "./ui/Badge";
import { ProgressBar } from "./ui/ProgressBar";
import { Avatar } from "./ui/Avatar";
import { Sheet } from "./ui/Sheet";
import React from "react";
```

- [ ] **Step 2: Wire the hooks and drop the manual saving/deleting/creating state that awaited direct API calls**

Find:

```tsx
export default function Lists({ onSelectList }: ListsProps) {
  const { lists } = useLists();
  const { t } = useSettings();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [newShared, setNewShared] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [creating, setCreating] = useState(false);
  const [editList, setEditList] = useState<ListWithMembers | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📋");
  const [editShared, setEditShared] = useState(true);
  const [deleteList, setDeleteList] = useState<ListWithMembers | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const openEdit = (list: ListWithMembers) => {
    setEditList(list);
    setEditName(list.name);
    setEditEmoji(list.emoji);
    setEditShared(list.shared);
    setMenuListId(null);
  };

  const saveEdit = async () => {
    if (!editList || !editName.trim()) return;
    setSaving(true);
    try {
      await listsAPI.updateList(editList.id, { name: editName.trim(), emoji: editEmoji, shared: editShared });
      queryClient.setQueryData<ListWithMembers[]>(["lists"], (prev) =>
        (prev ?? []).map((l) =>
          l.id === editList.id ? { ...l, name: editName.trim(), emoji: editEmoji, shared: editShared } : l,
        ),
      );
      setEditList(null);
    } catch {} finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteList) return;
    setDeleting(true);
    try {
      await listsAPI.deleteList(deleteList.id);
      setDeleteList(null);
    } catch {} finally { setDeleting(false); }
  };

  const shared = lists.filter((l) => l.shared);
  const priv = lists.filter((l) => !l.shared);

  const createList = async () => {
    if (!newName.trim()) return;
    try {
      await listsAPI.createList(newName.trim(), newEmoji, newShared);
      setNewName("");
      setNewEmoji("📋");
      setNewShared(true);
      setShowCreate(false);
    } catch {}
  };

  const toggleTask = async (task: DBTask, listId: string) => {
    const newDone = !task.done;
    const patchLists = (done: boolean) => {
      queryClient.setQueryData<ListWithMembers[]>(["lists"], (prev) =>
        (prev ?? []).map((l) =>
          l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => (t.id === task.id ? { ...t, done } : t)) } : l,
        ),
      );
      queryClient.setQueryData<ListDetail>(["list", listId], (prev) =>
        prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === task.id ? { ...t, done } : t)) } : prev,
      );
    };
    patchLists(newDone);
    try { await tasksAPI.updateTask(listId, task.id, { done: newDone }); }
    catch { patchLists(task.done); }
  };

  const handleCreateTask = async () => {
    if (!selectedListId || !search.trim()) return;
    setCreating(true);
    try {
      await tasksAPI.createTask(selectedListId, { text: search.trim(), sublist_id: null, assignee_id: null, due: null, notes: '' });
      setSearch('');
      setShowCreateTask(false);
      setSelectedListId('');
    } catch {}
    finally { setCreating(false); }
  };
```

Replace with:

```tsx
export default function Lists({ onSelectList }: ListsProps) {
  const { lists } = useLists();
  const { t } = useSettings();
  const { toggleTask: toggleTaskMutation, createTask } = useTaskMutations();
  const { createList: createListMutation, updateList, deleteList: deleteListMutation } = useListMutations();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmoji, setNewEmoji] = useState("📋");
  const [newShared, setNewShared] = useState(true);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [menuListId, setMenuListId] = useState<string | null>(null);
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [selectedListId, setSelectedListId] = useState('');
  const [editList, setEditList] = useState<ListWithMembers | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmoji, setEditEmoji] = useState("📋");
  const [editShared, setEditShared] = useState(true);
  const [deleteList, setDeleteList] = useState<ListWithMembers | null>(null);

  const openEdit = (list: ListWithMembers) => {
    setEditList(list);
    setEditName(list.name);
    setEditEmoji(list.emoji);
    setEditShared(list.shared);
    setMenuListId(null);
  };

  const saveEdit = () => {
    if (!editList || !editName.trim()) return;
    updateList(editList.id, { name: editName.trim(), emoji: editEmoji, shared: editShared });
    setEditList(null);
  };

  const confirmDelete = () => {
    if (!deleteList) return;
    deleteListMutation(deleteList.id);
    setDeleteList(null);
  };

  const shared = lists.filter((l) => l.shared);
  const priv = lists.filter((l) => !l.shared);

  const createList = () => {
    if (!newName.trim()) return;
    createListMutation(newName.trim(), newEmoji, newShared);
    setNewName("");
    setNewEmoji("📋");
    setNewShared(true);
    setShowCreate(false);
  };

  const toggleTask = (task: DBTask, listId: string) => {
    toggleTaskMutation(listId, task.id, task.done);
  };

  const handleCreateTask = () => {
    if (!selectedListId || !search.trim()) return;
    createTask(selectedListId, { text: search.trim(), sublist_id: null, assignee_id: null, due: null, notes: '' });
    setSearch('');
    setShowCreateTask(false);
    setSelectedListId('');
  };
```

- [ ] **Step 3: Drop the now-unused `saving`/`deleting` state from the edit/delete Sheets**

Find:

```tsx
        <button onClick={saveEdit} disabled={saving || !editName.trim()}
          style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", fontSize: 17, fontWeight: 600, cursor: "pointer", opacity: saving || !editName.trim() ? 0.6 : 1 }}>
          {saving ? t("saving") : t("save")}
        </button>
      </Sheet>

      <Sheet open={!!deleteList} onClose={() => setDeleteList(null)} title={t("delete_list_confirm")}>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>{t("delete_list_sub")}</p>
        <button onClick={confirmDelete} disabled={deleting}
          style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--danger)", color: "#fff", border: "none", fontSize: 17, fontWeight: 600, cursor: "pointer", marginBottom: 10, opacity: deleting ? 0.6 : 1 }}>
          {deleting ? "..." : t("delete_list")}
        </button>
```

Replace with:

```tsx
        <button onClick={saveEdit} disabled={!editName.trim()}
          style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--primary)", color: "#fff", border: "none", fontSize: 17, fontWeight: 600, cursor: "pointer", opacity: !editName.trim() ? 0.6 : 1 }}>
          {t("save")}
        </button>
      </Sheet>

      <Sheet open={!!deleteList} onClose={() => setDeleteList(null)} title={t("delete_list_confirm")}>
        <p style={{ fontSize: 16, color: "var(--text-muted)", marginBottom: 24, lineHeight: 1.6 }}>{t("delete_list_sub")}</p>
        <button onClick={confirmDelete}
          style={{ width: "100%", padding: 13, borderRadius: 10, background: "var(--danger)", color: "#fff", border: "none", fontSize: 17, fontWeight: 600, cursor: "pointer", marginBottom: 10 }}>
          {t("delete_list")}
        </button>
```

- [ ] **Step 4: Drop the now-unused `creating` state from the create-task Sheet**

Find:

```tsx
        <button
          onClick={handleCreateTask}
          disabled={!selectedListId || creating}
          style={{
            width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !selectedListId || creating ? 0.6 : 1
          }}
        >
          {creating ? '...' : t('add_task')}
        </button>
      </Sheet>
    </div>
  );
}
```

Replace with:

```tsx
        <button
          onClick={handleCreateTask}
          disabled={!selectedListId}
          style={{
            width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff',
            border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !selectedListId ? 0.6 : 1
          }}
        >
          {t('add_task')}
        </button>
      </Sheet>
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors. (`isTempId` imported here is unused until Task 12 — that's fine, `noUnusedLocals` is off.)

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/Lists.tsx
git commit -m "refactor: convert Lists task/list writes to offline mutation hooks"
```

---

### Task 10: Convert ListDetail.tsx to the new mutation hooks

**Files:**
- Modify: `frontend/src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: `useTaskMutations`, `useListMutations`, `useSublistMutations` from `frontend/src/hooks/useOfflineMutations.ts`.

- [ ] **Step 1: Replace the imports**

Find:

```tsx
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useLists';
import { useSettings } from '../context/SettingsContext';
import { DBTask, ListDetail, ListWithMembers } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { Sheet } from './ui/Sheet';
import { listsAPI } from '../api/lists.api';
import { tasksAPI } from '../api/tasks.api';
import { sublistsAPI } from '../api/sublists.api';
import TaskDetailSheet from './TaskDetailSheet';
```

Replace with:

```tsx
import { useAuth } from '../hooks/useAuth';
import { useListDetail } from '../hooks/useLists';
import { useTaskMutations, useListMutations, useSublistMutations, isTempId } from '../hooks/useOfflineMutations';
import { useSettings } from '../context/SettingsContext';
import { DBTask } from '../types';
import { TopBar } from './ui/TopBar';
import { FilterChips } from './ui/FilterChips';
import { Avatar } from './ui/Avatar';
import { Badge } from './ui/Badge';
import { CheckCircle } from './ui/CheckCircle';
import { Sheet } from './ui/Sheet';
import TaskDetailSheet from './TaskDetailSheet';
```

- [ ] **Step 2: Wire the hooks in and replace `handleDragEnd`'s API call**

Find:

```tsx
  const auth = useAuth();
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState('All');
```

Replace with:

```tsx
  const auth = useAuth();
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const queryClient = useQueryClient();
  const { toggleTask: toggleTaskMutation, createTask, deleteTask, reorderTasks } = useTaskMutations();
  const { updateList, deleteList: deleteListMutation } = useListMutations();
  const { createSublist } = useSublistMutations();
  const [filter, setFilter] = useState('All');
```

(`queryClient` stays — `handleDragEnd`'s optimistic reorder below still uses it directly for the immediate drag-drop visual feedback, same as today; only the network call at the end changes.)

Find:

```tsx
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) => {
        if (l.id !== listId || !l.tasks) return l;
        const taskMap = new Map(l.tasks.map((t) => [t.id, t]));
        return { ...l, tasks: newOrder.map((id, i) => ({ ...taskMap.get(id)!, position: i + 1 })).filter(Boolean) as typeof l.tasks };
      }),
    );
    tasksAPI.reorderTasks(listId, newOrder).catch(() => {
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
    });
  }, [list?.tasks, listId, queryClient]);
```

Replace with:

```tsx
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) => {
        if (l.id !== listId || !l.tasks) return l;
        const taskMap = new Map(l.tasks.map((t) => [t.id, t]));
        return { ...l, tasks: newOrder.map((id, i) => ({ ...taskMap.get(id)!, position: i + 1 })).filter(Boolean) as typeof l.tasks };
      }),
    );
    reorderTasks(listId, newOrder);
  }, [list?.tasks, listId, queryClient, reorderTasks]);
```

- [ ] **Step 3: Replace `saveEdit`/`confirmDelete` (list edit/delete)**

Find:

```tsx
  const saveEdit = async () => {
    if (!list || !editName.trim()) return;
    setSaving(true);
    try {
      await listsAPI.updateList(listId, { name: editName.trim(), emoji: editEmoji, shared: editShared });
      queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
        (prev ?? []).map((l) => l.id === listId ? { ...l, name: editName.trim(), emoji: editEmoji, shared: editShared } : l),
      );
      queryClient.setQueryData(['list', listId], (prev: any) =>
        prev ? { ...prev, name: editName.trim(), emoji: editEmoji, shared: editShared } : prev,
      );
      setShowEdit(false);
    } catch {} finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await listsAPI.deleteList(listId);
      onBack();
    } catch {} finally { setDeleting(false); }
  };
```

Replace with:

```tsx
  const saveEdit = () => {
    if (!list || !editName.trim()) return;
    updateList(listId, { name: editName.trim(), emoji: editEmoji, shared: editShared });
    setShowEdit(false);
  };

  const confirmDelete = () => {
    deleteListMutation(listId);
    onBack();
  };
```

- [ ] **Step 4: Replace `toggleTask`, `markAllDone`, `unmarkAllDone`, `doAdd`, `doQuickAdd`**

Find:

```tsx
  const toggleTask = async (taskId: string) => {
    const task = list.tasks.find((task) => task.id === taskId);
    if (!task) return;
    const newDone = !task.done;
    const patch = (done: boolean) =>
      queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
        prev ? { ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, done } : t)) } : prev,
      );
    patch(newDone);
    try { await tasksAPI.updateTask(listId, taskId, { done: newDone }); }
    catch { patch(task.done); }
  };

  const markAllDone = async () => {
    setShowMenu(false);
    const undone = list.tasks.filter((t) => !t.done);
    if (!undone.length) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, done: true })) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => ({ ...t, done: true })) } : l,
      ),
    );
    await Promise.allSettled(undone.map((t) => tasksAPI.updateTask(listId, t.id, { done: true })));
  };

  const unmarkAllDone = async () => {
    const done = list.tasks.filter((t) => t.done);
    if (!done.length) return;
    queryClient.setQueryData<ListDetail>(['list', listId], (prev) =>
      prev ? { ...prev, tasks: prev.tasks.map((t) => ({ ...t, done: false })) } : prev,
    );
    queryClient.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
      (prev ?? []).map((l) =>
        l.id === listId ? { ...l, tasks: (l.tasks || []).map((t) => ({ ...t, done: false })) } : l,
      ),
    );
    await Promise.allSettled(done.map((t) => tasksAPI.updateTask(listId, t.id, { done: false })));
  };

  const doAdd = async () => {
    if (!addName.trim() || adding) return;
    setAdding(true);
    try {
      if (addType === 'sublist') {
        await sublistsAPI.createSublist(listId, addName.trim());
      } else {
        await tasksAPI.createTask(listId, { text: addName.trim(), sublist_id: addSublist, assignee_id: addAssignee, due: addDue || null, notes: '' });
      }
      setAddName(''); setAddSublist(null); setAddAssignee(null); setAddDue(''); setAddSheet(false);
    } catch {} finally { setAdding(false); }
  };

  const doQuickAdd = async () => {
    if (!quickText.trim() || adding) return;
    setAdding(true);
    try {
      await tasksAPI.createTask(listId, { text: quickText.trim(), sublist_id: quickSublist, notes: '' });
      setQuickText('');
    } catch {} finally { setAdding(false); }
  };
```

Replace with:

```tsx
  const toggleTask = (taskId: string) => {
    const task = list.tasks.find((task) => task.id === taskId);
    if (!task) return;
    toggleTaskMutation(listId, taskId, task.done);
  };

  const markAllDone = () => {
    setShowMenu(false);
    const undone = list.tasks.filter((t) => !t.done);
    undone.forEach((t) => toggleTaskMutation(listId, t.id, false));
  };

  const unmarkAllDone = () => {
    const done = list.tasks.filter((t) => t.done);
    done.forEach((t) => toggleTaskMutation(listId, t.id, true));
  };

  const doAdd = () => {
    if (!addName.trim()) return;
    if (addType === 'sublist') {
      createSublist(listId, addName.trim());
    } else {
      createTask(listId, { text: addName.trim(), sublist_id: addSublist, assignee_id: addAssignee, due: addDue || null, notes: '' });
    }
    setAddName(''); setAddSublist(null); setAddAssignee(null); setAddDue(''); setAddSheet(false);
  };

  const doQuickAdd = () => {
    if (!quickText.trim()) return;
    createTask(listId, { text: quickText.trim(), sublist_id: quickSublist, notes: '' });
    setQuickText('');
  };
```

- [ ] **Step 5: Drop the now-unused `saving`/`deleting`/`adding` state and their UI usages**

Find:

```tsx
  const [showDelete, setShowDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [adding, setAdding] = useState(false);
  const [quickText, setQuickText] = useState('');
```

Replace with:

```tsx
  const [showDelete, setShowDelete] = useState(false);
  const [quickText, setQuickText] = useState('');
```

Find:

```tsx
          <button onClick={doQuickAdd} disabled={!quickText.trim() || adding}
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, background: quickText.trim() ? 'var(--primary)' : 'var(--bg-input)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: quickText.trim() ? '#fff' : 'var(--text-faint)', opacity: adding ? 0.6 : 1, transition: 'background .15s' }}>
```

Replace with:

```tsx
          <button onClick={doQuickAdd} disabled={!quickText.trim()}
            style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 10, background: quickText.trim() ? 'var(--primary)' : 'var(--bg-input)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: quickText.trim() ? '#fff' : 'var(--text-faint)', transition: 'background .15s' }}>
```

Find:

```tsx
        <button onClick={doAdd} disabled={adding || !addName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: adding || !addName.trim() ? 0.6 : 1 }}>
          {adding ? '...' : addType === 'task' ? t('add_task') : t('add_sublist')}
        </button>
```

Replace with:

```tsx
        <button onClick={doAdd} disabled={!addName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !addName.trim() ? 0.6 : 1 }}>
          {addType === 'task' ? t('add_task') : t('add_sublist')}
        </button>
```

Find:

```tsx
        <button onClick={saveEdit} disabled={saving || !editName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: saving || !editName.trim() ? 0.6 : 1 }}>
          {saving ? t('saving') : t('save')}
        </button>
      </Sheet>

      <Sheet open={showSortSheet} onClose={() => setShowSortSheet(false)} title="Sort tasks">
```

Replace with:

```tsx
        <button onClick={saveEdit} disabled={!editName.trim()}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: !editName.trim() ? 0.6 : 1 }}>
          {t('save')}
        </button>
      </Sheet>

      <Sheet open={showSortSheet} onClose={() => setShowSortSheet(false)} title="Sort tasks">
```

Find:

```tsx
        <button onClick={confirmDelete} disabled={deleting}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginBottom: 10, opacity: deleting ? 0.6 : 1 }}>
          {deleting ? '...' : t('delete_list')}
        </button>
```

Replace with:

```tsx
        <button onClick={confirmDelete}
          style={{ width: '100%', padding: 13, borderRadius: 10, background: 'var(--danger)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', marginBottom: 10 }}>
          {t('delete_list')}
        </button>
```

- [ ] **Step 6: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors. (`deleteTask`/`isTempId` imported here are unused until Tasks 11-12 — fine, `noUnusedLocals` is off.)

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/ListDetail.tsx
git commit -m "refactor: convert ListDetail task/list/sublist writes to offline mutation hooks"
```

---

### Task 11: Convert TaskDetailSheet.tsx to the new mutation hooks

**Files:**
- Modify: `frontend/src/components/TaskDetailSheet.tsx`

**Interfaces:**
- Consumes: `useTaskMutations` from `frontend/src/hooks/useOfflineMutations.ts`.

- [ ] **Step 1: Replace the imports and handlers**

Find:

```tsx
import { useState } from 'react';
import { DBTask } from '../types';
import { Sheet } from './ui/Sheet';
import { CheckCircle } from './ui/CheckCircle';
import { useSettings } from '../context/SettingsContext';
import { tasksAPI } from '../api/tasks.api';
import { useListDetail } from '../hooks/useLists';

interface TaskDetailSheetProps {
  task: DBTask; listId: string;
  onClose: () => void; onSave: () => void; onDelete: () => void;
}

export default function TaskDetailSheet({ task, listId, onClose, onSave, onDelete }: TaskDetailSheetProps) {
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const [text, setText] = useState(task.text);
  const [notes, setNotes] = useState(task.notes || '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [due, setDue] = useState(task.due ? task.due.slice(0, 10) : '');
  const [sublistId, setSublistId] = useState(task.sublist_id);
  const [amount, setAmount] = useState(task.amount != null ? String(task.amount) : '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try { await tasksAPI.updateTask(listId, task.id, { text, notes, assignee_id: assigneeId, due: due || null, sublist_id: sublistId, amount: amount !== '' ? parseFloat(amount) : null }); onSave(); }
    catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await tasksAPI.deleteTask(listId, task.id); onDelete(); } catch {}
  };

  const handleToggleDone = async () => {
    setSaving(true);
    try { await tasksAPI.updateTask(listId, task.id, { done: !task.done }); onSave(); }
    catch {} finally { setSaving(false); }
  };
```

Replace with:

```tsx
import { useState } from 'react';
import { DBTask } from '../types';
import { Sheet } from './ui/Sheet';
import { CheckCircle } from './ui/CheckCircle';
import { useSettings } from '../context/SettingsContext';
import { useTaskMutations } from '../hooks/useOfflineMutations';
import { useListDetail } from '../hooks/useLists';

interface TaskDetailSheetProps {
  task: DBTask; listId: string;
  onClose: () => void; onSave: () => void; onDelete: () => void;
}

export default function TaskDetailSheet({ task, listId, onClose, onSave, onDelete }: TaskDetailSheetProps) {
  const { list } = useListDetail(listId);
  const { t } = useSettings();
  const { updateTask, deleteTask, toggleTask } = useTaskMutations();
  const [text, setText] = useState(task.text);
  const [notes, setNotes] = useState(task.notes || '');
  const [assigneeId, setAssigneeId] = useState(task.assignee_id);
  const [due, setDue] = useState(task.due ? task.due.slice(0, 10) : '');
  const [sublistId, setSublistId] = useState(task.sublist_id);
  const [amount, setAmount] = useState(task.amount != null ? String(task.amount) : '');

  const handleSave = () => {
    updateTask(listId, task.id, { text, notes, assignee_id: assigneeId, due: due || null, sublist_id: sublistId, amount: amount !== '' ? parseFloat(amount) : null });
    onSave();
  };

  const handleDelete = () => {
    deleteTask(listId, task.id);
    onDelete();
  };

  const handleToggleDone = () => {
    toggleTask(listId, task.id, task.done);
    onSave();
  };
```

- [ ] **Step 2: Drop the now-unused `saving` state from the Save button**

Find:

```tsx
        <button onClick={handleSave} disabled={saving}
          style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
          {saving ? t('saving') : t('save')}
        </button>
```

Replace with:

```tsx
        <button onClick={handleSave}
          style={{ flex: 1, padding: 12, borderRadius: 10, background: 'var(--primary)', color: '#fff', border: 'none', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>
          {t('save')}
        </button>
```

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/TaskDetailSheet.tsx
git commit -m "refactor: convert TaskDetailSheet writes to useTaskMutations"
```

---

### Task 12: Lock editing on unsynced (temp-ID) items

**Files:**
- Modify: `frontend/src/components/Dashboard.tsx`
- Modify: `frontend/src/components/Lists.tsx`
- Modify: `frontend/src/components/ListDetail.tsx`

**Interfaces:**
- Consumes: `isTempId` from `frontend/src/hooks/useOfflineMutations.ts` (already imported in Lists.tsx and ListDetail.tsx from Tasks 9-10; needs adding in Dashboard.tsx).

- [ ] **Step 1: Dashboard.tsx — disable interaction with temp tasks**

Find (import line from Task 8):

```tsx
import { useTaskMutations } from '../hooks/useOfflineMutations';
```

Replace with:

```tsx
import { useTaskMutations, isTempId } from '../hooks/useOfflineMutations';
```

Find:

```tsx
              <div
                key={task.id}
                onClick={() => setTaskSheet(task)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 8, cursor: 'pointer' }}
              >
                <div onClick={(e) => { e.stopPropagation(); toggleTask(task.list_id, task.id, task.done); }}>
                  <CheckCircle done={task.done} onToggle={() => toggleTask(task.list_id, task.id, task.done)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 16, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{task.text}</span>
```

Replace with:

```tsx
              <div
                key={task.id}
                onClick={() => !isTempId(task.id) && setTaskSheet(task)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-card)', borderRadius: 12, border: '0.5px solid var(--border)', marginBottom: 8, cursor: isTempId(task.id) ? 'default' : 'pointer', opacity: isTempId(task.id) ? 0.5 : 1 }}
              >
                <div onClick={(e) => { e.stopPropagation(); if (!isTempId(task.id)) toggleTask(task.list_id, task.id, task.done); }}>
                  <CheckCircle done={task.done} onToggle={() => !isTempId(task.id) && toggleTask(task.list_id, task.id, task.done)} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 16, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{isTempId(task.id) ? `${task.text} (syncing…)` : task.text}</span>
```

- [ ] **Step 2: Lists.tsx — disable temp list cards and temp task search results**

Find (`ListCard`'s outer click handler):

```tsx
    return (
      <div
        onClick={() => { if (isMenuOpen) { setMenuListId(null); return; } onSelectList(list.id); }}
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "0.5px solid var(--border)",
          padding: 14,
          marginBottom: 10,
          cursor: "pointer",
          position: "relative",
        }}
      >
```

Replace with:

```tsx
    const isTemp = isTempId(list.id);
    return (
      <div
        onClick={() => { if (isTemp) return; if (isMenuOpen) { setMenuListId(null); return; } onSelectList(list.id); }}
        style={{
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "0.5px solid var(--border)",
          padding: 14,
          marginBottom: 10,
          cursor: isTemp ? "default" : "pointer",
          position: "relative",
          opacity: isTemp ? 0.5 : 1,
        }}
      >
```

Find:

```tsx
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {list.name}
            </span>
```

Replace with:

```tsx
            <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {list.name}{isTemp ? ' (syncing…)' : ''}
            </span>
```

Find (the task-search-results toggle):

```tsx
                    <div
                      onClick={(e) => { e.stopPropagation(); toggleTask(task, list.id); }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        flexShrink: 0,
                        marginTop: 1,
                        background: task.done ? "var(--success)" : "transparent",
                        border: task.done ? "none" : "1.5px solid var(--border-mid)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                      }}
                    >
```

Replace with:

```tsx
                    <div
                      onClick={(e) => { e.stopPropagation(); if (!isTempId(task.id)) toggleTask(task, list.id); }}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        flexShrink: 0,
                        marginTop: 1,
                        background: task.done ? "var(--success)" : "transparent",
                        border: task.done ? "none" : "1.5px solid var(--border-mid)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: isTempId(task.id) ? "default" : "pointer",
                        opacity: isTempId(task.id) ? 0.5 : 1,
                      }}
                    >
```

- [ ] **Step 3: ListDetail.tsx — disable temp task rows and their drag handle**

Find:

```tsx
  const SortableTaskRow = ({ task }: { task: DBTask }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
    const isOverdue = task.due && task.due < today && !task.done;
    const isDueSoon = task.due && task.due >= today && !task.done;
    const assignee = list.members?.find((m) => m.id === task.assignee_id);
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)' }}>
        {activeSort === 'default' && (
          <div {...attributes} {...listeners} style={{ color: 'var(--text-faint)', cursor: 'grab', paddingTop: 3, flexShrink: 0, touchAction: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>
          </div>
        )}
        <div onClick={() => setTaskSheet(task)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, cursor: 'pointer', minWidth: 0 }}>
          <div onClick={(e) => e.stopPropagation()}>
            <CheckCircle done={task.done} onToggle={() => toggleTask(task.id)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}</span>
```

Replace with:

```tsx
  const SortableTaskRow = ({ task }: { task: DBTask }) => {
    const isTemp = isTempId(task.id);
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled: isTemp });
    const isOverdue = task.due && task.due < today && !task.done;
    const isDueSoon = task.due && task.due >= today && !task.done;
    const assignee = list.members?.find((m) => m.id === task.assignee_id);
    return (
      <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : isTemp ? 0.5 : 1, display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: '0.5px solid var(--border-subtle)' }}>
        {activeSort === 'default' && (
          <div {...attributes} {...listeners} style={{ color: 'var(--text-faint)', cursor: isTemp ? 'default' : 'grab', paddingTop: 3, flexShrink: 0, touchAction: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><circle cx="5" cy="3" r="1.3"/><circle cx="11" cy="3" r="1.3"/><circle cx="5" cy="8" r="1.3"/><circle cx="11" cy="8" r="1.3"/><circle cx="5" cy="13" r="1.3"/><circle cx="11" cy="13" r="1.3"/></svg>
          </div>
        )}
        <div onClick={() => !isTemp && setTaskSheet(task)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, cursor: isTemp ? 'default' : 'pointer', minWidth: 0 }}>
          <div onClick={(e) => e.stopPropagation()}>
            <CheckCircle done={task.done} onToggle={() => !isTemp && toggleTask(task.id)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, color: task.done ? 'var(--text-muted)' : 'var(--text)', textDecoration: task.done ? 'line-through' : 'none' }}>{task.text}{isTemp ? ' (syncing…)' : ''}</span>
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/Dashboard.tsx frontend/src/components/Lists.tsx frontend/src/components/ListDetail.tsx
git commit -m "$(cat <<'EOF'
feat: lock editing on unsynced offline-created items

Avoids rewriting an already-queued mutation's variables (unsupported
by TanStack Query) — items created offline show a "syncing…" state
and can't be edited/deleted/dragged until their create mutation
resolves and the temp ID is replaced with the real one.
EOF
)"
```

---

### Task 13: Offline banner

**Files:**
- Create: `frontend/src/components/ui/OfflineBanner.tsx`
- Modify: `frontend/src/pages/AppShell.tsx`

**Interfaces:**
- Consumes: `onlineManager` from `@tanstack/react-query`.

- [ ] **Step 1: Create the banner component**

```tsx
// frontend/src/components/ui/OfflineBanner.tsx
import { useEffect, useState } from 'react';
import { onlineManager } from '@tanstack/react-query';
import { useSettings } from '../../context/SettingsContext';

export function OfflineBanner() {
  const { t } = useSettings();
  const [isOnline, setIsOnline] = useState(onlineManager.isOnline());

  useEffect(() => onlineManager.subscribe(setIsOnline), []);

  if (isOnline) return null;

  return (
    <div style={{ background: 'var(--warning-bg)', color: 'var(--warning-dim)', fontSize: 14, fontWeight: 600, textAlign: 'center', padding: '6px 12px', flexShrink: 0 }}>
      {t('offline_banner')}
    </div>
  );
}
```

- [ ] **Step 2: Add the translation key**

In `frontend/src/i18n/translations.ts`, find:

```ts
  add_task_sublist: 'Add sublist or task...', add_to: 'Add to', add_item_ph: 'Add item...',
```

Replace with:

```ts
  add_task_sublist: 'Add sublist or task...', add_to: 'Add to', add_item_ph: 'Add item...',
  offline_banner: 'Offline — changes will sync when you\'re back online',
```

Find:

```ts
  add_task_sublist: '...הוסף תת-רשימה או משימה', add_to: 'הוסף ל', add_item_ph: '...הוסף פריט',
```

Replace with:

```ts
  add_task_sublist: '...הוסף תת-רשימה או משימה', add_to: 'הוסף ל', add_item_ph: '...הוסף פריט',
  offline_banner: 'לא מחובר — שינויים יסונכרנו כשהחיבור יחזור',
```

- [ ] **Step 3: Mount the banner in AppShell.tsx**

In `frontend/src/pages/AppShell.tsx`, add the import:

```tsx
import { OfflineBanner } from '../components/ui/OfflineBanner';
```

Find:

```tsx
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {renderScreen()}
      </div>
```

Replace with:

```tsx
      <OfflineBanner />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
        {renderScreen()}
      </div>
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npm run typecheck
```

Expected: exits 0, no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/OfflineBanner.tsx frontend/src/i18n/translations.ts frontend/src/pages/AppShell.tsx
git commit -m "feat: add offline banner"
```

---

## Post-plan manual verification (not a task — informational only)

Once all 13 tasks are complete, a full manual pass is worth doing before considering this shipped, since there's no automated test suite in this repo to catch regressions in the optimistic-update/rollback logic:

1. Start the app normally, confirm reads still work end-to-end (create/edit/delete/toggle tasks and lists, drag-reorder) exactly as before.
2. Reload the page and confirm lists/tasks paint instantly from cache before the network request resolves.
3. Use browser devtools' network throttling → "Offline", create a task and a list, toggle a task done, confirm the offline banner appears and the changes show immediately (with temp items locked/labeled "syncing…").
4. Go back online, confirm the queued mutations replay, temp IDs get replaced, and the "syncing…" lock clears.
5. Log out, log in as a different account on the same browser, confirm no stale cached data from the first account appears.
