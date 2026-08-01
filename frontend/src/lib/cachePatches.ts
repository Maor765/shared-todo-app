import { QueryClient } from '@tanstack/react-query';
import { DBTask, DBSublist, ListWithMembers, ListDetail } from '../types';

// Adds `task`, replacing any existing entry with the same id (or `tempId`) rather
// than appending a second copy. Needed because task creation writes to the cache
// from two independent places — the mutation's optimistic insert/onSuccess, and
// the `task:created` socket echo the creator also receives — and either can land
// first, so a plain append would double the task regardless of ordering.
export function upsertTask(qc: QueryClient, listId: string, task: DBTask, tempId?: string) {
  const apply = (tasks: DBTask[]) => [...tasks.filter((t) => t.id !== task.id && t.id !== tempId), task];
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId ? { ...l, tasks: apply(l.tasks || []) } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, tasks: apply(prev.tasks) } : prev,
  );
}

export function insertTask(qc: QueryClient, listId: string, task: DBTask) {
  upsertTask(qc, listId, task);
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
  upsertTask(qc, listId, realTask, tempId);
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

// See upsertTask — same actor-echo race applies to list creation via `list:created`.
export function upsertList(qc: QueryClient, list: ListWithMembers, tempId?: string) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) => [
    ...(prev ?? []).filter((l) => l.id !== list.id && l.id !== tempId),
    list,
  ]);
}

export function insertList(qc: QueryClient, list: ListWithMembers) {
  upsertList(qc, list);
}

export function patchList(qc: QueryClient, listId: string, patch: Partial<ListWithMembers>) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) =>
    (prev ?? []).map((l) => (l.id === listId ? { ...l, ...patch } : l)),
  );
  qc.setQueryData<ListDetail>(['list', listId], (prev) => (prev ? { ...prev, ...patch } : prev));
}

export function replaceListId(qc: QueryClient, tempId: string, realList: ListWithMembers) {
  upsertList(qc, realList, tempId);
}

export function removeList(qc: QueryClient, listId: string) {
  qc.setQueryData<ListWithMembers[]>(['lists'], (prev) => (prev ?? []).filter((l) => l.id !== listId));
  qc.removeQueries({ queryKey: ['list', listId] });
}

// See upsertTask — same actor-echo race applies to sublist creation via `sublist:created`.
export function upsertSublist(qc: QueryClient, listId: string, sublist: DBSublist, tempId?: string) {
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev
      ? { ...prev, sublists: [...prev.sublists.filter((s) => s.id !== sublist.id && s.id !== tempId), sublist] }
      : prev,
  );
}

export function insertSublist(qc: QueryClient, listId: string, sublist: DBSublist) {
  upsertSublist(qc, listId, sublist);
}

export function replaceSublistId(qc: QueryClient, listId: string, tempId: string, realSublist: DBSublist) {
  upsertSublist(qc, listId, realSublist, tempId);
}

export function removeSublist(qc: QueryClient, listId: string, sublistId: string) {
  qc.setQueryData<ListDetail>(['list', listId], (prev) =>
    prev ? { ...prev, sublists: prev.sublists.filter((s) => s.id !== sublistId) } : prev,
  );
}
