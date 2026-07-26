# Offline Mode: Cache-First Reads + Queued Offline Writes

Date: 2026-07-26

## Problem

The app currently refetches all data from scratch on every load, with no
persistence across page reloads. Combined with Render/Neon free-tier cold
starts, this makes the app feel slow to open. Separately, the app has no way
to keep working (or queue changes) when the device has no network at all.

This spec covers both: (A) instant paint from a persisted cache on load, and
(B) letting task/list/sublist writes keep working offline and sync once
connectivity returns.

## A. Read-side: persist the query cache

Add two new first-party TanStack Query packages:
`@tanstack/query-sync-storage-persister` and
`@tanstack/react-query-persist-client` (same `^5.x` line as the existing
`@tanstack/react-query@^5.100.10`).

Replace `QueryClientProvider` in `frontend/src/main.tsx` with
`PersistQueryClientProvider`, using `createSyncStoragePersister({ storage:
window.localStorage, key: 'todo_query_cache' })`. This persists the entire
query cache (debounced) on every change and rehydrates it synchronously
before first render.

All five `useQuery` call sites need `gcTime: Infinity` (two already have it)
so nothing gets garbage-collected out of the persisted cache while unmounted:

| Hook | Query key | File |
|---|---|---|
| `useLists` | `['lists']` | `frontend/src/hooks/useLists.ts` (already `Infinity`) |
| `useListDetail` | `['list', listId]` | `frontend/src/hooks/useLists.ts` (already `Infinity`) |
| `useNotifications` | `['notifications']` | `frontend/src/hooks/useNotifications.ts` |
| Team members | `['members']` | `frontend/src/components/Team.tsx` |
| Team invites | `['invites']` | `frontend/src/components/Team.tsx` |

Net effect: on load, whatever was last cached paints immediately; the
existing `staleTime`-driven background refetch (unchanged) replaces it once
the network/backend responds, however long that takes.

## B. Detecting "offline"

TanStack's `onlineManager` normally tracks only `navigator.onLine` (the OS
network interface). That misses the actual motivating case: WiFi/cellular up,
but Render/Neon unreachable or cold. Extend `frontend/src/api/client.ts`'s
existing response interceptor:

- Any response (success) → `onlineManager.setOnline(true)`.
- Any error with `!error.response` (axios could not reach the server at all —
  connection refused, timeout, DNS failure — as opposed to a real HTTP
  error like 404/500, which means the server *was* reached) →
  `onlineManager.setOnline(false)`.

This makes the offline banner and mutation pause/resume trigger for real
backend outages too, not just literal airplane mode. A slow-but-eventually-
successful cold start is not treated as offline — it's just latency,
already hidden by the cache-first paint in section A.

## C. Write-side: mutation queue

### Why a `defaultMutationFn`

TanStack Query already pauses a mutation in memory when offline and replays
it (in order) once back online — no custom queue needed for the in-session
case. But a paused mutation only survives a page reload if it can be
persisted, and a per-call-site closure `mutationFn` can't be serialized to
`localStorage`. So instead of each call site supplying its own `mutationFn`,
`main.tsx` registers one `defaultMutationFn` on the `QueryClient`, and every
call site passes a plain, serializable variables object.

### Mutation variables shape

New file `frontend/src/lib/offlineMutations.ts` defines:

```ts
export type OfflineMutationVars =
  | { type: 'createTask'; listId: string; tempId: string; data: { text: string; sublist_id: string | null; assignee_id: string | null; due: string | null; notes: string } }
  | { type: 'updateTask'; listId: string; taskId: string; data: Record<string, unknown> }
  | { type: 'deleteTask'; listId: string; taskId: string }
  | { type: 'reorderTasks'; listId: string; orderedIds: string[] }
  | { type: 'createList'; tempId: string; name: string; emoji: string; shared: boolean }
  | { type: 'updateList'; listId: string; data: Record<string, unknown> }
  | { type: 'deleteList'; listId: string }
  | { type: 'createSublist'; listId: string; tempId: string; name: string }
  | { type: 'updateSublist'; listId: string; sublistId: string; name: string }
  | { type: 'deleteSublist'; listId: string; sublistId: string };
```

