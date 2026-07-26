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