`defaultMutationFn(vars: OfflineMutationVars)` switches on `vars.type` and
calls the matching `tasksAPI`/`listsAPI`/`sublistsAPI` function (all already
exist, unchanged). Every `create*` branch, on success, returns the real
server entity so `onSuccess` can remap the temp ID (below).

### Call-site conversion (the ~15 existing direct-await call sites)

Each existing `await tasksAPI.xxx(...)` / `listsAPI.xxx(...)` /
`sublistsAPI.xxx(...)` call in `Dashboard.tsx`, `Lists.tsx`,
`ListDetail.tsx`, and `TaskDetailSheet.tsx` becomes a `useMutation()` with:
- `onMutate`: optimistic `queryClient.setQueryData` on `['lists']` and (where
  relevant) `['list', listId]`, mirroring the exact patterns already used by
  the socket handlers in `useLists.ts`/`useListDetail` (same shape, just
  triggered by a local mutation instead of a socket event).
- `onSuccess`: for `create*` mutations, replace the temp-ID entity with the
  real server entity in both query caches (this ID swap is what re-enables
  the item's edit/delete affordances — see temp ID section below). For
  everything else, this is a no-op since the optimistic update already
  matches server state.
- `onError`: if `error.response?.status === 404` (target no longer exists),
  roll back the optimistic change and show a toast: `"<item> was already
  removed — change skipped"`. Any other error: roll back and show a
  generic retry-later toast. (No hard failure that blocks the rest of the
  queue.)

Team/workspace mutations (`inviteMutation`, `deleteInviteMutation`,
`removeMemberMutation`, workspace rename) are **not** converted — they keep
their existing plain `useMutation` with an inline `mutationFn`, and simply
fail normally when offline (existing behavior, unchanged). Offline queueing
is scoped to tasks/lists/sublists only.

### Temp IDs for offline-created items

`createTask`/`createList`/`createSublist` mutations generate `` `temp-${crypto.randomUUID()}` `` client-side and optimistically insert a full
entity (with that temp ID) into the cache before the mutation even attempts
to run. If offline, the mutation stays paused (never calls
`defaultMutationFn`) until reconnect; the temp entity is what's visible in
the UI in the meantime.

**Limitation (accepted trade-off):** while an item's ID still starts with
`temp-` (not yet synced), its edit/delete/reorder affordances are disabled in
the UI with a "waiting to sync…" state, re-enabled once the create
resolves and the ID is remapped. This avoids rewriting an already-queued
mutation's variables in place, which would require reaching into
undocumented TanStack internals. You can still create additional new items
offline — this only blocks further edits to an item you *just* created,
before that create has synced.

## D. Scope, persistence isolation, and UI

- **Offline-queued:** tasks (create/update/delete/reorder/toggle-done) and
  lists/sublists (create/update/delete). Toggle-done is just `updateTask`
  with `{ done }`.
- **Online-only:** Team/workspace management (invite, remove member, role
  changes, workspace rename) — shows existing error behavior when offline,
  no queueing.
- **Cache isolation:** `frontend/src/context/AuthContext.tsx`'s `logout()`
  and `frontend/src/api/client.ts`'s 401 interceptor both call a new shared
  `clearPersistedCache()` helper that removes the `todo_query_cache`
  `localStorage` key and calls `queryClient.clear()`, so a second account
  logging in on the same browser never sees the previous account's cached
  data.
- **Conflict policy:** last-write-wins. A queued mutation just applies on top
  of whatever's on the server when it replays; a 404 on replay means the
  target is gone, so that one change is dropped with a toast (per section C)
  instead of blocking the rest of the queue.
- **UI:** a single persistent banner (no per-item indicators, except the
  temp-ID lock state from section C) shown whenever `onlineManager` reports
  offline: `"Offline — changes will sync when you're back online"`.
  Component: new `frontend/src/components/ui/OfflineBanner.tsx`, mounted
  once in `frontend/src/pages/AppShell.tsx`.

## Out of scope

- Offline support for Team/workspace management actions.
- Manual conflict review UI (last-write-wins only, per section D).
- Rewriting already-queued mutation variables to support chained edits to
  offline-created items (the temp-ID lock in section C is the accepted
  alternative).
- Any change to the `/api/health` DB warm-up fix shipped earlier — this spec
  is additive to it, not a replacement.
